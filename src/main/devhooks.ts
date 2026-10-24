// Developer-only checks, switched on by environment variables (never in normal use):
//   ICEBOOST_SHOTS=<folder>  — opens every page and saves a screenshot of it, then quits
//   ICEBOOST_SELFTEST=1      — tests the PowerShell engine on a throwaway registry key and folder, then quits
import { app, type BrowserWindow } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getLive, getProcesses, getSystemInfo } from './system'
import { scanJunk, _cleanFolder } from './cleaner'
import { getStartup } from './startup'
import { getGpu } from './gpu'
import { getTweaks, _readOps, _writeOps } from './tweaks'
import { taskPs } from './ps'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export function runDevHooks(win: BrowserWindow): void {
  const shots = process.env.ICEBOOST_SHOTS
  if (shots) void takeShots(win, shots)
  if (process.env.ICEBOOST_SELFTEST) void selfTest()
}

async function takeShots(win: BrowserWindow, dir: string): Promise<void> {
  mkdirSync(dir, { recursive: true })
  win.webContents.setBackgroundThrottling(false)
  await new Promise<void>((r) => win.webContents.once('did-finish-load', () => r()))
  const pages = (process.env.ICEBOOST_PAGES ?? 'dashboard,gpu,boost,cleaner,startup,processes,settings').split(',')
  await sleep(Number(process.env.ICEBOOST_WAIT ?? 9000))
  for (const p of pages) {
    await win.webContents.executeJavaScript(`window.__iceGoto && window.__iceGoto(${JSON.stringify(p)})`)
    await sleep(2500)
    // optional extra script, e.g. to click something before the screenshot
    if (process.env.ICEBOOST_JS) {
      await win.webContents.executeJavaScript(process.env.ICEBOOST_JS)
      await sleep(900)
    }
    const img = await win.webContents.capturePage()
    writeFileSync(join(dir, `${p}.png`), img.toPNG())
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

  process.stdout.write('\n@@SELFTEST ' + JSON.stringify(out) + '\n')
  app.quit()
}
