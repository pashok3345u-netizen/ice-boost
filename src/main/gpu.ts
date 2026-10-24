// Video card sensors: temperature, voltage, fan, power.
// AMD — straight from the Radeon driver (ADL, atiadlxx.dll ships with every driver), no admin needed.
// NVIDIA — through nvidia-smi (ships with the driver); it doesn't report voltage.
// The watcher reads them every 2 s in the main process, so alerts work even when the window is minimized.
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { app, BrowserWindow, Notification } from 'electron'
import type { GpuSensors, GpuState } from '../shared/types'
import { checkGpu, type GpuAlertId } from '../shared/gpu'
import { parseJson, sensorPs } from './ps'

const ADL_CS = `
using System;
using System.Runtime.InteropServices;

public class IceGpuReading {
  public string vendor = "amd";
  public string name;
  public double? temp, hotspot, voltage, core, mem, fanRpm, fanPct, power, maxTemp;
}

public static class IceGpu {
  public delegate IntPtr Alloc(int size);
  static readonly Alloc alloc = size => Marshal.AllocHGlobal(size);

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  struct AdapterInfo {
    public int size, index;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string udid;
    public int bus, device, function, vendor;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string name;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string display;
    public int present, exist;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string driverPath;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string driverPathExt;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string pnp;
    public int osDisplayIndex;
  }

  // Overdrive N (RX 400/500, Vega): clocks in 10 kHz, voltage in mV
  [StructLayout(LayoutKind.Sequential)]
  struct OdnPerf {
    public int coreClock, memClock, dcefClock, gfxClock, uvdClock, vceClock, activity,
      coreLevel, memLevel, dcefLevel, gfxLevel, uvdLevel, vceLevel, busSpeed, busLanes, maxBusLanes, vddc, vddci;
  }

  [StructLayout(LayoutKind.Sequential)]
  struct FanVal { public int size, type, speed, flags; }

  [StructLayout(LayoutKind.Sequential)]
  struct OdnPower { public int mode, tdp, maxTemp; }

  // Overdrive 8 (RX 5000 and newer): 256 pairs of (supported, value)
  [StructLayout(LayoutKind.Sequential)]
  struct PmLog {
    public int size;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 512)] public int[] sensors;
  }

  const string D = "atiadlxx.dll";
  [DllImport(D)] static extern int ADL2_Main_Control_Create(Alloc cb, int connectedOnly, out IntPtr ctx);
  [DllImport(D)] static extern int ADL2_Adapter_NumberOfAdapters_Get(IntPtr ctx, out int n);
  [DllImport(D)] static extern int ADL2_Adapter_AdapterInfo_Get(IntPtr ctx, IntPtr info, int size);
  [DllImport(D)] static extern int ADL2_Adapter_Active_Get(IntPtr ctx, int idx, out int active);
  [DllImport(D)] static extern int ADL2_Overdrive_Caps(IntPtr ctx, int idx, out int supported, out int enabled, out int version);
  [DllImport(D)] static extern int ADL2_OverdriveN_PerformanceStatus_Get(IntPtr ctx, int idx, out OdnPerf p);
  [DllImport(D)] static extern int ADL2_OverdriveN_Temperature_Get(IntPtr ctx, int idx, int type, out int milliC);
  [DllImport(D)] static extern int ADL2_OverdriveN_PowerLimit_Get(IntPtr ctx, int idx, out OdnPower p);
  [DllImport(D)] static extern int ADL2_Overdrive5_FanSpeed_Get(IntPtr ctx, int idx, int thermal, ref FanVal v);
  [DllImport(D)] static extern int ADL2_Overdrive6_CurrentPower_Get(IntPtr ctx, int idx, int type, out int power);
  [DllImport(D)] static extern int ADL2_New_QueryPMLogData_Get(IntPtr ctx, int idx, ref PmLog data);

  static IntPtr ctx;
  static int idx = -1, od, maxTemp;
  static string name = "";
  static bool tried;

  static bool Init() {
    if (tried) return idx >= 0;
    tried = true;
    try {
      if (ADL2_Main_Control_Create(alloc, 1, out ctx) != 0) return false;
      int n;
      if (ADL2_Adapter_NumberOfAdapters_Get(ctx, out n) != 0 || n <= 0) return false;
      int sz = Marshal.SizeOf(typeof(AdapterInfo));
      IntPtr buf = Marshal.AllocHGlobal(sz * n);
      try {
        if (ADL2_Adapter_AdapterInfo_Get(ctx, buf, sz * n) != 0) return false;
        // the same card is listed several times; take the first one that is in use and has sensors
        for (int i = 0; i < n && idx < 0; i++) {
          var a = (AdapterInfo)Marshal.PtrToStructure(new IntPtr(buf.ToInt64() + (long)i * sz), typeof(AdapterInfo));
          int active, sup, en, ver;
          if (a.vendor != 1002 && a.vendor != 0x1002) continue;
          if (ADL2_Adapter_Active_Get(ctx, a.index, out active) != 0 || active != 1) continue;
          if (ADL2_Overdrive_Caps(ctx, a.index, out sup, out en, out ver) != 0 || sup == 0) continue;
          idx = a.index;
          od = ver;
          name = (a.name ?? "").Trim();
        }
      } finally {
        Marshal.FreeHGlobal(buf);
      }
      OdnPower p;
      if (idx >= 0 && od == 7 && ADL2_OverdriveN_PowerLimit_Get(ctx, idx, out p) == 0) maxTemp = p.maxTemp;
    } catch (Exception) {
      idx = -1; // no Radeon driver on this PC
    }
    return idx >= 0;
  }

  public static IceGpuReading Read() {
    if (!Init()) return null;
    var r = new IceGpuReading { name = name, maxTemp = maxTemp > 0 ? (double?)maxTemp : null };
    if (od >= 8) ReadOd8(r); else ReadOdn(r);
    return r;
  }

  static void ReadOdn(IceGpuReading r) {
    OdnPerf p;
    if (ADL2_OverdriveN_PerformanceStatus_Get(ctx, idx, out p) == 0) {
      r.core = Math.Round(p.coreClock / 100.0);
      r.mem = Math.Round(p.memClock / 100.0);
      if (p.vddc > 0) r.voltage = p.vddc / 1000.0;
    }
    int t;
    if (ADL2_OverdriveN_Temperature_Get(ctx, idx, 1, out t) == 0 && t > 0) r.temp = t / 1000.0;
    var f = new FanVal { size = 16, type = 2 };
    if (ADL2_Overdrive5_FanSpeed_Get(ctx, idx, 0, ref f) == 0) r.fanRpm = f.speed;
    f = new FanVal { size = 16, type = 1 };
    if (ADL2_Overdrive5_FanSpeed_Get(ctx, idx, 0, ref f) == 0) r.fanPct = f.speed;
    int w;
    if (ADL2_Overdrive6_CurrentPower_Get(ctx, idx, 0, out w) == 0) r.power = Math.Round(w / 256.0, 1);
  }

  static void ReadOd8(IceGpuReading r) {
    var d = new PmLog { sensors = new int[512] };
    if (ADL2_New_QueryPMLogData_Get(ctx, idx, ref d) != 0) return;
    // sensor numbers from the ADL SDK (ADL_PMLOG_*)
    r.core = Pm(d, 1);
    r.mem = Pm(d, 2);
    r.temp = Pm(d, 8) ?? Pm(d, 28);
    r.fanRpm = Pm(d, 14);
    r.fanPct = Pm(d, 15);
    double? v = Pm(d, 21);
    if (v > 0) r.voltage = v / 1000.0;
    r.power = Pm(d, 23);
    r.hotspot = Pm(d, 27);
  }

  static double? Pm(PmLog d, int k) {
    return d.sensors[k * 2] != 0 ? (double?)d.sensors[k * 2 + 1] : null;
  }
}
`

