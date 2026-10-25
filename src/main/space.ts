// Disk space: installed apps (uninstall + leftovers), big and old files, the disk map, the Recycle Bin.
// Nothing is deleted for good here: files and leftovers go to the Recycle Bin, apps are removed by their own uninstaller.
import { app, BrowserWindow, dialog, nativeImage, shell } from 'electron'
import { spawn } from 'node:child_process'
import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type {
  AppKind, AppScan, BigFile, DriveInfo, FileScan, InstalledApp, JobKind, Leftover, MapItem, MapLevel, OpResult, Places,
  ScanStatus, SpaceExtras, TrashResult
} from '../shared/types'
import { isInside, leftoverAllowed, lockReason, normPath } from '../shared/space'
import { diskPs, monitorPs, parseJson, psArr, psStr, taskPs } from './ps'
import { recycleSize } from './cleaner'
import SPACE_CS from './space.cs?raw'
import APPS_PS from './space-apps.ps1?raw'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------- places and drives

function getPathSafe(name: Parameters<typeof app.getPath>[0]): string | null {
  try {
    return app.getPath(name)
  } catch {
    return null
  }
}

function uniq(list: (string | null | undefined)[]): string[] {
  const seen = new Map<string, string>()
  for (const p of list) if (p && !seen.has(normPath(p))) seen.set(normPath(p), p)
  return [...seen.values()]
}

export function places(): Places {
  const env = process.env
  const profile = env.USERPROFILE ?? app.getPath('home')
  return {
    windows: env.SystemRoot ?? 'C:\\Windows',
    programFiles: uniq([env.ProgramFiles, env['ProgramFiles(x86)'], env.ProgramW6432]),
    programData: env.ProgramData ?? 'C:\\ProgramData',
    profile,
    appData: uniq([join(profile, 'AppData'), env.APPDATA, env.LOCALAPPDATA]),
    known: uniq((['desktop', 'documents', 'downloads', 'videos', 'pictures', 'music'] as const).map(getPathSafe)),
    downloads: getPathSafe('downloads') ?? join(profile, 'Downloads'),
    oneDrive: uniq([env.OneDrive, env.OneDriveConsumer, env.OneDriveCommercial])
  }
}

export async function getPlaces(): Promise<Places> {
  return places()
}

export async function getDrives(): Promise<DriveInfo[]> {
  const out = await monitorPs.run(`
$sys = "$env:SystemDrive".ToUpper()
$r = foreach ($d in [IO.DriveInfo]::GetDrives()) {
  if ("$($d.DriveType)" -ne 'Fixed' -or -not $d.IsReady) { continue }
  $root = $d.Name.Substring(0, 2).ToUpper()
  @{ root = $root; label = "$($d.VolumeLabel)"; total = [int64]$d.TotalSize; free = [int64]$d.AvailableFreeSpace; system = ($root -eq $sys) }
}
ConvertTo-Json -InputObject @($r) -Compress
`)
  return parseJson<DriveInfo[]>(out)
}

export async function getSpaceExtras(): Promise<SpaceExtras> {
  const out = await monitorPs.run(`
$h = Get-ChildItem -LiteralPath "$env:SystemDrive\\" -Force -Filter 'hiberfil.sys' -ErrorAction SilentlyContinue | Select-Object -First 1
@{ hiberfil = $(if ($h) { [int64]$h.Length } else { $null }); windowsOld = (Test-Path -LiteralPath "$env:SystemDrive\\Windows.old") } | ConvertTo-Json -Compress
`)
  const r = parseJson<Omit<SpaceExtras, 'recycle'>>(out)
  return { ...r, recycle: await recycleSize().catch(() => 0) }
}

// ---------------------------------------------------------------- background scans

const ENSURE = `if (-not ('IceSpace' -as [type])) {
  Add-Type -TypeDefinition @'
${SPACE_CS}
'@
}`

const idle = (): ScanStatus => ({ running: false, done: 0, total: 0, files: 0, current: '', phase: '' })
const status: Record<JobKind, ScanStatus> = { apps: idle(), files: idle(), map: idle() }
let chain: Promise<unknown> = Promise.resolve()

