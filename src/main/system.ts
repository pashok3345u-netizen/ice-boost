// PC info, live load (CPU/RAM/GPU/disk) and the process list.
import os from 'node:os'
import { statfs } from 'node:fs/promises'
import type { LiveStats, OpResult, ProcInfo, SystemInfo } from '../shared/types'
import { isProtected } from '../shared/protected'
import { isAdmin, monitorPs, parseJson, psValue, taskPs } from './ps'

export async function getSystemInfo(): Promise<SystemInfo> {
  const out = await taskPs.run(`
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$gpus = @(Get-CimInstance Win32_VideoController | Where-Object { $_.Name -notmatch 'Basic|Virtual|Remote|Parsec|Meta' })
$gpu = $gpus | Sort-Object { [int64]$_.AdapterRAM } -Descending | Select-Object -First 1
$vram = 0
Get-ItemProperty 'HKLM:\\SYSTEM\\ControlSet001\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0*' -ErrorAction SilentlyContinue |
  Where-Object { $_.DriverDesc -eq $gpu.Name } | ForEach-Object {
    $v = $_.'HardwareInformation.qwMemorySize'
    if ($v -and [int64]$v -gt $vram) { $vram = [int64]$v }
  }
if ($vram -eq 0 -and $gpu) { $vram = [int64]$gpu.AdapterRAM }
$cs = Get-CimInstance Win32_ComputerSystem
$bb = Get-CimInstance Win32_BaseBoard | Select-Object -First 1
$osi = Get-CimInstance Win32_OperatingSystem
$ram = @(Get-CimInstance Win32_PhysicalMemory)
$disks = @(Get-PhysicalDisk | ForEach-Object { @{ name = "$($_.FriendlyName)".Trim(); media = "$($_.MediaType)"; bus = "$($_.BusType)"; size = [int64]$_.Size } })
$caption = ("$($osi.Caption)" -replace '^(Microsoft|Майкрософт)\\s+', '').Trim()
@{
  cpu = "$($cpu.Name)".Trim() -replace '\\s+', ' '
  cores = [int]$cpu.NumberOfCores
  threads = [int]$cpu.NumberOfLogicalProcessors
  gpu = if ($gpu) { "$($gpu.Name)".Trim() } else { '' }
  vram = [int64]$vram
  refresh = if ($gpu) { [int]$gpu.CurrentRefreshRate } else { 0 }
  resolution = if ($gpu) { "$($gpu.CurrentHorizontalResolution)x$($gpu.CurrentVerticalResolution)" } else { '' }
  ramTotal = [int64]$cs.TotalPhysicalMemory
  ramSticks = $ram.Count
  ramSpeed = if ($ram.Count) { [int]($ram | Measure-Object Speed -Maximum).Maximum } else { 0 }
  ramType = if ($ram.Count) { [int]$ram[0].SMBIOSMemoryType } else { 0 }
  os = $caption
  build = "$($osi.Version)"
  board = ("$($bb.Manufacturer) $($bb.Product)" -replace 'Gigabyte Technology Co., Ltd.', 'Gigabyte').Trim()
  disks = $disks
} | ConvertTo-Json -Depth 4 -Compress
`)
  const info = parseJson<Omit<SystemInfo, 'isAdmin'>>(out)
  return { ...info, disks: info.disks ?? [], isAdmin: await isAdmin() }
}

// ---- live stats

let lastCpu = os.cpus()
function cpuPercent(): number {
  const now = os.cpus()
  let idle = 0
  let total = 0
  now.forEach((c, i) => {
    const prev = lastCpu[i]?.times ?? c.times
    const d = {
      user: c.times.user - prev.user,
      nice: c.times.nice - prev.nice,
      sys: c.times.sys - prev.sys,
      idle: c.times.idle - prev.idle,
      irq: c.times.irq - prev.irq
    }
    idle += d.idle
    total += d.user + d.nice + d.sys + d.idle + d.irq
  })
  lastCpu = now
  return total > 0 ? Math.round((1 - idle / total) * 1000) / 10 : 0
}

// GPU load comes from Windows performance counters (same data as Task Manager).
// The query is slow, so it runs in the background and we keep the latest value.
let gpuCache: { gpu: number | null; vram: number | null } = { gpu: null, vram: null }
let gpuBusy = false
let gpuLastAsk = 0
function refreshGpu(): void {
  if (gpuBusy) return
  gpuBusy = true
  monitorPs
    .run(
      `
$e = @(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*engtype_3D' })
$m = @(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUAdapterMemory -ErrorAction SilentlyContinue)
$g = if ($e.Count) { [Math]::Min(100, ($e | Measure-Object UtilizationPercentage -Sum).Sum) } else { $null }
$v = if ($m.Count) { ($m | Measure-Object DedicatedUsage -Maximum).Maximum } else { $null }
@{ gpu = $g; vram = $v } | ConvertTo-Json -Compress
`,
      30_000
    )
    .then((out) => {
      gpuCache = parseJson(out)
    })
    .catch(() => {})
    .finally(() => {
      gpuBusy = false
    })
}

