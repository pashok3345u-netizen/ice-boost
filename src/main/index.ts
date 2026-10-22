import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import type { Api } from '../shared/types'
import { getLive, getProcesses, getSystemInfo, killProcesses } from './system'
import { cleanJunk, scanJunk } from './cleaner'
import { getStartup, setStartup } from './startup'
import { applyTweaks, createRestorePoint, getTweaks, revertTweaks } from './tweaks'
import { disposePs } from './ps'
import { runDevHooks } from './devhooks'

const handlers: Api = {
  getSystemInfo,
  getLive,
  getProcesses,
  killProcess: (name) => killProcesses([name]),
  closeApps: killProcesses,
  scanJunk,
  cleanJunk,
  getStartup,
  setStartup,
  getTweaks,
  applyTweaks,
  revertTweaks,
  createRestorePoint
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1220,
    height: 800,
    minWidth: 1020,
    minHeight: 680,
    show: false,
    title: 'IceBoost',
    backgroundColor: '#070b16',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#070b16', symbolColor: '#94a3b8', height: 40 },
    autoHideMenuBar: true,
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
  return win
}

// screenshot mode: keep painting even when the window is covered by other windows
if (process.env.ICEBOOST_SHOTS) app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.setAppUserModelId('com.aising.iceboost')

  ipcMain.handle('api', async (_e, method: keyof Api, ...args: unknown[]) => {
    const fn = handlers[method] as (...a: unknown[]) => Promise<unknown>
    if (typeof fn !== 'function') throw new Error(`Unknown method ${String(method)}`)
    return fn(...args)
  })

  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    const win = createWindow()
    runDevHooks(win)
  })

  app.on('window-all-closed', () => {
    disposePs()
    app.quit()
  })
}