/** Starts a scan inside the C# engine and waits for it, keeping `status` fresh for the progress bar. */
function runJob<T>(kind: JobKind, start: string): Promise<T> {
  const job = chain.then(async () => {
    status[kind] = { ...idle(), running: true }
    try {
      await diskPs.run(`${ENSURE}\n${start}`, 120_000)
      for (;;) {
        await sleep(300)
        const s = parseJson<ScanStatus & { error: string | null }>(await diskPs.run('[IceSpace]::Status()'))
        status[kind] = { running: true, done: s.done, total: s.total, files: s.files, current: s.current, phase: s.phase }
        if (!s.running) {
          if (s.error) throw new Error(s.error)
          break
        }
      }
      return parseJson<T>(await diskPs.run('[IceSpace]::Result()', 120_000))
    } finally {
      status[kind] = { ...status[kind], running: false }
    }
  })
  chain = job.catch(() => {})
  return job
}

export async function spaceStatus(): Promise<Record<JobKind, ScanStatus>> {
  return status
}

export async function cancelScan(): Promise<void> {
  await diskPs.run(`if ('IceSpace' -as [type]) { [IceSpace]::Cancel() }`)
}

// ---------------------------------------------------------------- installed apps

interface RegRow {
  key: string
  keyName: string
  hive: string
  name: string
  publisher: string
  version: string
  location: string
  icon: string
  uninstall: string
  quiet: string
  msi: number
  noRemove: number
  size: number
  date: string
}
interface SteamRow { appid: string; name: string; dir: string; size: number; last: number; manifest: string }
interface EpicRow { app: string; name: string; dir: string; size: number; exe: string; manifest: string }
interface StoreRow {
  full: string
  family: string
  pkgName: string
  name: string
  publisher: string
  version: string
  location: string
  logo: string
  installed: number
}

interface Command {
  exe: string
  args: string
}

/** What the renderer sees plus how to remove the app. */
interface AppEntry extends InstalledApp {
  /** extra folders that belong to it (Steam: the unfinished download) */
  extraDirs: string[]
  run?: Command
  quietRun?: Command
  /** registry key — gone after the uninstall */
  key?: string
  /** Steam/Epic manifest — gone after the uninstall */
  manifest?: string
  steamId?: string
  epicId?: string
  store?: { full: string; name: string }
  iconFile?: string
  exes: string[]
}

let apps = new Map<string, AppEntry>()
let steamPath = ''
/** leftovers found after an uninstall may be removed even in Program Files / AppData */
const leftoverOk = new Set<string>()

function expandEnv(s: string): string {
  return s.replace(/%([^%]+)%/g, (m, name: string) => process.env[name] ?? m)
}

/** `"C:\a b\x.exe" /S` → exe + args. Also handles unquoted paths with spaces. */
export function splitCommand(cmd: string): Command | null {
  const s = expandEnv(cmd).trim()
  if (!s) return null
  if (s.startsWith('"')) {
    const end = s.indexOf('"', 1)
    if (end < 0) return null
    return { exe: s.slice(1, end), args: s.slice(end + 1).trim() }
  }
  const m = /^(.+?\.exe)(?=\s|$)(.*)$/i.exec(s)
  if (m) return { exe: m[1], args: m[2].trim() }
  const sp = s.indexOf(' ')
  return sp < 0 ? { exe: s, args: '' } : { exe: s.slice(0, sp), args: s.slice(sp + 1).trim() }
}

/** Folders that are never "the folder of one app" (an uninstaller lying there would mean the whole folder). */
function broadFolders(): Set<string> {
  const p = places()
  const local = process.env.LOCALAPPDATA ?? ''
  const roaming = process.env.APPDATA ?? ''
  return new Set(
    [
      p.windows, p.programData, p.profile, ...p.programFiles, ...p.appData, ...p.known, ...p.oneDrive,
      join(local, 'Programs'), join(local, 'Microsoft'), join(roaming, 'Microsoft'), join(local, 'Temp'),
      ...p.programFiles.map((x) => join(x, 'Common Files'))
    ].map(normPath)
  )
}

