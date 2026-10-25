// Grind system: XP for every optimization, levels with titles, achievements.
// Saved in the app's local storage (stays between launches).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { TWEAKS } from '../../shared/tweaks'
import { useStore } from './store'
import { useHealth } from './health'
import { burst } from './Fx'

export interface Stats {
  freed: number
  cleans: number
  tweaks: number
  oneClicks: number
  startupOff: number
  appsClosed: number
  visits: number
  streak: number
  lastVisit: string
  bestScore: number
  uninstalls: number
  /** files moved to the Recycle Bin from the Disk Space page */
  trashed: number
  /** of them: not opened for over a year */
  oldFiles: number
}

interface Saved {
  xp: number
  stats: Stats
  unlocked: Record<string, string>
}

export interface Achievement {
  id: string
  emoji: string
  xp: number
  secret?: boolean
  /** progress 0..1 for the card's bar */
  progress: (s: Stats, extra: { allRec: boolean }) => number
}

const GB = 1024 ** 3

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'firstClean', emoji: '🧹', xp: 25, progress: (s) => Math.min(1, s.cleans) },
  { id: 'gb1', emoji: '💾', xp: 50, progress: (s) => s.freed / GB },
  { id: 'gb10', emoji: '🏔️', xp: 150, progress: (s) => s.freed / (10 * GB) },
  { id: 'firstTweak', emoji: '⚙️', xp: 25, progress: (s) => Math.min(1, s.tweaks) },
  { id: 'allRec', emoji: '🚀', xp: 100, progress: (_s, e) => (e.allRec ? 1 : 0) },
  { id: 'oneClick', emoji: '⚡', xp: 40, progress: (s) => Math.min(1, s.oneClicks) },
  { id: 'startup3', emoji: '🔌', xp: 50, progress: (s) => s.startupOff / 3 },
  { id: 'gamer', emoji: '🎮', xp: 25, progress: (s) => Math.min(1, s.appsClosed) },
  { id: 'score90', emoji: '🏆', xp: 100, progress: (s) => s.bestScore / 90 },
  { id: 'streak3', emoji: '🔥', xp: 60, progress: (s) => s.streak / 3 },
  { id: 'streak7', emoji: '💎', xp: 150, progress: (s) => s.streak / 7 },
  { id: 'firstUninstall', emoji: '📦', xp: 25, progress: (s) => Math.min(1, s.uninstalls) },
  { id: 'uninstall5', emoji: '🧳', xp: 80, progress: (s) => s.uninstalls / 5 },
  { id: 'oldFile', emoji: '🦖', xp: 40, progress: (s) => Math.min(1, s.oldFiles) },
  { id: 'goal', emoji: '🎯', xp: 100, progress: () => 0 },
  { id: 'gb50', emoji: '🌋', xp: 250, progress: (s) => s.freed / (50 * GB) },
  { id: 'nightOwl', emoji: '🦉', xp: 30, progress: () => 0 },
  { id: 'secret', emoji: '❄️', xp: 77, secret: true, progress: () => 0 }
]

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return 80 + 40 * level
}

export function levelOf(xp: number): { level: number; into: number; need: number } {
  let level = 1
  let left = xp
  while (left >= xpToNext(level)) {
    left -= xpToNext(level)
    level++
  }
  return { level, into: left, need: xpToNext(level) }
}

const TITLES: [number, string][] = [
  [16, 'legend'],
  [12, 'guru'],
  [8, 'master'],
  [5, 'optimizer'],
  [3, 'cleaner'],
  [1, 'newbie']
]
export function titleKey(level: number): string {
  return TITLES.find(([min]) => level >= min)![1]
}

const EMPTY: Saved = {
  xp: 0,
  stats: {
    freed: 0, cleans: 0, tweaks: 0, oneClicks: 0, startupOff: 0, appsClosed: 0, visits: 0, streak: 0, lastVisit: '', bestScore: 0,
    uninstalls: 0, trashed: 0, oldFiles: 0
  },
  unlocked: {}
}

