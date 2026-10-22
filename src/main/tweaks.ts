// Applies / undoes Windows tweaks. Before the first change of a tweak we save the
// current values to backup.json, so "undo" puts back exactly what was there.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { TWEAKS, type Tweak, type TweakOp } from '../shared/tweaks'
import type { OpResult, RestorePointResult, TweakState } from '../shared/types'
import { isAdmin, parseJson, psValue, runElevated, taskPs, UAC_DENIED } from './ps'

const BALANCED = '381b4222-f694-41f0-9685-ff5bb260df2e'
const POWER_SAVER = 'a1841308-3541-4fab-bc81-f71556f20b4a'

type Snapshot = {
  exists?: boolean
  value?: unknown
  type?: string
  startType?: string
  guid?: string
  on?: boolean
}

type BackupEntry = { ops: Snapshot[]; createdScheme?: string }

// Shape sent to the write script
type WriteOp =
  | { kind: 'reg'; key: string; name: string; type: string; value: unknown }
  | { kind: 'service'; name: string; startType: string }
  | { kind: 'power'; guid?: string; deleteGuid?: string }
  | { kind: 'hibernate'; on: boolean }

// ---- backup file

function backupPath(): string {
  return join(app.getPath('userData'), 'backup.json')
}

function loadBackups(): Record<string, BackupEntry> {
  try {
    if (existsSync(backupPath())) return JSON.parse(readFileSync(backupPath(), 'utf8'))
  } catch {
    // broken file: start fresh
  }
  return {}
}

function saveBackups(b: Record<string, BackupEntry>): void {
  writeFileSync(backupPath(), JSON.stringify(b, null, 2), 'utf8')
}

// ---- PowerShell parts

const READ_SCRIPT = (ops: TweakOp[]): string => `
$ops = ${psValue(ops)}
$res = foreach ($op in $ops) {
  switch ($op.kind) {
    'reg' {
      $k = Get-Item -LiteralPath $op.key -ErrorAction SilentlyContinue
      if ($k -and ($k.GetValueNames() -contains $op.name)) {
        @{ exists = $true; value = $k.GetValue($op.name, $null, 'DoNotExpandEnvironmentNames'); type = $k.GetValueKind($op.name).ToString() }
      } else { @{ exists = $false } }
    }
    'service' {
      $s = Get-Service -Name $op.name -ErrorAction SilentlyContinue
      if ($s) { @{ exists = $true; startType = $s.StartType.ToString() } } else { @{ exists = $false } }
    }
    'power' {
      $t = powercfg /getactivescheme | Out-String
      if ($t -match '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})') { @{ guid = $Matches[1].ToLower() } } else { @{ guid = '' } }
    }
    'hibernate' {
      $v = (Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power' -ErrorAction SilentlyContinue).HibernateEnabled
      if ($null -eq $v) { @{ on = (Test-Path -LiteralPath ($env:SystemDrive + '\\hiberfil.sys')) } } else { @{ on = ($v -eq 1) } }
    }
  }
}
ConvertTo-Json -InputObject @($res) -Depth 4 -Compress
`

