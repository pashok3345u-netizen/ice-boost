import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/types'

const methods: (keyof Api)[] = [
  'getSystemInfo',
  'getLive',
  'getGpu',
  'resetGpuMax',
  'getProcesses',
  'killProcess',
  'closeApps',
  'scanJunk',
  'cleanJunk',
  'getStartup',
  'setStartup',
  'getTweaks',
  'applyTweaks',
  'revertTweaks',
  'createRestorePoint',
  'getDrives',
  'getPlaces',
  'getSpaceExtras',
  'getApps',
  'scanApps',
  'getAppIcons',
  'uninstallApp',
  'appInstalled',
  'findLeftovers',
  'scanFiles',
  'scanMap',
  'mapLevel',
  'spaceStatus',
  'cancelScan',
  'trashPaths',
  'showInFolder',
  'pickFolder',
  'openStorageSettings',
  'checkUpdate',
  'installUpdate',
  'updateStatus'
]

const api = Object.fromEntries(
  methods.map((m) => [m, (...args: unknown[]) => ipcRenderer.invoke('api', m, ...args)])
) as unknown as Api

contextBridge.exposeInMainWorld('api', api)