const NOT_APP_DIR = /\\(system32|syswow64|installer|package cache|windowsapps|temp)(\\|$)/i

function appFolder(dir: string | null | undefined, broad: Set<string>): string | null {
  if (!dir) return null
  const d = dir.replace(/[\\/]+$/, '')
  if (!/^[a-z]:\\./i.test(d) || NOT_APP_DIR.test(d) || broad.has(normPath(d))) return null
  try {
    return statSync(d).isDirectory() ? d : null
  } catch {
    return null
  }
}

function folderOfCommand(cmd: string): string | null {
  const c = splitCommand(cmd)
  if (!c) return null
  const exe = c.exe.replace(/,\s*-?\d+$/, '')
  return /^[a-z]:\\/i.test(exe) ? dirname(exe) : null
}

function parseDate(s: string): number | null {
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(s) ?? /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s)
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3])
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (m) return Date.UTC(+m[3], +m[1] - 1, +m[2])
  return null
}

function birth(dir: string | null): number | null {
  if (!dir) return null
  try {
    return Math.round(statSync(dir).birthtimeMs) || null
  } catch {
    return null
  }
}

function drive(dir: string | null): string | null {
  return dir && /^[a-z]:/i.test(dir) ? dir.slice(0, 2).toUpperCase() : null
}

function guid(s: string): string | null {
  return /\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}/i.exec(s)?.[0] ?? null
}

function fromRegistry(r: RegRow, steam: Map<string, SteamRow>, broad: Set<string>): AppEntry {
  const steamId = /^Steam App (\d+)$/i.exec(r.keyName)?.[1] ?? /steam:\/\/uninstall\/(\d+)/i.exec(r.uninstall)?.[1]
  const game = steamId ? steam.get(steamId) : undefined
  const location =
    appFolder(game?.dir, broad) ?? appFolder(r.location, broad) ?? appFolder(folderOfCommand(r.uninstall), broad) ?? appFolder(folderOfCommand(r.icon), broad)
  const kind: AppKind = steamId ? 'steam' : 'win32'

  let run = splitCommand(r.uninstall) ?? undefined
  let quietRun: Command | undefined
  const msiCode = /msiexec/i.test(r.uninstall) ? (guid(r.keyName) ?? guid(r.uninstall)) : null
  if (msiCode) {
    // "/I" opens "change or remove", "/X" removes
    run = { exe: 'msiexec.exe', args: `/x ${msiCode}` }
    quietRun = { exe: 'msiexec.exe', args: `/x ${msiCode} /qb REBOOT=ReallySuppress` }
  } else if (r.quiet) {
    quietRun = splitCommand(r.quiet) ?? undefined
  } else if (/_is1$/i.test(r.keyName) && run) {
    // Inno Setup: these switches skip the questions but still show the progress
    quietRun = { exe: run.exe, args: `${run.args} /SILENT /SUPPRESSMSGBOXES /NORESTART`.trim() }
  }

  const icon = splitCommand(r.icon)?.exe.replace(/,\s*-?\d+$/, '')
  const estimate = game && game.size > 0 ? game.size : r.size > 0 ? r.size : null
  return {
    id: r.key,
    name: r.name,
    publisher: r.publisher || null,
    version: r.version || null,
    kind,
    size: estimate,
    measured: false,
    installed: parseDate(r.date) ?? birth(location),
    lastUsed: game && game.last > 0 ? game.last * 1000 : null,
    location,
    drive: drive(location),
    quiet: !!quietRun,
    canUninstall: !r.noRemove && !/^iceboost$/i.test(r.name) && !!run,
    viaLauncher: kind === 'steam',
    extraDirs: game ? [join(dirname(game.manifest), 'downloading', game.appid)] : [],
    run: kind === 'steam' ? undefined : run,
    quietRun: kind === 'steam' ? undefined : quietRun,
    key: r.key,
    manifest: game?.manifest,
    steamId,
    iconFile: icon && /\.(exe|ico|dll)$/i.test(icon) && existsSync(icon) ? icon : undefined,
    exes: []
  }
}

