import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/types'

const methods: (keyof Api)[] = [
  'getSystemInfo',
  'getLive',
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
  'createRestorePoint'
]

const api = Object.fromEntries(
  methods.map((m) => [m, (...args: unknown[]) => ipcRenderer.invoke('api', m, ...args)])
) as unknown as Api

contextBridge.exposeInMainWorld('api', api)