const AMD_SCRIPT = `
if (-not ('IceGpu' -as [type])) {
  $src = @'
${ADL_CS}
'@
  Add-Type -TypeDefinition $src
}
$r = [IceGpu]::Read()
if ($r) { $r | ConvertTo-Json -Compress } else { 'null' }
`

async function readAmd(): Promise<GpuSensors | null> {
  // the first call compiles the C# part (a couple of seconds), later calls take milliseconds
  return parseJson<GpuSensors | null>(await sensorPs.run(AMD_SCRIPT, 30_000))
}

function readNvidia(): Promise<GpuSensors | null> {
  return new Promise((resolve) => {
    execFile(
      'nvidia-smi',
      ['--query-gpu=name,temperature.gpu,clocks.gr,clocks.mem,fan.speed,power.draw', '--format=csv,noheader,nounits'],
      { windowsHide: true, timeout: 5000 },
      (err, stdout) => {
        const line = err ? '' : stdout.split(/\r?\n/).find((l) => l.trim())
        if (!line) return resolve(null)
        const [name, ...rest] = line.split(',').map((x) => x.trim())
        // "[N/A]" or "[Not Supported]" → null
        const [temp, core, mem, fanPct, power] = rest.map((v) => (v && Number.isFinite(Number(v)) ? Number(v) : null))
        resolve({
          vendor: 'nvidia', name, temp, hotspot: null, voltage: null, core, mem, fanRpm: null, fanPct, power, maxTemp: null
        })
      }
    )
  })
}

