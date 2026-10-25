// Junk file cleaning: temp files, caches, crash dumps, update leftovers, recycle bin.
import type { CleanResult, JunkResult } from '../shared/types'
import { isAdmin, parseJson, psValue, runElevated, taskPs, UAC_DENIED } from './ps'

interface PathGroup {
  label: string
  /** skip this group while the app is running (its files are in use) */
  process?: string
  paths: string[]
}

interface Category {
  id: string
  admin: boolean
  defaultOn: boolean
  /** only delete files older than this (hours) — protects files apps are using right now */
  minAgeHours: number
  groups: PathGroup[]
  recycle?: boolean
}

const chromium = (base: string): string[] => [
  `${base}\\User Data\\*\\Cache`,
  `${base}\\User Data\\*\\Code Cache`,
  `${base}\\User Data\\*\\GPUCache`
]

const CATEGORIES: Category[] = [
  { id: 'userTemp', admin: false, defaultOn: true, minAgeHours: 24, groups: [{ label: 'Temp', paths: ['%TEMP%'] }] },
  {
    id: 'winTemp', admin: true, defaultOn: true, minAgeHours: 24,
    groups: [{ label: 'Windows\\Temp', paths: ['%SystemRoot%\\Temp'] }]
  },
  {
    id: 'browsers', admin: false, defaultOn: true, minAgeHours: 0,
    groups: [
      { label: 'Google Chrome', process: 'chrome', paths: chromium('%LOCALAPPDATA%\\Google\\Chrome') },
      { label: 'Microsoft Edge', process: 'msedge', paths: chromium('%LOCALAPPDATA%\\Microsoft\\Edge') },
      { label: 'Yandex Browser', process: 'browser', paths: chromium('%LOCALAPPDATA%\\Yandex\\YandexBrowser') },
      { label: 'Brave', process: 'brave', paths: chromium('%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser') },
      {
        label: 'Opera / Opera GX', process: 'opera',
        paths: [
          '%LOCALAPPDATA%\\Opera Software\\Opera*\\Cache',
          '%APPDATA%\\Opera Software\\Opera*\\Code Cache',
          '%APPDATA%\\Opera Software\\Opera*\\GPUCache'
        ]
      },
      { label: 'Firefox', process: 'firefox', paths: ['%LOCALAPPDATA%\\Mozilla\\Firefox\\Profiles\\*\\cache2'] }
    ]
  },
  {
    id: 'apps', admin: false, defaultOn: true, minAgeHours: 0,
    groups: [
      {
        label: 'Discord', process: 'Discord',
        paths: ['%APPDATA%\\discord\\Cache', '%APPDATA%\\discord\\Code Cache', '%APPDATA%\\discord\\GPUCache']
      },
      { label: 'Steam', process: 'steam', paths: ['%LOCALAPPDATA%\\Steam\\htmlcache'] },
      { label: 'Spotify', process: 'Spotify', paths: ['%LOCALAPPDATA%\\Spotify\\Storage', '%LOCALAPPDATA%\\Spotify\\Data'] },
      { label: 'Epic Games', process: 'EpicGamesLauncher', paths: ['%LOCALAPPDATA%\\EpicGamesLauncher\\Saved\\webcache*'] }
    ]
  },
  {
    id: 'crashDumps', admin: false, defaultOn: true, minAgeHours: 0,
    groups: [{ label: 'Crash dumps', paths: ['%LOCALAPPDATA%\\CrashDumps', '%LOCALAPPDATA%\\Microsoft\\Windows\\WER'] }]
  },
  {
    id: 'winUpdate', admin: true, defaultOn: true, minAgeHours: 24,
    groups: [{ label: 'Windows Update', paths: ['%SystemRoot%\\SoftwareDistribution\\Download'] }]
  },
  {
    id: 'shaders', admin: false, defaultOn: false, minAgeHours: 0,
    groups: [
      { label: 'DirectX', paths: ['%LOCALAPPDATA%\\D3DSCache'] },
      {
        label: 'AMD',
        paths: ['%LOCALAPPDATA%\\AMD\\DxCache', '%LOCALAPPDATA%\\AMD\\DxcCache', '%LOCALAPPDATA%\\AMD\\VkCache', '%LOCALAPPDATA%\\AMD\\GLCache']
      },
      { label: 'NVIDIA', paths: ['%LOCALAPPDATA%\\NVIDIA\\DXCache', '%LOCALAPPDATA%\\NVIDIA\\GLCache'] },
      { label: 'Intel', paths: ['%LOCALAPPDATA%\\Intel\\ShaderCache'] }
    ]
  },
  { id: 'recycle', admin: false, defaultOn: true, minAgeHours: 0, recycle: true, groups: [] }
]

