// Updates: asks GitHub Releases for a newer IceBoost, downloads the installer and runs it silently.
// A small PowerShell helper waits for IceBoost to close, installs over it and starts the new version.
// The portable exe can't update itself — there the button just opens the download page.
import { app, net, shell } from 'electron'
import { spawn } from 'node:child_process'
import { createWriteStream, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { OpResult, UpdateInfo, UpdateStatus } from '../shared/types'

const REPO = 'pashok3345u-netizen/ice-boost'

let latest: UpdateInfo | null = null
let status: UpdateStatus = { state: 'idle', got: 0, total: 0 }

/** "0.10.0" > "0.9.3" */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0)
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0)
  }
  return false
}

interface GhRelease {
  tag_name: string
  html_url: string
  draft: boolean
  prerelease: boolean
  assets: { name: string; browser_download_url: string; size: number }[]
}

/** null = up to date (or GitHub can't be reached, which is fine: we'll ask again later) */
export async function checkUpdate(): Promise<UpdateInfo | null> {
  const portable = !!process.env.PORTABLE_EXECUTABLE_DIR
  // dev check: ICEBOOST_FAKE_UPDATE='{"version":"9.9.9","setupUrl":"https://...exe","size":123}'
  const fake = process.env.ICEBOOST_FAKE_UPDATE
  if (fake) {
    const f = JSON.parse(fake) as Partial<UpdateInfo> & { version: string }
    latest = { url: `https://github.com/${REPO}/releases`, setupUrl: null, size: 0, portable, ...f }
    return latest
  }
  // test runs from electron.exe have nothing to update, unless the check itself is being tested:
  // ICEBOOST_UPDATE_CHECK=1 ICEBOOST_FAKE_VERSION=0.2.0 → the real GitHub release shows up
  if (!app.isPackaged && !process.env.ICEBOOST_UPDATE_CHECK) return null
  const current = (!app.isPackaged && process.env.ICEBOOST_FAKE_VERSION) || app.getVersion()
  try {
    const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'IceBoost' }
    })
    if (!res.ok) return null
    const r = (await res.json()) as GhRelease
    if (r.draft || r.prerelease) return null
    const version = r.tag_name.replace(/^v/i, '')
    if (!isNewer(version, current)) return null
    const setup = r.assets.find((a) => /setup.*\.exe$/i.test(a.name))
    latest = { version, url: r.html_url, setupUrl: setup?.browser_download_url ?? null, size: setup?.size ?? 0, portable }
    return latest
  } catch {
    return null
  }
}

export async function updateStatus(): Promise<UpdateStatus> {
  return status
}

// waits for IceBoost to close, installs silently (same folder as before), starts the new version
const HELPER = `param([int]$AppPid, [string]$Setup, [string]$Exe)
try { Wait-Process -Id $AppPid -Timeout 60 -ErrorAction SilentlyContinue } catch {}
Start-Sleep -Milliseconds 700
Start-Process -FilePath $Setup -ArgumentList '/S' -Wait
Start-Sleep -Milliseconds 500
Start-Process -FilePath $Exe
`

async function download(info: UpdateInfo): Promise<string> {
  const file = join(app.getPath('temp'), `IceBoost-Setup-${info.version}.exe`)
  const res = await net.fetch(info.setupUrl!, { headers: { 'User-Agent': 'IceBoost' } })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
  const total = Number(res.headers.get('content-length')) || info.size
  status = { state: 'downloading', got: 0, total }
  const out = createWriteStream(file)
  const reader = res.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!out.write(value)) await new Promise<void>((r) => out.once('drain', () => r()))
    status = { ...status, got: status.got + value.length }
  }
  await new Promise<void>((resolve, reject) => {
    out.on('error', reject)
    out.end(() => resolve())
  })
  // a cut-off download would be a broken installer
  if (info.size && status.got !== info.size) throw new Error(`downloaded ${status.got} of ${info.size} bytes`)
  return file
}

/** starts the update; the window shows progress via updateStatus() */
export async function installUpdate(): Promise<OpResult> {
  const info = latest
  if (!info) return { ok: false, error: 'no update' }
  if (info.portable || !info.setupUrl) {
    void shell.openExternal(info.url)
    return { ok: true }
  }
  if (status.state === 'downloading' || status.state === 'installing') return { ok: true }
  status = { state: 'downloading', got: 0, total: info.size }
  void (async () => {
    try {
      const setup = await download(info)
      status = { ...status, state: 'installing' }
      // dev check: download only, don't install or quit
      if (process.env.ICEBOOST_UPDATE_DRYRUN) return
      const helper = join(app.getPath('temp'), 'iceboost-update.ps1')
      writeFileSync(helper, HELPER)
      spawn(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', helper, '-AppPid', String(process.pid), '-Setup', setup, '-Exe', process.execPath],
        { detached: true, stdio: 'ignore', windowsHide: true }
      ).unref()
      setTimeout(() => app.quit(), 600)
    } catch (e) {
      status = { ...status, state: 'error', error: e instanceof Error ? e.message : String(e) }
    }
  })()
  return { ok: true }
}