export async function getApps(): Promise<InstalledApp[]> {
  const raw = parseJson<{ reg: RegRow[]; steam: SteamRow[]; epic: EpicRow[]; store: StoreRow[]; steamPath: string }>(
    await taskPs.run(APPS_PS, 120_000)
  )
  steamPath = raw.steamPath
  const broad = broadFolders()
  const steam = new Map((raw.steam ?? []).map((s) => [s.appid, s]))
  const next = new Map<string, AppEntry>()
  const names = new Set<string>()

  for (const r of raw.reg ?? []) {
    const a = fromRegistry(r, steam, broad)
    // the same program registered twice (64- and 32-bit keys)
    const dup = `${a.name}|${a.version ?? ''}`.toLowerCase()
    if (names.has(dup)) continue
    names.add(dup)
    if (a.steamId) steam.delete(a.steamId)
    next.set(a.id, a)
  }

  // Steam games without their own entry in the Windows list
  for (const g of steam.values()) {
    const location = appFolder(g.dir, broad)
    next.set(`steam:${g.appid}`, {
      id: `steam:${g.appid}`, name: g.name, publisher: null, version: null, kind: 'steam',
      size: g.size > 0 ? g.size : null, measured: false, installed: birth(location), lastUsed: g.last > 0 ? g.last * 1000 : null,
      location, drive: drive(location), quiet: false, canUninstall: true, viaLauncher: true,
      extraDirs: [join(dirname(g.manifest), 'downloading', g.appid)], manifest: g.manifest, steamId: g.appid, exes: []
    })
  }

  for (const e of raw.epic ?? []) {
    const location = appFolder(e.dir, broad)
    const exe = location && e.exe ? join(location, e.exe) : undefined
    next.set(`epic:${e.app}`, {
      id: `epic:${e.app}`, name: e.name, publisher: 'Epic Games', version: null, kind: 'epic',
      size: e.size > 0 ? e.size : null, measured: false, installed: birth(location), lastUsed: null,
      location, drive: drive(location), quiet: false, canUninstall: true, viaLauncher: true,
      extraDirs: [], manifest: e.manifest, epicId: e.app, iconFile: exe && existsSync(exe) ? exe : undefined, exes: []
    })
  }

  for (const s of raw.store ?? []) {
    next.set(`appx:${s.full}`, {
      id: `appx:${s.full}`, name: s.name, publisher: s.publisher || null, version: s.version || null, kind: 'store',
      size: null, measured: false, installed: s.installed || null, lastUsed: null,
      location: s.location, drive: drive(s.location), quiet: true, canUninstall: true, viaLauncher: false,
      extraDirs: [], store: { full: s.full, name: s.pkgName }, iconFile: s.logo || undefined, exes: []
    })
  }

  // keep what the last scan measured, so "Refresh" doesn't wipe sizes
  for (const [id, a] of next) {
    const old = apps.get(id)
    if (old?.measured) Object.assign(a, { size: old.size, measured: true, lastUsed: old.lastUsed, exes: old.exes })
  }
  apps = next
  return [...next.values()].map(toPublic)
}

function toPublic(a: AppEntry): InstalledApp {
  return {
    id: a.id, name: a.name, publisher: a.publisher, version: a.version, kind: a.kind, size: a.size, measured: a.measured,
    installed: a.installed, lastUsed: a.lastUsed, location: a.location, drive: a.drive, quiet: a.quiet,
    canUninstall: a.canUninstall, viaLauncher: a.viaLauncher
  }
}