function expandEnv(p: string): string {
  return p.replace(/%([^%]+)%/g, (m, name: string) => process.env[name] ?? m)
}

function payload(cats: Category[]): unknown {
  return cats.map((c) => ({
    id: c.id,
    minAgeHours: c.minAgeHours,
    recycle: !!c.recycle,
    groups: c.groups.map((g) => ({ label: g.label, process: g.process ?? '', paths: g.paths.map(expandEnv) }))
  }))
}

// Shared PowerShell helpers: walk folders that match the patterns, measure or delete old files.
const HELPERS = `
function Get-Dirs($patterns) {
  foreach ($pat in $patterns) {
    Get-Item -Path $pat -Force -ErrorAction SilentlyContinue | Where-Object { $_.PSIsContainer } | ForEach-Object { $_.FullName }
  }
}
function Test-Denied($dir) {
  try { $null = [IO.Directory]::GetFileSystemEntries($dir); return $false } catch [UnauthorizedAccessException] { return $true } catch { return $false }
}
function Get-RecycleFiles {
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  foreach ($d in [IO.DriveInfo]::GetDrives()) {
    if ($d.DriveType -ne 'Fixed' -and $d.DriveType -ne 'Removable') { continue }
    $p = Join-Path $d.RootDirectory.FullName ('$Recycle.Bin\\' + $sid)
    if (Test-Path -LiteralPath $p) { Get-ChildItem -LiteralPath $p -Recurse -Force -File -ErrorAction SilentlyContinue }
  }
}
`

export async function scanJunk(): Promise<JunkResult[]> {
  const admin = await isAdmin()
  const out = await taskPs.run(
    `${HELPERS}
$cats = ${psValue(payload(CATEGORIES))}
$running = @{}
Get-Process | ForEach-Object { $running[$_.ProcessName.ToLower()] = 1 }
$res = foreach ($c in $cats) {
  $total = [int64]0; $files = 0; $denied = $false; $groups = @()
  $cutoff = (Get-Date).AddHours(-[double]$c.minAgeHours)
  if ($c.recycle) {
    $m = Get-RecycleFiles | Measure-Object Length -Sum
    $total = [int64]$m.Sum; $files = [int]$m.Count
  }
  foreach ($g in $c.groups) {
    $gs = [int64]0
    foreach ($d in @(Get-Dirs $g.paths)) {
      if (Test-Denied $d) { $denied = $true; continue }
      $m = Get-ChildItem -LiteralPath $d -Recurse -Force -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $cutoff } | Measure-Object Length -Sum
      $gs += [int64]$m.Sum; $files += [int]$m.Count
    }
    $total += $gs
    $isRunning = $g.process -and $running.ContainsKey($g.process.ToLower())
    if ($gs -gt 0 -or $isRunning) { $groups += @{ label = $g.label; size = $gs; running = [bool]$isRunning } }
  }
  @{ id = $c.id; size = $(if ($denied -and $total -eq 0) { $null } else { $total }); files = $files; groups = $groups }
}
ConvertTo-Json -InputObject @($res) -Depth 5 -Compress
`,
    180_000
  )
  const rows = parseJson<Omit<JunkResult, 'admin' | 'defaultOn'>[]>(out)
  return rows.map((r) => {
    const c = CATEGORIES.find((x) => x.id === r.id)!
    return {
      ...r,
      groups: r.groups ?? [],
      admin: c.admin && !admin,
      defaultOn: c.defaultOn,
      size: r.size === undefined ? null : r.size
    }
  })
}

