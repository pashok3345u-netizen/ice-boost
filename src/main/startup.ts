// Startup apps. Turning one off works exactly like Task Manager does it
// (StartupApproved flags), so nothing is deleted and Task Manager shows the same state.
import type { OpResult, StartupItem, StartupSource } from '../shared/types'
import { isAdmin, parseJson, psStr, runElevated, taskPs, UAC_DENIED } from './ps'

const APPROVED = 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved'

const SOURCES: Record<StartupSource, { approved: string; admin: boolean }> = {
  HKCU: { approved: `HKCU:\\${APPROVED}\\Run`, admin: false },
  HKLM: { approved: `HKLM:\\${APPROVED}\\Run`, admin: true },
  HKLM32: { approved: `HKLM:\\${APPROVED}\\Run32`, admin: true },
  FolderUser: { approved: `HKCU:\\${APPROVED}\\StartupFolder`, admin: false },
  FolderAll: { approved: `HKLM:\\${APPROVED}\\StartupFolder`, admin: true }
}

export async function getStartup(): Promise<StartupItem[]> {
  const out = await taskPs.run(`
function Get-Approved($ap, $name) {
  $k = Get-Item -LiteralPath $ap -ErrorAction SilentlyContinue
  if ($k -and ($k.GetValueNames() -contains $name)) {
    $b = $k.GetValue($name)
    if ($b -is [byte[]] -and $b.Length -gt 0) { return (($b[0] % 2) -eq 0) }
  }
  return $true
}
function Get-ExeInfo($cmd) {
  $exe = $null
  if ($cmd -match '^\\s*"([^"]+)"') { $exe = $Matches[1] }
  elseif ($cmd -match '^\\s*(.+?\\.exe)') { $exe = $Matches[1] }
  if ($exe) { $exe = [Environment]::ExpandEnvironmentVariables($exe) }
  try {
    if ($exe -and (Test-Path -LiteralPath $exe)) {
      $vi = (Get-Item -LiteralPath $exe).VersionInfo
      return @{ desc = "$($vi.FileDescription)".Trim(); company = "$($vi.CompanyName)".Trim() }
    }
  } catch {}
  return @{ desc = ''; company = '' }
}
$items = @()
$runs = @(
  @{ src = 'HKCU'; run = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'; ap = ${psStr(SOURCES.HKCU.approved)}; admin = $false },
  @{ src = 'HKLM'; run = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'; ap = ${psStr(SOURCES.HKLM.approved)}; admin = $true },
  @{ src = 'HKLM32'; run = 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run'; ap = ${psStr(SOURCES.HKLM32.approved)}; admin = $true }
)
foreach ($s in $runs) {
  $k = Get-Item -LiteralPath $s.run -ErrorAction SilentlyContinue
  if (-not $k) { continue }
  foreach ($n in $k.GetValueNames()) {
    if (-not $n) { continue }
    $cmd = "$($k.GetValue($n))"
    $info = Get-ExeInfo $cmd
    $items += @{ source = $s.src; name = $n; command = $cmd; enabled = (Get-Approved $s.ap $n); admin = $s.admin; desc = $info.desc; company = $info.company }
  }
}
$folders = @(
  @{ src = 'FolderUser'; dir = [Environment]::GetFolderPath('Startup'); ap = ${psStr(SOURCES.FolderUser.approved)}; admin = $false },
  @{ src = 'FolderAll'; dir = [Environment]::GetFolderPath('CommonStartup'); ap = ${psStr(SOURCES.FolderAll.approved)}; admin = $true }
)
$sh = New-Object -ComObject WScript.Shell
foreach ($f in $folders) {
  if (-not $f.dir -or -not (Test-Path -LiteralPath $f.dir)) { continue }
  foreach ($file in @(Get-ChildItem -LiteralPath $f.dir -Force -File -ErrorAction SilentlyContinue)) {
    if ($file.Name -eq 'desktop.ini') { continue }
    $target = $file.FullName
    if ($file.Extension -eq '.lnk') { try { $t = $sh.CreateShortcut($file.FullName).TargetPath; if ($t) { $target = $t } } catch {} }
    $info = Get-ExeInfo ('"' + $target + '"')
    $items += @{ source = $f.src; name = $file.Name; command = $target; enabled = (Get-Approved $f.ap $file.Name); admin = $f.admin; desc = $info.desc; company = $info.company }
  }
}
ConvertTo-Json -InputObject @($items) -Compress
`)
  const admin = await isAdmin()
  const rows = parseJson<Omit<StartupItem, 'id'>[]>(out)
  return rows.map((r) => ({
    ...r,
    id: `${r.source}::${r.name}`,
    admin: r.admin && !admin,
    desc: r.desc || null,
    company: r.company || null
  }))
}

export async function setStartup(id: string, enabled: boolean): Promise<OpResult> {
  const sep = id.indexOf('::')
  const source = id.slice(0, sep) as StartupSource
  const name = id.slice(sep + 2)
  const src = SOURCES[source]
  if (!src) return { ok: false, error: 'bad id' }
  const script = `
$ap = ${psStr(src.approved)}
if (-not (Test-Path -LiteralPath $ap)) { New-Item -Path $ap -Force | Out-Null }
if (${enabled ? '$true' : '$false'}) { $bytes = [byte[]](2,0,0,0,0,0,0,0,0,0,0,0) }
else { $bytes = [byte[]](@(3,0,0,0) + [BitConverter]::GetBytes([DateTime]::Now.ToFileTime())) }
New-ItemProperty -LiteralPath $ap -Name ${psStr(name)} -PropertyType Binary -Value $bytes -Force -ErrorAction Stop | Out-Null
'ok'
`
  try {
    if (src.admin && !(await isAdmin())) await runElevated(script)
    else await taskPs.run(script)
    return { ok: true }
  } catch (e) {
    const msg = (e as Error).message
    return { ok: false, error: msg === UAC_DENIED ? UAC_DENIED : msg }
  }
}
