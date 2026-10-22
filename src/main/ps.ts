// Runs PowerShell for the app. A worker process stays alive and takes scripts
// one by one over stdin, so we don't pay PowerShell's start-up cost every time.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { app } from 'electron'

const PRELUDE = `
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$WarningPreference = 'SilentlyContinue'
$InformationPreference = 'SilentlyContinue'
$VerbosePreference = 'SilentlyContinue'
$NL = [string][char]10
`

// Protocol: one line in = base64(UTF-8 script); one line out = "@@" + base64("OK|ERR\\n" + text)
const WORKER_SCRIPT = `${PRELUDE}
$utf8 = New-Object System.Text.UTF8Encoding $false
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if ($line.Length -eq 0) { continue }
  try {
    $code = $utf8.GetString([Convert]::FromBase64String($line))
    $sb = [ScriptBlock]::Create($code)
    $out = (& $sb 2>$null | ForEach-Object { "$_" }) -join $NL
    $resp = "OK" + $NL + $out
  } catch {
    $resp = "ERR" + $NL + $_.Exception.Message
  }
  [Console]::Out.WriteLine("@@" + [Convert]::ToBase64String($utf8.GetBytes($resp)))
  [Console]::Out.Flush()
}
`

function workDir(): string {
  const dir = join(app.getPath('userData'), 'ps')
  mkdirSync(dir, { recursive: true })
  return dir
}

let workerPath: string | null = null
function getWorkerPath(): string {
  if (!workerPath) {
    workerPath = join(workDir(), 'worker.ps1')
    // BOM so Windows PowerShell 5.1 reads the file as UTF-8
    writeFileSync(workerPath, '﻿' + WORKER_SCRIPT, 'utf8')
  }
  return workerPath
}

interface Job {
  script: string
  timeoutMs: number
  resolve: (text: string) => void
  reject: (err: Error) => void
  timer?: NodeJS.Timeout
}

function parseResponse(text: string): { ok: boolean; body: string } {
  const nl = text.indexOf('\n')
  const status = nl < 0 ? text : text.slice(0, nl)
  const body = nl < 0 ? '' : text.slice(nl + 1)
  return { ok: status.trim() === 'OK', body }
}

class PsWorker {
  private proc: ChildProcessWithoutNullStreams | null = null
  private buf = ''
  private queue: Job[] = []
  private current: Job | null = null

  run(script: string, timeoutMs = 60_000): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ script, timeoutMs, resolve, reject })
      this.next()
    })
  }

  dispose(): void {
    this.proc?.kill()
    this.proc = null
  }

  private start(): ChildProcessWithoutNullStreams {
    const p = spawn(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', getWorkerPath()],
      { windowsHide: true }
    )
    p.stdout.setEncoding('utf8')
    p.stdout.on('data', (chunk: string) => {
      if (this.proc !== p) return
      this.buf += chunk
      let i: number
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim()
        this.buf = this.buf.slice(i + 1)
        if (line.startsWith('@@')) this.onResponse(line.slice(2))
      }
    })
    p.stderr.on('data', () => {})
    p.on('exit', () => {
      if (this.proc !== p) return
      this.proc = null
      this.buf = ''
      const job = this.current
      this.current = null
      if (job) {
        clearTimeout(job.timer)
        job.reject(new Error('PowerShell stopped unexpectedly'))
      }
      this.next()
    })
    this.proc = p
    return p
  }

  private next(): void {
    if (this.current || this.queue.length === 0) return
    const proc = this.proc ?? this.start()
    const job = this.queue.shift()!
    this.current = job
    job.timer = setTimeout(() => {
      if (this.current !== job) return
      this.current = null
      const p = this.proc
      this.proc = null
      this.buf = ''
      p?.kill()
      job.reject(new Error('PowerShell timeout'))
      this.next()
    }, job.timeoutMs)
    proc.stdin.write(Buffer.from(job.script, 'utf8').toString('base64') + '\n')
  }

  private onResponse(b64: string): void {
    const job = this.current
    if (!job) return
    clearTimeout(job.timer)
    this.current = null
    const { ok, body } = parseResponse(Buffer.from(b64, 'base64').toString('utf8'))
    if (ok) job.resolve(body)
    else job.reject(new Error(body))
    this.next()
  }
}

/** For live charts and the process list — never blocked by long jobs. */
export const monitorPs = new PsWorker()
/** For everything else (cleaning, tweaks, startup...). */
export const taskPs = new PsWorker()

export function disposePs(): void {
  monitorPs.dispose()
  taskPs.dispose()
}

/** Embeds a JS value into a script as a PowerShell object. */
export function psValue(value: unknown): string {
  return `(@'\n${JSON.stringify(value)}\n'@ | ConvertFrom-Json)`
}

/** Single-quoted PowerShell string literal. */
export function psStr(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

export function parseJson<T>(text: string): T {
  const t = text.trim()
  return JSON.parse(t.charCodeAt(0) === 0xfeff ? t.slice(1) : t) as T
}

let adminCache: boolean | null = null
export async function isAdmin(): Promise<boolean> {
  if (adminCache === null) {
    const out = await taskPs.run(
      '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'
    )
    adminCache = out.trim() === 'True'
  }
  return adminCache
}

export const UAC_DENIED = 'UAC_DENIED'

/**
 * Runs a script with admin rights. If the app already has them, runs directly;
 * otherwise Windows shows the UAC prompt once for this script.
 */
export async function runElevated(script: string, timeoutMs = 300_000): Promise<string> {
  if (await isAdmin()) return taskPs.run(script, timeoutMs)

  const id = randomUUID()
  const scriptPath = join(workDir(), `${id}.ps1`)
  const outPath = join(workDir(), `${id}.out`)
  const wrapped = `${PRELUDE}
$__text = try {
  $__r = & {
${script}
  } 2>$null
  "OK" + $NL + (($__r | ForEach-Object { "$_" }) -join $NL)
} catch { "ERR" + $NL + $_.Exception.Message }
[IO.File]::WriteAllText(${psStr(outPath)}, $__text, (New-Object System.Text.UTF8Encoding $false))
`
  writeFileSync(scriptPath, '﻿' + wrapped, 'utf8')
  try {
    await taskPs.run(
      `$a = @('-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File', ('"' + ${psStr(scriptPath)} + '"'))
Start-Process -FilePath powershell.exe -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList $a -ErrorAction Stop | Out-Null
'started'`,
      timeoutMs
    )
  } catch {
    rmSync(scriptPath, { force: true })
    throw new Error(UAC_DENIED)
  }
  try {
    if (!existsSync(outPath)) throw new Error(UAC_DENIED)
    let text = readFileSync(outPath, 'utf8')
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
    const { ok, body } = parseResponse(text)
    if (!ok) throw new Error(body)
    return body
  } finally {
    rmSync(scriptPath, { force: true })
    rmSync(outPath, { force: true })
  }
}