/** Measures app folders and looks up when each app was last started (Prefetch, BAM, UserAssist). */
export async function scanApps(): Promise<AppScan[]> {
  if (apps.size === 0) await getApps()
  const list = [...apps.values()].filter((a) => a.location)
  const skips = list.map((a) => a.location!)
  // Steam's own folder: games, downloads and workshop items inside belong to the games
  if (steamPath) skips.push(join(steamPath, 'steamapps'))
  const res = await runJob<{ id: string; size: number; last: number; exes: string[] }[]>(
    'apps',
    `[IceSpace]::StartApps(${psArr(list.map((a) => a.id))}, ${psArr(list.map((a) => [a.location!, ...a.extraDirs].join('|')))}, ${psArr(skips)})`
  )
  for (const r of res ?? []) {
    const a = apps.get(r.id)
    if (!a) continue
    if (r.size >= 0) {
      a.size = r.size
      a.measured = true
    }
    if (r.last > 0 && r.last > (a.lastUsed ?? 0)) a.lastUsed = r.last
    a.exes = r.exes ?? []
  }
  return [...apps.values()].map((a) => ({ id: a.id, size: a.size, lastUsed: a.lastUsed }))
}

const simple = (s: string): string => s.toLowerCase().replace(/[^a-z0-9а-яё]/g, '')

function iconFor(a: AppEntry): string | null {
  if (a.iconFile) return a.iconFile
  // the exe that looks like the app's name, or the one closest to the top of its folder
  const want = simple(a.name.split(/\s+/)[0] ?? '')
  const exe = a.exes.find((e) => want.length > 2 && simple(basename(e, '.exe')).includes(want)) ?? a.exes[0]
  if (exe) return exe
  if (a.run && /^[a-z]:\\/i.test(a.run.exe) && existsSync(a.run.exe)) return a.run.exe
  return null
}

export async function getAppIcons(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  await Promise.all(
    ids.map(async (id) => {
      const a = apps.get(id)
      const file = a && iconFor(a)
      if (!file) return
      try {
        const img = /\.(png|jpe?g)$/i.test(file) ? nativeImage.createFromPath(file) : await app.getFileIcon(file, { size: 'large' })
        if (!img.isEmpty()) out[id] = img.resize({ width: 32, height: 32, quality: 'best' }).toDataURL()
      } catch {
        // no icon — the list shows the first letter
      }
    })
  )
  return out
}

export async function uninstallApp(id: string, quiet: boolean): Promise<OpResult> {
  const a = apps.get(id)
  if (!a || !a.canUninstall) return { ok: false, error: 'NOT_FOUND' }
  try {
    if (a.store) {
      await taskPs.run(`Remove-AppxPackage -Package ${psStr(a.store.full)} -ErrorAction Stop; 'ok'`, 300_000)
      return { ok: true }
    }
    if (a.steamId) {
      await shell.openExternal(`steam://uninstall/${a.steamId}`)
      return { ok: true }
    }
    if (a.epicId) {
      // Epic has no "uninstall" link: open the launcher, the page says where to click
      await shell.openExternal('com.epicgames.launcher://store')
      return { ok: true }
    }
    const cmd = (quiet && a.quietRun) || a.run
    if (!cmd) return { ok: false, error: 'NO_UNINSTALLER' }
    if (/^[a-z]:\\/i.test(cmd.exe) && !existsSync(cmd.exe)) return { ok: false, error: 'NO_UNINSTALLER' }
    // started, not waited for: many uninstallers restart themselves from a temp folder.
    // The page checks appInstalled() until the program disappears from the list.
    const viaPs = (): Promise<unknown> =>
      taskPs.run(`Start-Process -FilePath ${psStr(cmd.exe)}${cmd.args ? ` -ArgumentList ${psStr(cmd.args)}` : ''} -ErrorAction Stop | Out-Null; 'ok'`)
    // console uninstallers (scripts, winget) need a console window — Windows gives them one this way.
    // If a windowed one wants admin rights IceBoost doesn't have, Windows asks for them this way too.
    if (isConsoleProgram(cmd.exe)) await viaPs()
    else await launch(cmd).catch(viaPs)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/** The full path of a program like "msiexec.exe" or "winget" (searched in PATH like Windows does). */
function findProgram(exe: string): string | null {
  if (/^[a-z]:\\/i.test(exe)) return existsSync(exe) ? exe : null
  const names = /\.[a-z0-9]{3}$/i.test(exe) ? [exe] : [`${exe}.exe`, `${exe}.com`]
  for (const dir of (process.env.PATH ?? '').split(';').filter(Boolean)) {
    for (const n of names) if (existsSync(join(dir, n))) return join(dir, n)
  }
  return null
}

/** Reads the "subsystem" from the .exe header: 3 = console program. Unknown/scripts count as console. */
function isConsoleProgram(exe: string): boolean {
  const file = findProgram(exe)
  if (!file || !/\.(exe|com)$/i.test(file)) return true
  try {
    const buf = Buffer.alloc(1024)
    const fd = openSync(file, 'r')
    try {
      readSync(fd, buf, 0, buf.length, 0)
    } finally {
      closeSync(fd)
    }
    const pe = buf.readUInt32LE(0x3c)
    if (pe + 24 + 70 > buf.length || buf.toString('latin1', pe, pe + 4) !== 'PE\0\0') return true
    return buf.readUInt16LE(pe + 24 + 68) === 3
  } catch {
    return true
  }
}

/**
 * Starts a program from IceBoost itself (not from a background PowerShell), so Windows lets its
 * window come to the front instead of hiding it behind IceBoost.
 */
function launch(cmd: Command): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // the arguments go as written in the registry; argv0 is quoted because of spaces in paths
      const p = spawn(cmd.exe, cmd.args ? [cmd.args] : [], {
        detached: true,
        stdio: 'ignore',
        windowsVerbatimArguments: true,
        argv0: `"${cmd.exe}"`
      })
      p.once('error', reject)
      p.once('spawn', () => {
        p.unref()
        resolve()
      })
    } catch (e) {
      reject(e)
    }
  })
}