export async function getLive(): Promise<LiveStats> {
  if (Date.now() - gpuLastAsk > 2000) {
    gpuLastAsk = Date.now()
    refreshGpu()
  }
  let diskFree = 0
  let diskTotal = 0
  try {
    const s = await statfs((process.env.SystemDrive ?? 'C:') + '\\')
    diskFree = s.bavail * s.bsize
    diskTotal = s.blocks * s.bsize
  } catch {
    // ignore
  }
  const ramTotal = os.totalmem()
  return {
    cpu: cpuPercent(),
    ramUsed: ramTotal - os.freemem(),
    ramTotal,
    diskFree,
    diskTotal,
    gpu: gpuCache.gpu,
    vramUsed: gpuCache.vram,
    uptime: os.uptime()
  }
}

// ---- processes

export async function getProcesses(): Promise<ProcInfo[]> {
  // CPU % per process = CPU time used since the previous call; the worker keeps the last sample.
  const out = await monitorPs.run(`
$now = Get-Date
$procs = Get-Process
$cur = @{}
foreach ($p in $procs) { try { $cur[$p.Id] = $p.TotalProcessorTime.TotalMilliseconds } catch {} }
$elapsed = if ($global:__prevT) { ($now - $global:__prevT).TotalMilliseconds } else { 0 }
$prev = $global:__prev
$groups = @{}
foreach ($p in $procs) {
  if ($p.Id -le 4) { continue }
  $n = $p.ProcessName
  $g = $groups[$n]
  if (-not $g) { $g = @{ name = $n; ram = [int64]0; cpu = 0.0; count = 0; first = $p }; $groups[$n] = $g }
  $g.ram += $p.WorkingSet64
  $g.count++
  if ($elapsed -gt 0 -and $prev -and $prev.ContainsKey($p.Id) -and $cur.ContainsKey($p.Id)) {
    $g.cpu += [Math]::Max(0, $cur[$p.Id] - $prev[$p.Id])
  }
}
$global:__prev = $cur
$global:__prevT = $now
$cores = [Environment]::ProcessorCount
$all = @($groups.Values)
foreach ($g in $all) { $g.cpu = if ($elapsed -gt 0) { [Math]::Round($g.cpu / $elapsed / $cores * 100, 1) } else { 0 } }
# file descriptions are slow to read, so only for the biggest ones (cached after that)
$top = @{}
@($all | Sort-Object { $_.ram } -Descending | Select-Object -First 30) + @($all | Sort-Object { $_.cpu } -Descending | Select-Object -First 10) |
  ForEach-Object { $top[$_.name] = 1 }
if (-not $global:__desc) { $global:__desc = @{} }
$list = foreach ($g in $all) {
  if (-not $top.ContainsKey($g.name)) {
    @{ name = $g.name; desc = $global:__desc[$g.name]; ram = $g.ram; cpu = $g.cpu; count = $g.count }
    continue
  }
  if (-not $global:__desc.ContainsKey($g.name)) {
    $d = $null
    try { $path = $g.first.Path; if ($path) { $d = (Get-Item -LiteralPath $path).VersionInfo.FileDescription } } catch {}
    $global:__desc[$g.name] = "$d".Trim()
  }
  @{ name = $g.name; desc = $global:__desc[$g.name]; ram = $g.ram; cpu = $g.cpu; count = $g.count }
}
ConvertTo-Json -InputObject @($list) -Compress
`)
  const list = parseJson<ProcInfo[]>(out)
  return list.map((p) => ({ ...p, desc: p.desc || null }))
}

export async function killProcesses(names: string[]): Promise<OpResult> {
  const safe = names.filter((n) => !isProtected(n))
  if (safe.length === 0) return { ok: false, error: 'PROTECTED' }
  const out = await taskPs.run(`
$names = ${psValue(safe)}
$failed = @()
foreach ($n in $names) {
  $ps = @(Get-Process -Name $n -ErrorAction SilentlyContinue)
  foreach ($p in $ps) { try { $p.Kill() } catch { $failed += $n } }
}
@{ failed = @($failed | Select-Object -Unique) } | ConvertTo-Json -Compress
`)
  const { failed } = parseJson<{ failed: string[] | null }>(out)
  if (failed && failed.length) return { ok: false, error: failed.join(', ') }
  return { ok: true }
}