const WRITE_SCRIPT = (ops: WriteOp[]): string => `
$ops = ${psValue(ops)}
$res = foreach ($op in $ops) {
  $created = $null
  try {
    switch ($op.kind) {
      'reg' {
        if ($null -eq $op.value) {
          if (Test-Path -LiteralPath $op.key) { Remove-ItemProperty -LiteralPath $op.key -Name $op.name -ErrorAction SilentlyContinue }
        } else {
          if (-not (Test-Path -LiteralPath $op.key)) { New-Item -Path $op.key -Force -ErrorAction Stop | Out-Null }
          $v = $op.value
          switch ($op.type) {
            'DWord' { $v = [int]$v }
            'QWord' { $v = [int64]$v }
            'Binary' { $v = [byte[]]$v }
            'MultiString' { $v = [string[]]$v }
            default { $v = [string]$v }
          }
          New-ItemProperty -LiteralPath $op.key -Name $op.name -PropertyType $op.type -Value $v -Force -ErrorAction Stop | Out-Null
        }
      }
      'service' {
        if (Get-Service -Name $op.name -ErrorAction SilentlyContinue) {
          Set-Service -Name $op.name -StartupType $op.startType -ErrorAction Stop
          if ($op.startType -eq 'Disabled') { Stop-Service -Name $op.name -Force -ErrorAction SilentlyContinue }
          elseif ($op.startType -eq 'Automatic') { Start-Service -Name $op.name -ErrorAction SilentlyContinue }
        }
      }
      'power' {
        if ($op.guid) {
          powercfg /setactive $op.guid | Out-Null
          if ($LASTEXITCODE -ne 0) { throw 'powercfg /setactive failed' }
          if ($op.deleteGuid) { powercfg /delete $op.deleteGuid | Out-Null }
        } else {
          $ult = 'e9a42b02-d5df-448d-aa00-03f14749eb61'
          $t = powercfg -duplicatescheme $ult 2>&1 | Out-String
          if ($t -match '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})' -and $Matches[1].ToLower() -ne $ult) {
            $created = $Matches[1].ToLower()
            powercfg /setactive $created | Out-Null
          } else {
            # no "Ultimate" plan on this Windows: use "High performance"
            powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c | Out-Null
          }
          if ($LASTEXITCODE -ne 0) { throw 'powercfg /setactive failed' }
        }
      }
      'hibernate' {
        if ($op.on) { powercfg /hibernate on | Out-Null } else { powercfg /hibernate off | Out-Null }
        if ($LASTEXITCODE -ne 0) { throw 'powercfg /hibernate failed' }
      }
    }
    @{ ok = $true; created = $created }
  } catch {
    @{ ok = $false; error = $_.Exception.Message }
  }
}
ConvertTo-Json -InputObject @($res) -Depth 3 -Compress
`

type WriteResult = { ok: boolean; error?: string; created?: string | null }

async function readOps(ops: TweakOp[]): Promise<Snapshot[]> {
  if (ops.length === 0) return []
  return parseJson<Snapshot[]>(await taskPs.run(READ_SCRIPT(ops)))
}

async function writeOps(ops: WriteOp[], needAdmin: boolean): Promise<WriteResult[]> {
  if (ops.length === 0) return []
  const script = WRITE_SCRIPT(ops)
  const out = needAdmin && !(await isAdmin()) ? await runElevated(script) : await taskPs.run(script, 120_000)
  return parseJson<WriteResult[]>(out)
}

export const _readOps = readOps
export const _writeOps = (ops: WriteOp[], admin: boolean): Promise<WriteResult[]> => writeOps(ops, admin)

function isApplied(op: TweakOp, s: Snapshot | undefined): boolean {
  if (!s) return false
  switch (op.kind) {
    case 'reg':
      return !!s.exists && String(s.value) === String(op.value)
    case 'service':
      return !s.exists || s.startType === op.startType
    case 'power':
      return !!s.guid && s.guid !== BALANCED && s.guid !== POWER_SAVER
    case 'hibernate':
      return s.on === false
  }
}

function targetOp(op: TweakOp): WriteOp {
  switch (op.kind) {
    case 'reg':
      return { kind: 'reg', key: op.key, name: op.name, type: op.type, value: op.value }
    case 'service':
      return { kind: 'service', name: op.name, startType: op.startType }
    case 'power':
      return { kind: 'power' }
    case 'hibernate':
      return { kind: 'hibernate', on: false }
  }
}

function undoOp(op: TweakOp, b: BackupEntry | undefined, i: number): WriteOp | null {
  const s = b?.ops[i]
  switch (op.kind) {
    case 'reg':
      if (s) return { kind: 'reg', key: op.key, name: op.name, type: s.type ?? op.type, value: s.exists ? s.value : null }
      return { kind: 'reg', key: op.key, name: op.name, type: op.type, value: op.def }
    case 'service':
      if (s && !s.exists) return null
      return { kind: 'service', name: op.name, startType: s?.startType ?? op.def }
    case 'power':
      return { kind: 'power', guid: s?.guid || BALANCED, deleteGuid: b?.createdScheme }
    case 'hibernate':
      return { kind: 'hibernate', on: s ? !!s.on : true }
  }
}