export async function appInstalled(id: string): Promise<boolean> {
  const a = apps.get(id)
  if (!a) return false
  if (a.manifest) return existsSync(a.manifest)
  if (a.store) return (await taskPs.run(`[bool](Get-AppxPackage -Name ${psStr(a.store.name)} -ErrorAction SilentlyContinue)`)).trim() === 'True'
  if (a.key) return (await taskPs.run(`Test-Path -LiteralPath ${psStr(`Registry::${a.key}`)}`)).trim() === 'True'
  return false
}

// names too common to mean "this app's folder"
const GENERIC_NAMES = new Set(
  [
    'microsoft', 'microsoft corporation', 'google', 'mozilla', 'intel', 'amd', 'nvidia', 'nvidia corporation', 'apple', 'adobe',
    'windows', 'programs', 'packages', 'temp', 'common files', 'launcher', 'game', 'games', 'my games', 'app', 'apps', 'data',
    'cache', 'update', 'updater', 'bin', 'x64', 'x86', 'electron', 'crashpad', 'squirrel', 'roaming', 'local', 'locallow',
    'users', 'public', 'documents', 'downloads', 'desktop', 'steam', 'steamapps', 'common', 'software', 'tools', 'default', 'user'
  ].map(simple)
)

function cleanName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)/g, ' ')
    .replace(/\s+v?\d+(\.\d+)+.*$/i, '')
    .replace(/\s+(x64|x86|64-bit|32-bit)$/i, '')
    .replace(/\s+for\s+\S+$/i, '')
    .trim()
}