function load(): Saved {
  try {
    const raw = localStorage.getItem('iceboost.progress')
    if (raw) {
      const p = JSON.parse(raw) as Saved
      return { ...EMPTY, ...p, stats: { ...EMPTY.stats, ...p.stats }, unlocked: p.unlocked ?? {} }
    }
  } catch {
    // ignore
  }
  return structuredClone(EMPTY)
}

function save(p: Saved): void {
  try {
    localStorage.setItem('iceboost.progress', JSON.stringify(p))
  } catch {
    // ignore
  }
}

const today = (): string => new Date().toISOString().slice(0, 10)

export type TrackEvent =
  | { type: 'clean'; freed: number }
  | { type: 'tweaks'; count: number }
  | { type: 'oneClick' }
  | { type: 'startupOff' }
  | { type: 'appsClosed' }
  | { type: 'uninstall'; freed: number }
  | { type: 'trash'; count: number; old: number }
  | { type: 'goal' }
  | { type: 'secret' }

interface Gain {
  id: number
  amount: number
}

interface Ctx {
  xp: number
  stats: Stats
  unlocked: Record<string, string>
  allRec: boolean
  lastGain: Gain | null
  track: (e: TrackEvent) => void
}

const ProgressCtx = createContext<Ctx | null>(null)

export function useProgress(): Ctx {
  const c = useContext(ProgressCtx)
  if (!c) throw new Error('ProgressProvider missing')
  return c
}

