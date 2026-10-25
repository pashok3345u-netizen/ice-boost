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
  /** SMBIOS memory type: 26 = DDR4, 34 = DDR5, 0 = unknown */
  ramType: number
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

/** One reading of the video card sensors. null = this card doesn't report it. */
export interface GpuSensors {
  vendor: 'amd' | 'nvidia'
  name: string
  /** °C */
  temp: number | null
  /** °C, the hottest point of the chip (newer cards only) */
  hotspot: number | null
  /** V, core voltage */
  voltage: number | null
  /** MHz */
  core: number | null
  /** MHz */
  mem: number | null
  fanRpm: number | null
  fanPct: number | null
  /** W */
  power: number | null
  /** °C, the limit the driver itself reports (90 on RX 590) */
  maxTemp: number | null
}

export interface GpuState {
  /** false = no sensors could be read on this PC */
  supported: boolean
  now: GpuSensors | null
  /** last 5 minutes, one point every 2 s */
  history: { temp: number[]; voltage: number[]; power: number[] }
  /** highest values since IceBoost started (or since "Reset") */
  max: { temp: number | null; hotspot: number | null; voltage: number | null; power: number | null }
}

// ---- disk space: drives, installed apps, big/old files, disk map

export interface DriveInfo {
  /** "C:" */
  root: string
  label: string
  total: number
  free: number
  /** Windows is installed here */
  system: boolean
}

/** Folders the app needs to know to protect them (see shared/space.ts). */
export interface Places {
  windows: string
  programFiles: string[]
  programData: string
  profile: string
  appData: string[]
  /** Desktop, Documents, Downloads... — the folders themselves are protected, not what's inside */
  known: string[]
  downloads: string
  oneDrive: string[]
}

export interface SpaceExtras {
  /** hiberfil.sys size (hibernation file), null = there is none */
  hiberfil: number | null
  /** C:\Windows.old exists (the previous Windows after an upgrade) */
  windowsOld: boolean
  /** bytes in the Recycle Bin */
  recycle: number
}

export type AppKind = 'win32' | 'store' | 'steam' | 'epic'

export interface InstalledApp {
  id: string
  name: string
  publisher: string | null
  version: string | null
  kind: AppKind
  /** bytes; the registry estimate until the folder is measured */
  size: number | null
  measured: boolean
  /** ms since 1970 */
  installed: number | null
  /** ms since 1970; null = Windows doesn't know */
  lastUsed: number | null
  location: string | null
  /** "C:" */
  drive: string | null
  /** can be removed without the app's own wizard */
  quiet: boolean
  canUninstall: boolean
  /** Steam/Epic: the uninstall happens in the launcher */
  viaLauncher: boolean
}

/** Result of measuring an app's folder and checking when it was last started. */
export interface AppScan {
  id: string
  size: number | null
  lastUsed: number | null
}

export interface ScanStatus {
  running: boolean
  /** items done / total (apps measured, folders scanned, files compared) */
  done: number
  total: number
  /** files looked at so far */
  files: number
  current: string
  /** 'compare' = looking for copies */
  phase: string
}

export type JobKind = 'apps' | 'files' | 'map'

export interface BigFile {
  path: string
  size: number
  /** the latest of: changed, created, opened (if Windows remembers opening) */
  lastUsed: number
  modified: number
  /** same value = same content */
  copyOf: string | null
}

export interface FileScan {
  files: BigFile[]
  scanned: number
  roots: string[]
  /** Windows remembers when a file was opened (otherwise only changes count) */
  accessTime: boolean
  /** big files inside program folders (an .exe next to .dll files) — not listed, removing them breaks the program */
  inApps: { files: number; size: number }
  at: number
}

export interface MapItem {
  name: string
  path: string
  size: number
  files: number
  dir: boolean
  /** couldn't be read (no rights) */
  denied?: boolean
  /** 'other' = small files and folders together, 'hidden' = space Windows uses but doesn't show */
  special?: 'other' | 'hidden'
}

export interface MapLevel {
  path: string
  size: number
  files: number
  items: MapItem[]
}

export interface Leftover {
  path: string
  size: number
  /** 'install' = the app's own folder, 'data' = settings/cache in AppData/ProgramData */
  kind: 'install' | 'data'
}

export interface TrashResult {
  /** paths that are in the Recycle Bin now */
  movedPaths: string[]
  moved: number
  failed: number
  size: number
  /** paths that were refused because they are protected */
  refused: string[]
}

export interface Api {
  getSystemInfo(): Promise<SystemInfo>
  getLive(): Promise<LiveStats>
  getGpu(): Promise<GpuState>
  resetGpuMax(): Promise<void>
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
  getDrives(): Promise<DriveInfo[]>
  getPlaces(): Promise<Places>
  getSpaceExtras(): Promise<SpaceExtras>
  getApps(): Promise<InstalledApp[]>
  scanApps(): Promise<AppScan[]>
  getAppIcons(ids: string[]): Promise<Record<string, string>>
  uninstallApp(id: string, quiet: boolean): Promise<OpResult>
  appInstalled(id: string): Promise<boolean>
  findLeftovers(id: string): Promise<Leftover[]>
  scanFiles(extraRoots: string[]): Promise<FileScan>
  scanMap(root: string): Promise<MapLevel>
  mapLevel(path: string): Promise<MapLevel | null>
  spaceStatus(): Promise<Record<JobKind, ScanStatus>>
  cancelScan(): Promise<void>
  trashPaths(paths: string[]): Promise<TrashResult>
  showInFolder(path: string): Promise<void>
  pickFolder(): Promise<string | null>
  openStorageSettings(): Promise<void>
}
