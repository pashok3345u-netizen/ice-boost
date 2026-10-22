export interface DiskInfo {
  name: string
  media: string
  bus: string
  size: number
}

export interface SystemInfo {
  cpu: string
  cores: number
  threads: number
  gpu: string
  vram: number
  refresh: number
  resolution: string
  ramTotal: number
  ramSticks: number
  ramSpeed: number
  os: string
  build: string
  board: string
  disks: DiskInfo[]
  isAdmin: boolean
}

export interface LiveStats {
  cpu: number
  ramUsed: number
  ramTotal: number
  diskFree: number
  diskTotal: number
  gpu: number | null
  vramUsed: number | null
  uptime: number
}

export interface ProcInfo {
  name: string
  desc: string | null
  ram: number
  cpu: number
  count: number
}

export interface JunkGroup {
  label: string
  size: number
  running: boolean
}

export interface JunkResult {
  id: string
  admin: boolean
  defaultOn: boolean
  /** null = could not be measured without admin rights */
  size: number | null
  files: number
  groups: JunkGroup[]
}

export interface CleanResult {
  freed: number
  deleted: number
  failed: number
  /** apps whose cache was skipped because they are running */
  skipped: string[]
  /** the user pressed "No" in the admin prompt, so system folders were not cleaned */
  adminDenied?: boolean
}

export type StartupSource = 'HKCU' | 'HKLM' | 'HKLM32' | 'FolderUser' | 'FolderAll'

export interface StartupItem {
  id: string
  name: string
  command: string
  source: StartupSource
  enabled: boolean
  admin: boolean
  desc: string | null
  company: string | null
}

export interface TweakState {
  id: string
  applied: boolean
  hasBackup: boolean
}

export interface OpResult {
  ok: boolean
  error?: string
}

export interface RestorePointResult {
  status: 'created' | 'limit' | 'error'
  error?: string
}

export interface Api {
  getSystemInfo(): Promise<SystemInfo>
  getLive(): Promise<LiveStats>
  getProcesses(): Promise<ProcInfo[]>
  killProcess(name: string): Promise<OpResult>
  closeApps(names: string[]): Promise<OpResult>
  scanJunk(): Promise<JunkResult[]>
  cleanJunk(ids: string[]): Promise<CleanResult>
  getStartup(): Promise<StartupItem[]>
  setStartup(id: string, enabled: boolean): Promise<OpResult>
  getTweaks(): Promise<TweakState[]>
  applyTweaks(ids: string[]): Promise<Record<string, OpResult>>
  revertTweaks(ids: string[]): Promise<Record<string, OpResult>>
  createRestorePoint(): Promise<RestorePointResult>
}
