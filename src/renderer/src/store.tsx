// App-wide data: PC info, live load, scan results, startup list and tweak states.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { JunkResult, LiveStats, StartupItem, SystemInfo, TweakState } from '../../shared/types'

export type Page = 'dashboard' | 'boost' | 'cleaner' | 'startup' | 'processes' | 'settings'
export type ToastKind = 'ok' | 'err' | 'info'

interface Toast {
  id: number
  text: string
  kind: ToastKind
}

interface Store {
  page: Page
  go: (p: Page) => void
  sys: SystemInfo | null
  live: LiveStats | null
  history: { cpu: number[]; ram: number[]; gpu: number[] }
  junk: JunkResult[] | null
  scanning: boolean
  scan: () => Promise<void>
  startup: StartupItem[] | null
  loadStartup: () => Promise<void>
  tweaks: TweakState[] | null
  loadTweaks: () => Promise<void>
  restoreDone: boolean
  setRestoreDone: (v: boolean) => void
  toasts: Toast[]
  toast: (text: string, kind?: ToastKind) => void
}

const Ctx = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}

const HISTORY = 60

export function StoreProvider({ children }: { children: ReactNode }): ReactNode {
  const [page, setPage] = useState<Page>('dashboard')
  const [sys, setSys] = useState<SystemInfo | null>(null)
  const [live, setLive] = useState<LiveStats | null>(null)
  const [history, setHistory] = useState({ cpu: [] as number[], ram: [] as number[], gpu: [] as number[] })
  const [junk, setJunk] = useState<JunkResult[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [startup, setStartup] = useState<StartupItem[] | null>(null)
  const [tweaks, setTweaks] = useState<TweakState[] | null>(null)
  const [restoreDone, setRestoreDone] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)

  const toast = useCallback((text: string, kind: ToastKind = 'ok') => {
    const id = ++toastId.current
    setToasts((t) => [...t.slice(-3), { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'err' ? 7000 : 4000)
  }, [])

  const scanBusy = useRef(false)
  const scan = useCallback(async () => {
    if (scanBusy.current) return
    scanBusy.current = true
    setScanning(true)
    try {
      setJunk(await window.api.scanJunk())
    } catch {
      setJunk([])
    } finally {
      scanBusy.current = false
      setScanning(false)
    }
  }, [])

  const loadStartup = useCallback(async () => {
    try {
      setStartup(await window.api.getStartup())
    } catch {
      setStartup([])
    }
  }, [])

  const loadTweaks = useCallback(async () => {
    try {
      setTweaks(await window.api.getTweaks())
    } catch {
      setTweaks([])
    }
  }, [])

  // first load
  useEffect(() => {
    window.api.getSystemInfo().then(setSys).catch(() => {})
    void loadTweaks()
    void loadStartup()
    void scan()
  }, [loadTweaks, loadStartup, scan])

  // live load every 1.5 s
  useEffect(() => {
    let alive = true
    const tick = async (): Promise<void> => {
      try {
        const l = await window.api.getLive()
        if (!alive) return
        setLive(l)
        setHistory((h) => ({
          cpu: [...h.cpu, l.cpu].slice(-HISTORY),
          ram: [...h.ram, (l.ramUsed / l.ramTotal) * 100].slice(-HISTORY),
          gpu: l.gpu == null ? h.gpu : [...h.gpu, l.gpu].slice(-HISTORY)
        }))
      } catch {
        // ignore one missed tick
      }
    }
    void tick()
    const id = setInterval(tick, 1500)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const go = useCallback((p: Page) => setPage(p), [])
  useEffect(() => {
    window.__iceGoto = (p: string) => setPage(p as Page)
  }, [])

  const value = useMemo<Store>(
    () => ({
      page, go, sys, live, history, junk, scanning, scan, startup, loadStartup, tweaks, loadTweaks,
      restoreDone, setRestoreDone, toasts, toast
    }),
    [page, go, sys, live, history, junk, scanning, scan, startup, loadStartup, tweaks, loadTweaks, restoreDone, toasts, toast]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