// ICEBOOST_FAKE_GPU='{"temp":91}' — dev only: pretend the card reports these values (to check alerts)
const fake = ((): Partial<GpuSensors> | null => {
  try {
    return process.env.ICEBOOST_FAKE_GPU ? (JSON.parse(process.env.ICEBOOST_FAKE_GPU) as Partial<GpuSensors>) : null
  } catch {
    return null
  }
})()

let source: 'amd' | 'nvidia' | null = null

async function readOnce(): Promise<GpuSensors | null> {
  // NVIDIA first: a PC with a GeForce may also have AMD graphics built into the processor
  if (source !== 'amd') {
    const n = await readNvidia()
    if (n) source = 'nvidia'
    if (n || source === 'nvidia') return n
  }
  const a = await readAmd().catch(() => null)
  if (a) source = 'amd'
  return a
}

// ---- state for the page

const POLL_MS = 2000
const HISTORY = 150 // 5 minutes

let state: GpuState = {
  supported: true,
  now: null,
  history: { temp: [], voltage: [], power: [] },
  max: { temp: null, hotspot: null, voltage: null, power: null }
}

const higher = (a: number | null, b: number | null): number | null => (b == null ? a : a == null ? b : Math.max(a, b))
const add = (list: number[], v: number | null): number[] => (v == null ? list : [...list, v].slice(-HISTORY))

function push(s: GpuSensors): void {
  const { history: h, max: m } = state
  state = {
    supported: true,
    now: s,
    history: { temp: add(h.temp, s.temp), voltage: add(h.voltage, s.voltage), power: add(h.power, s.power) },
    max: {
      temp: higher(m.temp, s.temp),
      hotspot: higher(m.hotspot, s.hotspot),
      voltage: higher(m.voltage, s.voltage),
      power: higher(m.power, s.power)
    }
  }
}

export async function getGpu(): Promise<GpuState> {
  return state
}

export async function resetGpuMax(): Promise<void> {
  const s = state.now
  state = { ...state, max: { temp: s?.temp ?? null, hotspot: s?.hotspot ?? null, voltage: s?.voltage ?? null, power: s?.power ?? null } }
}

// ---- Windows notifications