function split(list: Tweak[]): [Tweak[], Tweak[]] {
  return [list.filter((t) => !t.admin), list.filter((t) => t.admin)]
}

export async function getTweaks(): Promise<TweakState[]> {
  const snaps = await readOps(TWEAKS.flatMap((t) => t.ops))
  const backups = loadBackups()
  let i = 0
  return TWEAKS.map((t) => {
    const s = snaps.slice(i, (i += t.ops.length))
    return { id: t.id, applied: t.ops.every((op, k) => isApplied(op, s[k])), hasBackup: !!backups[t.id] }
  })
}

/** Runs a batch of tweaks (user-level ones and admin ones separately) and reports per tweak. */
async function runBatch(
  list: Tweak[],
  build: (t: Tweak) => WriteOp[],
  onOk: (t: Tweak, results: WriteResult[]) => void
): Promise<Record<string, OpResult>> {
  const result: Record<string, OpResult> = {}
  for (const [group, needAdmin] of split(list).map((g, i) => [g, i === 1] as const)) {
    if (group.length === 0) continue
    const perTweak = group.map(build)
    let res: WriteResult[]
    try {
      res = await writeOps(perTweak.flat(), needAdmin)
    } catch (e) {
      const msg = (e as Error).message
      for (const t of group) result[t.id] = { ok: false, error: msg === UAC_DENIED ? UAC_DENIED : msg }
      continue
    }
    let i = 0
    group.forEach((t, k) => {
      const r = res.slice(i, (i += perTweak[k].length))
      const bad = r.find((x) => !x.ok)
      if (bad) result[t.id] = { ok: false, error: bad.error }
      else {
        onOk(t, r)
        result[t.id] = { ok: true }
      }
    })
  }
  return result
}

export async function applyTweaks(ids: string[]): Promise<Record<string, OpResult>> {
  const list = TWEAKS.filter((t) => ids.includes(t.id))
  const backups = loadBackups()
  const snaps = await readOps(list.flatMap((t) => t.ops))
  const before: Record<string, Snapshot[]> = {}
  let i = 0
  for (const t of list) before[t.id] = snaps.slice(i, (i += t.ops.length))

  const result = await runBatch(
    list,
    (t) => t.ops.map(targetOp),
    (t, r) => {
      if (!backups[t.id]) backups[t.id] = { ops: before[t.id] }
      const created = r.find((x) => x.created)?.created
      if (created) backups[t.id].createdScheme = created
    }
  )
  saveBackups(backups)
  return result
}

export async function revertTweaks(ids: string[]): Promise<Record<string, OpResult>> {
  const list = TWEAKS.filter((t) => ids.includes(t.id))
  const backups = loadBackups()
  const result = await runBatch(
    list,
    (t) => t.ops.map((op, k) => undoOp(op, backups[t.id], k)).filter((x): x is WriteOp => x !== null),
    (t) => {
      delete backups[t.id]
    }
  )
  saveBackups(backups)
  return result
}

export async function createRestorePoint(): Promise<RestorePointResult> {
  try {
    const out = await runElevated(
      `
try { Enable-ComputerRestore -Drive ($env:SystemDrive + '\\') -ErrorAction Stop } catch {}
$w = $null
Checkpoint-Computer -Description 'IceBoost' -RestorePointType 'MODIFY_SETTINGS' -ErrorAction Stop -WarningVariable w -WarningAction SilentlyContinue
if ($w) { 'limit' } else { 'created' }
`,
      600_000
    )
    return { status: out.trim() === 'limit' ? 'limit' : 'created' }
  } catch (e) {
    return { status: 'error', error: (e as Error).message }
  }
}
