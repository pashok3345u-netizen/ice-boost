import { app, BrowserWindow, ipcMain, screen, shell } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Api } from '../shared/types'
import { getLive, getProcesses, getSystemInfo, killProcesses } from './system'
import { cleanJunk, scanJunk } from './cleaner'
import { getStartup, setStartup } from './startup'
import { applyTweaks, createRestorePoint, getTweaks, revertTweaks } from './tweaks'
import { disposePs } from './ps'
import { getGpu, resetGpuMax, startGpuWatch, stopGpuWatch } from './gpu'
import { runDevHooks } from './devhooks'
import {
  appInstalled, cancelScan, findLeftovers, getAppIcons, getApps, getDrives, getPlaces, getSpaceExtras, mapLevel, openStorageSettings,
  pickFolder, scanApps, scanFiles, scanMap, showInFolder, spaceStatus, trashPaths, uninstallApp
} from './space'
import { checkUpdate, installUpdate, updateStatus } from './updater'

const handlers: Api = {
  getSystemInfo,
  getLive,
  getGpu,
  resetGpuMax,
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
  createRestorePoint,
  getDrives,
  getPlaces,
  getSpaceExtras,
  getApps,
  scanApps,
  getAppIcons,
  uninstallApp,
  appInstalled,
  findLeftovers,
  scanFiles,
  scanMap,
  mapLevel,
  spaceStatus,
  cancelScan,
  trashPaths,
  showInFolder,
  pickFolder,
  openStorageSettings,
  checkUpdate,
  installUpdate,
  updateStatus
}

// The window remembers its size and position between launches, like a normal app.
type Bounds = { x?: number; y?: number; width: number; height: number; maximized?: boolean }

function boundsFile(): string {
  return join(app.getPath('userData'), 'window.json')
}

function loadBounds(): Bounds {
  const fallback = { width: 1240, height: 820 }
  try {
    if (!existsSync(boundsFile())) return fallback
    const b = JSON.parse(readFileSync(boundsFile(), 'utf8')) as Bounds
    // only reuse the position if it is still on a connected monitor
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea
      return b.x !== undefined && b.y !== undefined && b.x + 100 > a.x && b.x < a.x + a.width - 100 && b.y >= a.y - 10 && b.y < a.y + a.height - 100
    })
    return visible ? b : { width: b.width, height: b.height, maximized: b.maximized }
  } catch {
    return fallback
  }
}

function createWindow(): BrowserWindow {
  const b = loadBounds()
  const win = new BrowserWindow({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    minWidth: 1060,
    minHeight: 700,
    show: false,
    title: 'IceBoost',
    backgroundColor: '#1D1D22',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#1D1D22', symbolColor: '#D9E7E8', height: 40 },
    autoHideMenuBar: true,
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })
  win.once('ready-to-show', () => {
    if (b.maximized) win.maximize()
    win.show()
  })
  win.on('close', () => {
    try {
      writeFileSync(boundsFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }))
    } catch {
      // not important
    }
  })
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
  // Test runs (electron.exe) get their own id: with the same id Windows mixes them up with the
  // installed app and shows it as "Electron" in the taskbar and notifications.
  app.setAppUserModelId(app.isPackaged ? 'com.aising.iceboost' : 'com.aising.iceboost.dev')

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
    startGpuWatch()
    runDevHooks(win)
  })

  app.on('window-all-closed', () => {
    stopGpuWatch()
    disposePs()
    app.quit()
  })
}