const TEXT = {
  ru: {
    title: 'IceBoost: видеокарта в опасности!',
    temp: 'Видеокарта нагрелась до {t}°C. Выйди из игры и дай ей остыть.',
    hotspot: 'Самая горячая точка чипа: {h}°C. Выйди из игры и дай карте остыть.',
    volt: 'Напряжение {v} В — слишком высокое. Сбрось разгон в программе AMD или NVIDIA.'
  },
  en: {
    title: 'IceBoost: your graphics card is in danger!',
    temp: 'Your graphics card is at {t}°C. Quit the game and let it cool down.',
    hotspot: 'The hottest spot of the chip is at {h}°C. Quit the game and let the card cool down.',
    volt: 'Voltage is {v} V — too high. Reset the overclock in the AMD or NVIDIA app.'
  }
}

const REPEAT_MS = 3 * 60_000
const streak: Partial<Record<GpuAlertId, number>> = {}
const lastShown: Partial<Record<GpuAlertId, number>> = {}

async function uiLang(win: BrowserWindow | undefined): Promise<'ru' | 'en'> {
  try {
    const l = await win?.webContents.executeJavaScript(`localStorage.getItem('lang') || navigator.language`)
    return String(l).toLowerCase().startsWith('ru') ? 'ru' : 'en'
  } catch {
    return app.getLocale().startsWith('ru') ? 'ru' : 'en'
  }
}

async function notify(ids: Exclude<GpuAlertId, 'fan'>[], s: GpuSensors): Promise<void> {
  if (!Notification.isSupported()) return
  const win = BrowserWindow.getAllWindows()[0]
  const tx = TEXT[await uiLang(win)]
  const body = ids
    .map((id) =>
      tx[id]
        .replace('{t}', String(Math.round(s.temp ?? 0)))
        .replace('{h}', String(Math.round(s.hotspot ?? 0)))
        .replace('{v}', (s.voltage ?? 0).toFixed(3))
    )
    .join('\n')
  const n = new Notification({ title: tx.title, body, icon: join(__dirname, '../../build/icon.png') })
  n.on('click', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    void win.webContents.executeJavaScript(`window.__iceGoto && window.__iceGoto('gpu')`)
  })
  n.show()
  if (win && !win.isFocused()) win.flashFrame(true)
}

function watchAlerts(s: GpuSensors): void {
  // only real danger pops up over games; "hot" and the fan hint stay inside the app
  const loud = checkGpu(s).alerts.filter((a) => a.level === 'danger')
  for (const id of Object.keys(streak) as GpuAlertId[]) if (!loud.some((a) => a.id === id)) delete streak[id]
  const due: Exclude<GpuAlertId, 'fan'>[] = []
  for (const a of loud) {
    if (a.id === 'fan') continue
    const n = (streak[a.id] = (streak[a.id] ?? 0) + 1)
    // two readings in a row (4 s), so one short spike doesn't raise the alarm
    if (n < 2 || Date.now() - (lastShown[a.id] ?? 0) < REPEAT_MS) continue
    lastShown[a.id] = Date.now()
    due.push(a.id)
  }
  // several problems at once → one notification, not a pile of them
  if (due.length) void notify(due, s)
}

// ---- the loop

let timer: NodeJS.Timeout | null = null
let stopped = false
let fails = 0

async function tick(): Promise<void> {
  const raw = await readOnce()
  if (!raw) {
    // never got a reading after 3 tries → this card has no sensors we can read
    if (!state.now && ++fails >= 3) state = { ...state, supported: false }
    return
  }
  fails = 0
  const s = fake ? { ...raw, ...fake } : raw
  push(s)
  watchAlerts(s)
}

export function startGpuWatch(): void {
  const loop = async (): Promise<void> => {
    try {
      await tick()
    } catch {
      // skip this reading
    }
    if (!stopped && state.supported) timer = setTimeout(loop, POLL_MS)
  }
  void loop()
}

export function stopGpuWatch(): void {
  stopped = true
  if (timer) clearTimeout(timer)
}