/** After an uninstall: the app's folder if it's still there, and its settings/cache folders by exact name. */
export async function findLeftovers(id: string): Promise<Leftover[]> {
  const a = apps.get(id)
  if (!a || a.store) return []
  const pl = places()
  const env = process.env
  const others = [...apps.values()].filter((o) => o.id !== id && o.location).map((o) => o.location!)
  const found = new Map<string, Leftover['kind']>()
  if (a.location) found.set(a.location, 'install')
  for (const d of a.extraDirs) found.set(d, 'install')

  const names = uniq([a.location ? basename(a.location) : null, cleanName(a.name)]).filter(
    (n) => simple(n).length >= 4 && !GENERIC_NAMES.has(simple(n))
  )
  const publisher = a.publisher ? cleanName(a.publisher.replace(/,?\s*(inc|llc|ltd|gmbh|corp(oration)?)\.?$/i, '')) : ''
  const bases = uniq([
    env.APPDATA, env.LOCALAPPDATA, env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Programs'), env.USERPROFILE && join(env.USERPROFILE, 'AppData', 'LocalLow'),
    pl.programData, ...pl.programFiles
  ])
  const withPublisher = publisher && simple(publisher).length >= 3 && !GENERIC_NAMES.has(simple(publisher)) ? bases.map((b) => join(b, publisher)) : []
  for (const base of [...bases, ...withPublisher]) for (const n of names) if (!found.has(join(base, n))) found.set(join(base, n), 'data')

  const candidates = [...found].filter(
    ([p]) => existsSync(p) && leftoverAllowed(p, pl) && !others.some((o) => isInside(o, p) || isInside(p, o))
  )
  if (candidates.length === 0) return []
  const out = await diskPs.run(`${ENSURE}\n${psArr(candidates.map(([p]) => p))} | ForEach-Object { [IceSpace]::Size($_) }`, 120_000)
  const sizes = out.split(/\r?\n/).map((x) => Number(x.trim()))
  const res: Leftover[] = []
  candidates.forEach(([path, kind], i) => {
    if (!(sizes[i] >= 0)) return
    leftoverOk.add(normPath(path))
    res.push({ path, size: sizes[i], kind })
  })
  return res.sort((x, y) => y.size - x.size)
}

// ---------------------------------------------------------------- big and old files

export async function scanFiles(extraRoots: string[]): Promise<FileScan> {
  const pl = places()
  if (apps.size === 0) await getApps().catch(() => {})
  // the user's folder covers Desktop/Documents/Downloads, unless Windows moved them to another disk
  const roots = uniq([pl.profile, ...pl.known, ...pl.oneDrive, ...extraRoots.filter((r) => existsSync(r))]).filter(
    (r, _i, all) => !all.some((o) => o !== r && isInside(r, o))
  )
  // programs keep their own big files; AppData is for the Cleaner page
  const skips = uniq([
    ...[...apps.values()].map((a) => a.location),
    ...pl.appData,
    pl.windows,
    ...pl.programFiles,
    pl.programData,
    steamPath && join(steamPath, 'steamapps')
  ])
  const MB = 1024 * 1024
  const res = await runJob<{ scanned: number; files: { p: string; s: number; w: number; c: number; a: number; d: string | null; x: boolean }[] }>(
    'files',
    `[IceSpace]::StartFiles(${psArr(roots)}, ${psArr(skips)}, ${psArr(['AppData', 'node_modules', 'Application Data', '$Recycle.Bin', 'System Volume Information', 'steamapps', 'SteamLibrary'])}, ${10 * MB}, ${10 * MB})`
  )
  const accessTime = await lastAccessOn()
  const all = res?.files ?? []
  const inApp = all.filter((f) => f.x)
  const files: BigFile[] = all.filter((f) => !f.x).map((f) => ({
    path: f.p,
    size: f.s,
    modified: f.w,
    lastUsed: Math.max(f.w, f.c, accessTime ? f.a : 0),
    copyOf: f.d
  }))
  return {
    files, scanned: res?.scanned ?? 0, roots, accessTime, at: Date.now(),
    inApps: { files: inApp.length, size: inApp.reduce((a, f) => a + f.s, 0) }
  }
}

/** Windows may not remember when a file was opened (NtfsDisableLastAccessUpdate, low bit = off). */
async function lastAccessOn(): Promise<boolean> {
  try {
    const out = await monitorPs.run(
      `(Get-ItemProperty -LiteralPath 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem' -ErrorAction Stop).NtfsDisableLastAccessUpdate`
    )
    const v = Number(out.trim())
    return Number.isFinite(v) && (v & 1) === 0
  } catch {
    return false
  }
}

// ---------------------------------------------------------------- disk map

interface RawLevel {
  path: string
  size: number
  files: number
  otherSize: number
  otherFiles: number
  dirs: { n: string; s: number; f: number; x: boolean }[]
  top: { n: string; s: number }[]
}

