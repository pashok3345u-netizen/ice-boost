// Disk space data for the "Disk space" page. Lives above the pages, so scans aren't started again
// every time you switch pages, and the goal card sees what is selected in every tab.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DriveInfo, FileScan, InstalledApp, JobKind, MapLevel, Places, ScanStatus, SpaceExtras } from '../../shared/types'

export type SpaceTab = 'apps' | 'files' | 'map'
export type AppFilter = 'all' | 'games' | 'old' | 'big' | 'store'
export type AppSort = 'size' | 'last' | 'name' | 'date'
export type FileMode = 'old' | 'big' | 'copies'

export interface FileView {
  mode: FileMode
  kind: string
  /** days without opening */
  age: number
  minSize: number
}

export interface Goal {
  drive: string
  gb: number
}

interface SpaceCtx {
  drives: DriveInfo[] | null
  places: Places | null
  extras: SpaceExtras | null
  apps: InstalledApp[] | null
  icons: Record<string, string>
  appsMeasured: boolean
  files: FileScan | null
  map: { root: string; level: MapLevel; at: number } | null
  status: Record<JobKind, ScanStatus> | null
  failed: Partial<Record<JobKind, string>>
  start: () => void
  refreshApps: () => Promise<void>
  refreshFiles: () => Promise<void>
  scanMap: (root: string) => Promise<void>
  refreshDrives: () => Promise<void>
  refreshExtras: () => Promise<void>
  dropApps: (ids: string[]) => void
  dropFiles: (paths: string[]) => void
  extraRoots: string[]
  addRoot: () => Promise<void>
  removeRoot: (p: string) => void
  goal: Goal
  setGoal: (g: Goal) => void
  tab: SpaceTab
  setTab: (t: SpaceTab) => void
  appFilter: AppFilter
  setAppFilter: (f: AppFilter) => void
  appSort: AppSort
  setAppSort: (s: AppSort) => void
  fileView: FileView
  setFileView: (v: FileView) => void
  selApps: Set<string>
  setSelApps: (s: Set<string>) => void
  selFiles: Set<string>
  setSelFiles: (s: Set<string>) => void
  /** something was moved to the Recycle Bin on this visit — the bin row asks to be emptied */
  binHint: boolean
  setBinHint: (v: boolean) => void
}

const Ctx = createContext<SpaceCtx | null>(null)

export function useSpace(): SpaceCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('SpaceProvider missing')
  return c
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    // ignore
  }
}

export const MB = 1024 * 1024
export const GB = 1024 * MB
/** "not used lately" = not started for this many days */
export const OLD_DAYS = 90

const days = (ms: number): number => (Date.now() - ms) / 86400000

/**
 * Not started for 3+ months. With admin rights Windows remembers recent starts (Prefetch),
 * so "no record" also means "not lately"; without them we only trust Steam's own date.
 */
export function isOldApp(a: InstalledApp, admin: boolean): boolean {
  if (a.lastUsed) return days(a.lastUsed) > OLD_DAYS
  if (a.kind !== 'steam' && !(admin && a.measured)) return false
  return a.installed != null && days(a.installed) > OLD_DAYS
}

export function sumSize(list: { size: number | null }[]): number {
  return list.reduce((s, x) => s + (x.size ?? 0), 0)
}