function cleanScript(cats: Category[]): string {
  return `${HELPERS}
$cats = ${psValue(payload(cats))}
$running = @{}
Get-Process | ForEach-Object { $running[$_.ProcessName.ToLower()] = 1 }
$freed = [int64]0; $deleted = 0; $failed = 0; $skipped = @()
foreach ($c in $cats) {
  $cutoff = (Get-Date).AddHours(-[double]$c.minAgeHours)
  if ($c.recycle) {
    $m = Get-RecycleFiles | Measure-Object Length -Sum
    try { Clear-RecycleBin -Force -ErrorAction Stop; $freed += [int64]$m.Sum; $deleted += [int]$m.Count } catch {
      if ($m.Count -gt 0) { $failed += [int]$m.Count }
    }
  }
  foreach ($g in $c.groups) {
    if ($g.process -and $running.ContainsKey($g.process.ToLower())) { $skipped += $g.label; continue }
    foreach ($d in @(Get-Dirs $g.paths)) {
      foreach ($f in @(Get-ChildItem -LiteralPath $d -Recurse -Force -File -ErrorAction SilentlyContinue)) {
        if ($f.LastWriteTime -ge $cutoff) { continue }
        try {
          if ($f.IsReadOnly) { $f.IsReadOnly = $false }
          [IO.File]::Delete($f.FullName)
          $freed += $f.Length; $deleted++
        } catch { $failed++ }
      }
      # remove folders that became empty (deepest first), never the root itself
      Get-ChildItem -LiteralPath $d -Recurse -Force -Directory -ErrorAction SilentlyContinue |
        Sort-Object { $_.FullName.Length } -Descending | ForEach-Object {
          try { if (-not [IO.Directory]::EnumerateFileSystemEntries($_.FullName).GetEnumerator().MoveNext()) { [IO.Directory]::Delete($_.FullName) } } catch {}
        }
    }
  }
}
@{ freed = $freed; deleted = $deleted; failed = $failed; skipped = @($skipped | Select-Object -Unique) } | ConvertTo-Json -Compress
`
}

/** Bytes in the Recycle Bin (all drives). */
export async function recycleSize(): Promise<number> {
  const out = await taskPs.run(`${HELPERS}
[int64](Get-RecycleFiles | Measure-Object Length -Sum).Sum`)
  return Number(out.trim()) || 0
}

/** Dev self-test only: cleans one throwaway folder with the real cleaning script. */
export async function _cleanFolder(dir: string): Promise<CleanResult> {
  const cat: Category = { id: 'test', admin: false, defaultOn: false, minAgeHours: 0, groups: [{ label: 'test', paths: [dir] }] }
  return parseJson<CleanResult>(await taskPs.run(cleanScript([cat])))
}

export async function cleanJunk(ids: string[]): Promise<CleanResult> {
  const chosen = CATEGORIES.filter((c) => ids.includes(c.id))
  const admin = await isAdmin()
  const normal = admin ? chosen : chosen.filter((c) => !c.admin)
  const elevated = admin ? [] : chosen.filter((c) => c.admin)

  const total: CleanResult = { freed: 0, deleted: 0, failed: 0, skipped: [] }
  const add = (r: CleanResult): void => {
    total.freed += r.freed
    total.deleted += r.deleted
    total.failed += r.failed
    total.skipped.push(...(r.skipped ?? []))
  }
  if (normal.length) add(parseJson<CleanResult>(await taskPs.run(cleanScript(normal), 600_000)))
  if (elevated.length) {
    try {
      add(parseJson<CleanResult>(await runElevated(cleanScript(elevated), 600_000)))
    } catch (e) {
      if ((e as Error).message !== UAC_DENIED) throw e
      total.adminDenied = true
    }
  }
  total.skipped = [...new Set(total.skipped)]
  return total
}