function toLevel(r: RawLevel | null): MapLevel | null {
  if (!r) return null
  const base = `${r.path}\\`
  const items: MapItem[] = [
    ...r.dirs.map((d) => ({ name: d.n, path: base + d.n, size: d.s, files: d.f, dir: true, denied: d.x || undefined })),
    ...r.top.map((f) => ({ name: f.n, path: base + f.n, size: f.s, files: 1, dir: false }))
  ]
  if (r.otherSize > 0) items.push({ name: '', path: `${base}*`, size: r.otherSize, files: r.otherFiles, dir: false, special: 'other' })
  items.sort((a, b) => b.size - a.size)
  return { path: r.path, size: r.size, files: r.files, items }
}

export async function scanMap(root: string): Promise<MapLevel> {
  const r = await runJob<RawLevel | null>('map', `[IceSpace]::StartMap(${psStr(root)})`)
  const level = toLevel(r)
  if (!level) throw new Error('CANCELLED')
  return level
}

export async function mapLevel(path: string): Promise<MapLevel | null> {
  const out = await diskPs.run(`if ('IceSpace' -as [type]) { [IceSpace]::Level(${psStr(path)}) } else { 'null' }`)
  return toLevel(parseJson<RawLevel | null>(out))
}

// ---------------------------------------------------------------- Recycle Bin, Explorer

export async function trashPaths(paths: string[]): Promise<TrashResult> {
  const pl = places()
  const appDirs = [...apps.values()].map((a) => a.location).filter((x): x is string => !!x)
  const res: TrashResult = { movedPaths: [], moved: 0, failed: 0, size: 0, refused: [] }
  const ok: string[] = []
  for (const p of paths) {
    // the final check: the UI also hides the button, but nothing protected leaves here
    const allowed = leftoverOk.has(normPath(p)) ? leftoverAllowed(p, pl) : lockReason(p, pl, appDirs) === null
    if (allowed && /^[a-z]:\\./i.test(p)) ok.push(p)
    else res.refused.push(p)
  }
  if (ok.length === 0) return res
  const out = await diskPs.run(
    `${ENSURE}\n${psArr(ok)} | ForEach-Object { if (Test-Path -LiteralPath $_ -PathType Container) { [IceSpace]::Size($_) } else { try { (Get-Item -LiteralPath $_ -Force).Length } catch { 0 } } }`,
    120_000
  )
  const sizes = out.split(/\r?\n/).map((x) => Math.max(0, Number(x.trim()) || 0))
  for (let i = 0; i < ok.length; i++) {
    try {
      await shell.trashItem(ok[i])
      res.moved++
      res.movedPaths.push(ok[i])
      res.size += sizes[i] ?? 0
      leftoverOk.delete(normPath(ok[i]))
    } catch {
      res.failed++
    }
  }
  return res
}

export async function showInFolder(path: string): Promise<void> {
  shell.showItemInFolder(path)
}

export async function pickFolder(): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
  return r.canceled ? null : (r.filePaths[0] ?? null)
}

export async function openStorageSettings(): Promise<void> {
  await shell.openExternal('ms-settings:storagesense')
}

// ---------------------------------------------------------------- dev self-test

/** Scans a throwaway folder with the real engine: big files, copies, disk map. */
export async function _selfTestFiles(dir: string): Promise<unknown> {
  const MB = 1024 * 1024
  const files = await runJob<{ scanned: number; files: { p: string; s: number; d: string | null; x: boolean }[] }>(
    'files',
    `[IceSpace]::StartFiles(${psArr([dir])}, @(), @('skipme'), ${1 * MB}, ${1 * MB})`
  )
  const map = await scanMap(dir)
  const sub = await mapLevel(join(dir, 'sub'))
  return {
    found: files.files.map((f) => ({ name: basename(f.p), size: f.s, copy: !!f.d, inApp: f.x })),
    map: map.items.map((i) => `${i.dir ? 'dir' : 'file'}:${i.name || i.special}:${i.size}`),
    sub: sub?.items.map((i) => i.name || i.special)
  }
}