export function SpaceProvider({ children }: { children: ReactNode }): ReactNode {
  const [drives, setDrives] = useState<DriveInfo[] | null>(null)
  const [places, setPlaces] = useState<Places | null>(null)
  const [extras, setExtras] = useState<SpaceExtras | null>(null)
  const [apps, setApps] = useState<InstalledApp[] | null>(null)
  const [icons, setIcons] = useState<Record<string, string>>({})
  const [appsMeasured, setAppsMeasured] = useState(false)
  const [files, setFiles] = useState<FileScan | null>(null)
  const [map, setMap] = useState<SpaceCtx['map']>(null)
  const [status, setStatus] = useState<Record<JobKind, ScanStatus> | null>(null)
  const [failed, setFailed] = useState<Partial<Record<JobKind, string>>>({})
  const [extraRoots, setExtraRoots] = useState<string[]>(() => readJson<{ list: string[] }>('iceboost.spaceRoots', { list: [] }).list)
  const [goal, setGoalState] = useState<Goal>(() => readJson<Goal>('iceboost.spaceGoal', { drive: '', gb: 50 }))
  const [tab, setTab] = useState<SpaceTab>('apps')
  const [appFilter, setAppFilter] = useState<AppFilter>('all')
  const [appSort, setAppSort] = useState<AppSort>('size')
  const [fileView, setFileView] = useState<FileView>({ mode: 'old', kind: 'all', age: 180, minSize: 10 * MB })
  const [selApps, setSelApps] = useState<Set<string>>(new Set())
  const [selFiles, setSelFiles] = useState<Set<string>>(new Set())
  const [binHint, setBinHint] = useState(false)
  const started = useRef(false)
  const busy = useRef(0)

  const setGoal = useCallback((g: Goal) => {
    setGoalState(g)
    writeJson('iceboost.spaceGoal', g)
  }, [])

  const refreshDrives = useCallback(async () => {
    try {
      const d = await window.api.getDrives()
      setDrives(d)
      // first visit: the goal is for the Windows disk
      setGoalState((g) => (g.drive && d.some((x) => x.root === g.drive) ? g : { ...g, drive: (d.find((x) => x.system) ?? d[0])?.root ?? 'C:' }))
    } catch {
      setDrives((d) => d ?? [])
    }
  }, [])

  const refreshExtras = useCallback(async () => {
    try {
      setExtras(await window.api.getSpaceExtras())
    } catch {
      // keep the old numbers
    }
  }, [])

  // progress bars: ask the main process while a scan runs
  const watch = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    busy.current++
    const id = setInterval(() => {
      window.api.spaceStatus().then(setStatus).catch(() => {})
    }, 400)
    try {
      return await fn()
    } finally {
      clearInterval(id)
      busy.current--
      window.api.spaceStatus().then(setStatus).catch(() => {})
    }
  }, [])

  const refreshApps = useCallback(async () => {
    setFailed((f) => ({ ...f, apps: undefined }))
    try {
      const list = await window.api.getApps()
      setApps(list)
      window.api.getAppIcons(list.map((a) => a.id)).then((i) => setIcons((old) => ({ ...old, ...i }))).catch(() => {})
      const scan = await watch(() => window.api.scanApps())
      const byId = new Map(scan.map((s) => [s.id, s]))
      setApps((old) =>
        (old ?? list).map((a) => {
          const s = byId.get(a.id)
          return s ? { ...a, size: s.size, lastUsed: s.lastUsed, measured: s.size != null || a.measured } : a
        })
      )
      setAppsMeasured(true)
      // some icons are known only after measuring (the app's exe was found in its folder)
      window.api.getAppIcons(list.map((a) => a.id)).then((i) => setIcons((old) => ({ ...i, ...old }))).catch(() => {})
    } catch (e) {
      setApps((a) => a ?? [])
      setFailed((f) => ({ ...f, apps: String(e) }))
    }
  }, [watch])

  const refreshFiles = useCallback(async () => {
    setFailed((f) => ({ ...f, files: undefined }))
    try {
      const r = await watch(() => window.api.scanFiles(extraRoots))
      setFiles(r)
      setSelFiles(new Set())
    } catch (e) {
      setFailed((f) => ({ ...f, files: String(e) }))
    }
  }, [watch, extraRoots])

  const scanMap = useCallback(
    async (root: string) => {
      setFailed((f) => ({ ...f, map: undefined }))
      try {
        const level = await watch(() => window.api.scanMap(root))
        setMap({ root, level, at: Date.now() })
      } catch (e) {
        if (!String(e).includes('CANCELLED')) setFailed((f) => ({ ...f, map: String(e) }))
      }
    },
    [watch]
  )

  const start = useCallback(() => {
    void refreshDrives()
    void refreshExtras()
    if (started.current) return
    started.current = true
    window.api.getPlaces().then(setPlaces).catch(() => {})
    // apps first (the list shows quickly), then the file search
    void refreshApps().then(() => refreshFiles())
  }, [refreshDrives, refreshExtras, refreshApps, refreshFiles])

  const dropApps = useCallback((ids: string[]) => {
    setApps((a) => a?.filter((x) => !ids.includes(x.id)) ?? null)
    setSelApps((s) => new Set([...s].filter((x) => !ids.includes(x))))
  }, [])

  const dropFiles = useCallback((paths: string[]) => {
    const gone = new Set(paths.map((p) => p.toLowerCase()))
    setFiles((f) => (f ? { ...f, files: f.files.filter((x) => !gone.has(x.path.toLowerCase())) } : f))
    setSelFiles((s) => new Set([...s].filter((x) => !gone.has(x.toLowerCase()))))
  }, [])

  const addRoot = useCallback(async () => {
    const p = await window.api.pickFolder()
    if (!p) return
    setExtraRoots((list) => {
      const next = list.some((x) => x.toLowerCase() === p.toLowerCase()) ? list : [...list, p]
      writeJson('iceboost.spaceRoots', { list: next })
      return next
    })
  }, [])

  const removeRoot = useCallback((p: string) => {
    setExtraRoots((list) => {
      const next = list.filter((x) => x !== p)
      writeJson('iceboost.spaceRoots', { list: next })
      return next
    })
  }, [])

  // a folder was added or removed → search again
  const firstRoots = useRef(true)
  useEffect(() => {
    if (firstRoots.current) {
      firstRoots.current = false
      return
    }
    if (started.current) void refreshFiles()
  }, [extraRoots]) // refreshFiles changes together with extraRoots

  const value = useMemo<SpaceCtx>(
    () => ({
      drives, places, extras, apps, icons, appsMeasured, files, map, status, failed, start, refreshApps, refreshFiles, scanMap,
      refreshDrives, refreshExtras, dropApps, dropFiles, extraRoots, addRoot, removeRoot, goal, setGoal, tab, setTab, appFilter,
      setAppFilter, appSort, setAppSort, fileView, setFileView, selApps, setSelApps, selFiles, setSelFiles, binHint, setBinHint
    }),
    [
      drives, places, extras, apps, icons, appsMeasured, files, map, status, failed, start, refreshApps, refreshFiles, scanMap,
      refreshDrives, refreshExtras, dropApps, dropFiles, extraRoots, addRoot, removeRoot, goal, setGoal, tab, appFilter, appSort,
      fileView, selApps, selFiles, binHint
    ]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
