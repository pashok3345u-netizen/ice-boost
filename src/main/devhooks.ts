// Developer-only checks, switched on by environment variables (never in normal use):
//   ICEBOOST_SHOTS=<folder>  — opens every page and saves a screenshot of it, then quits
//                              (ICEBOOST_PAGES=a,b — which pages, ICEBOOST_PAGE_WAIT=ms — time on each page)
//   ICEBOOST_SELFTEST=1      — tests the PowerShell engine on a throwaway registry key and folder, then quits
import { app, type BrowserWindow } from 'electron'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getLive, getProcesses, getSystemInfo } from './system'
import { scanJunk, _cleanFolder } from './cleaner'
import { getStartup } from './startup'
import { getGpu } from './gpu'
import { getTweaks, _readOps, _writeOps } from './tweaks'
import { taskPs } from './ps'
import { _selfTestFiles, getAppIcons, getApps, getDrives, getSpaceExtras, scanApps, trashPaths } from './space'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export function runDevHooks(win: BrowserWindow): void {
  const shots = process.env.ICEBOOST_SHOTS
  if (shots) void takeShots(win, shots)
  if (process.env.ICEBOOST_SELFTEST) void selfTest()
}

async function takeShots(win: BrowserWindow, dir: string): Promise<void> {
  mkdirSync(dir, { recursive: true })
  win.webContents.setBackgroundThrottling(false)
  // the window pops up on the owner's screen: don't let the real mouse turn the 3D view mid-test
  win.setIgnoreMouseEvents(true)
  await new Promise<void>((r) => win.webContents.once('did-finish-load', () => r()))
  const pages = (process.env.ICEBOOST_PAGES ?? 'dashboard,gpu,boost,cleaner,startup,processes,settings').split(',')
  await sleep(Number(process.env.ICEBOOST_WAIT ?? 9000))
  for (const [i, p] of pages.entries()) {
    await win.webContents.executeJavaScript(`window.__iceGoto && window.__iceGoto(${JSON.stringify(p)})`)
    await sleep(Number(process.env.ICEBOOST_PAGE_WAIT ?? 2500))
    // optional extra script, e.g. to click something before the screenshot
    if (process.env.ICEBOOST_JS) {
      await win.webContents.executeJavaScript(process.env.ICEBOOST_JS)
      await sleep(900)
    }
    const img = await win.webContents.capturePage()
    // the same page twice (e.g. different tabs via ICEBOOST_JS) → space.png, space-2.png...
    writeFileSync(join(dir, pages.indexOf(p) === i ? `${p}.png` : `${p}-${i + 1}.png`), img.toPNG())
  }
  app.quit()
}

async function step<T>(name: string, fn: () => Promise<T>, out: Record<string, unknown>): Promise<T | undefined> {
  const t = Date.now()
  try {
    const v = await fn()
    out[name] = { ok: true, ms: Date.now() - t, value: v }
    return v
  } catch (e) {
    out[name] = { ok: false, ms: Date.now() - t, error: (e as Error).message }
    return undefined
  }
}

async function selfTest(): Promise<void> {
  const out: Record<string, unknown> = {}
  const key = 'HKCU:\\Software\\IceBoostSelfTest'
  const op = { kind: 'reg' as const, key, name: 'Probe', type: 'DWord' as const, value: -1, def: null }
  const sop = { kind: 'reg' as const, key, name: 'Text', type: 'String' as const, value: 'Привет', def: null }

  await step('sysinfo', getSystemInfo, out)
  await step('live1', getLive, out)
  await step('procs1', async () => (await getProcesses()).length, out)
  await sleep(1500)
  await step('live2', getLive, out)
  await step('gpu', async () => (await getGpu()).now, out)
  await step('procs2', async () => (await getProcesses()).slice(0, 5), out)
  await step('startup', getStartup, out)
  await step('tweaks', getTweaks, out)
  await step('scan', scanJunk, out)

  await step('reg-before', () => _readOps([op, sop]), out)
  await step('reg-write', () => _writeOps([{ ...op }, { ...sop }], false), out)
  await step('reg-after', () => _readOps([op, sop]), out)
  await step('reg-delete', () => _writeOps([{ ...op, value: null }, { ...sop, value: null }], false), out)
  await step('reg-gone', () => _readOps([op, sop]), out)
  await step('reg-cleanup', () => taskPs.run(`Remove-Item -LiteralPath '${key}' -Recurse -Force; 'removed'`), out)

  const dir = join(tmpdir(), 'iceboost-selftest')
  mkdirSync(join(dir, 'sub'), { recursive: true })
  writeFileSync(join(dir, 'a.txt'), 'x'.repeat(1000))
  writeFileSync(join(dir, 'sub', 'b.txt'), 'y'.repeat(2000))
  await step('clean-folder', () => _cleanFolder(dir), out)

  // disk space: real lists are only read; the file engine runs on a throwaway folder
  await step('drives', getDrives, out)
  await step('space-extras', getSpaceExtras, out)
  const apps = await step('apps', getApps, out)
  if (apps) out.apps = { ok: true, count: apps.length, sample: apps.slice(0, 6) }
  const scanned = await step('apps-scan', scanApps, out)
  if (scanned) out['apps-scan'] = { ok: true, measured: scanned.filter((s) => s.size != null).length, withLastUsed: scanned.filter((s) => s.lastUsed).length }
  if (apps) {
    const icons = await step('app-icons', () => getAppIcons(apps.map((a) => a.id)), out)
    if (icons) out['app-icons'] = { ok: true, count: Object.keys(icons).length, of: apps.length }
  }
  const sdir = join(tmpdir(), 'iceboost-selftest-space')
  mkdirSync(join(sdir, 'sub'), { recursive: true })
  mkdirSync(join(sdir, 'skipme'), { recursive: true })
  const big = Buffer.alloc(3 * 1024 * 1024, 7)
  writeFileSync(join(sdir, 'video.mp4'), big)
  writeFileSync(join(sdir, 'sub', 'video-copy.mp4'), big)
  writeFileSync(join(sdir, 'sub', 'other.bin'), Buffer.alloc(3 * 1024 * 1024, 9))
  writeFileSync(join(sdir, 'skipme', 'hidden.bin'), big)
  writeFileSync(join(sdir, 'small.txt'), 'z'.repeat(5000))
  // a "portable game": its files must be marked as part of a program and never count as copies
  mkdirSync(join(sdir, 'portable', 'levels'), { recursive: true })
  writeFileSync(join(sdir, 'portable', 'game.exe'), 'MZ')
  writeFileSync(join(sdir, 'portable', 'engine.dll'), 'MZ')
  writeFileSync(join(sdir, 'portable', 'data.pak'), big)
  writeFileSync(join(sdir, 'portable', 'levels', 'level1.pak'), Buffer.alloc(3 * 1024 * 1024, 11))
  await step('space-files', () => _selfTestFiles(sdir), out)
  // protected places must be refused before anything happens (the paths don't exist, so even a bug can't hurt)
  await step('space-guard', async () => {
    const r = await trashPaths([
      'C:\\Windows\\iceboost-selftest.txt',
      'C:\\Program Files\\iceboost-selftest',
      join(process.env.LOCALAPPDATA ?? 'C:\\Users\\x\\AppData\\Local', 'iceboost-selftest'),
      'Q:\\'
    ])
    return { refused: r.refused.length, of: 4, moved: r.moved }
  }, out)
  rmSync(sdir, { recursive: true, force: true })

  process.stdout.write('\n@@SELFTEST ' + JSON.stringify(out) + '\n')
  app.quit()
}