export function ProgressProvider({ children }: { children: ReactNode }): ReactNode {
  const { t } = useTranslation()
  const { tweaks } = useStore()
  const { score, ready } = useHealth()
  const [data, setData] = useState<Saved>(load)
  const [lastGain, setLastGain] = useState<Gain | null>(null)
  const [popups, setPopups] = useState<{ id: number; ach?: Achievement; level?: number }[]>([])
  const gainId = useRef(0)

  const allRec = useMemo(
    () => !!tweaks && tweaks.length > 0 && TWEAKS.filter((tw) => tw.recommended).every((tw) => tweaks.find((s) => s.id === tw.id)?.applied),
    [tweaks]
  )

  const dataRef = useRef(data)

  // applies a change, gives XP, unlocks achievements and shows popups
  const update = useCallback(
    (fn: (p: Saved) => { p: Saved; xp: number }, extra?: { allRec?: boolean; force?: string[] }) => {
      const prev = dataRef.current
      const { p, xp } = fn(structuredClone(prev))
      let gained = xp
      const newAch: Achievement[] = []
      for (const a of ACHIEVEMENTS) {
        if (p.unlocked[a.id]) continue
        const done = extra?.force?.includes(a.id) || a.progress(p.stats, { allRec: extra?.allRec ?? false }) >= 1
        if (done) {
          p.unlocked[a.id] = new Date().toISOString()
          gained += a.xp
          newAch.push(a)
        }
      }
      const before = levelOf(prev.xp).level
      p.xp = prev.xp + gained
      const after = levelOf(p.xp).level
      dataRef.current = p
      save(p)
      setData(p)
      if (gained > 0) {
        setLastGain({ id: ++gainId.current, amount: gained })
        setPopups((q) => [
          ...q,
          ...newAch.map((ach) => ({ id: ++gainId.current, ach })),
          ...(after > before ? [{ id: ++gainId.current, level: after }] : [])
        ])
      }
    },
    []
  )

  const track = useCallback(
    (e: TrackEvent) => {
      update((p) => {
        const s = p.stats
        switch (e.type) {
          case 'clean':
            s.cleans++
            s.freed += e.freed
            return { p, xp: 10 + Math.min(200, Math.floor(e.freed / (50 * 1024 ** 2))) }
          case 'tweaks':
            s.tweaks += e.count
            return { p, xp: 15 * e.count }
          case 'oneClick':
            s.oneClicks++
            return { p, xp: 50 }
          case 'startupOff':
            s.startupOff++
            return { p, xp: 10 }
          case 'appsClosed':
            s.appsClosed++
            return { p, xp: 5 }
          case 'uninstall':
            s.uninstalls++
            s.freed += e.freed
            return { p, xp: 20 + Math.min(200, Math.floor(e.freed / (100 * 1024 ** 2))) }
          // the space is freed only when the bin is emptied — that counts as a cleaning
          case 'trash':
            s.trashed += e.count
            s.oldFiles += e.old
            return { p, xp: 5 + Math.min(45, 2 * e.count) }
          case 'goal':
            return { p, xp: 0 }
          case 'secret':
            return { p, xp: 0 }
        }
      }, { allRec, force: e.type === 'secret' ? ['secret'] : e.type === 'goal' ? ['goal'] : undefined })
    },
    [update, allRec]
  )

  // daily visit: streak + night owl
  useEffect(() => {
    update((p) => {
      const s = p.stats
      const d = today()
      if (s.lastVisit === d) return { p, xp: 0 }
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      s.streak = s.lastVisit === yesterday ? s.streak + 1 : 1
      s.lastVisit = d
      s.visits++
      return { p, xp: 10 + Math.min(30, 5 * (s.streak - 1)) }
    }, { force: new Date().getHours() < 5 ? ['nightOwl'] : undefined })
  }, [update])

  // best score and "all recommended" are checked whenever they change
  useEffect(() => {
    if (!ready) return
    update((p) => {
      p.stats.bestScore = Math.max(p.stats.bestScore, score)
      return { p, xp: 0 }
    }, { allRec })
  }, [ready, score, allRec, update])

  const value = useMemo<Ctx>(
    () => ({ xp: data.xp, stats: data.stats, unlocked: data.unlocked, allRec, lastGain, track }),
    [data, allRec, lastGain, track]
  )

  // one popup at a time
  const current = popups[0]
  useEffect(() => {
    if (!current) return
    burst({ y: current.level ? undefined : 90, big: !!current.level })
    const id = setTimeout(() => setPopups((q) => q.slice(1)), current.level ? 3800 : 3200)
    return () => clearTimeout(id)
  }, [current])

  return (
    <ProgressCtx.Provider value={value}>
      {children}
      <AnimatePresence>
        {current?.ach && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: -60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
            className="card fixed top-14 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-teal/60 px-5 py-3.5 shadow-2xl shadow-teal/30"
            onClick={() => setPopups((q) => q.slice(1))}
          >
            <motion.div
              initial={{ rotate: -30, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', delay: 0.15 }}
              className="accent-gradient grid size-12 place-items-center rounded-xl text-2xl"
            >
              {current.ach.emoji}
            </motion.div>
            <div>
              <div className="text-[11px] font-semibold tracking-widest text-ice uppercase">{t('ach.unlocked')}</div>
              <div className="font-display text-base font-semibold">{t(`ach.list.${current.ach.id}.t`)}</div>
            </div>
            <div className="font-display ml-2 text-lg font-bold text-good">+{current.ach.xp} XP</div>
          </motion.div>
        )}
        {current?.level && (
          <motion.div
            key={current.id}
            className="fixed inset-0 z-[85] grid place-items-center bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPopups((q) => q.slice(1))}
          >
            <motion.div
              initial={{ scale: 0.4, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
              className="text-center"
            >
              <div className="text-sm font-semibold tracking-[0.3em] text-ice uppercase">{t('ach.levelUp')}</div>
              <div className="font-display frost-text text-[120px] leading-none font-black">{current.level}</div>
              <div className="font-display mt-2 text-xl">{t(`ach.title.${titleKey(current.level)}`)}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ProgressCtx.Provider>
  )
}
