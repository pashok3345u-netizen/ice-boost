import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import {
  AppWindow, Copy, Files, Gamepad2, HardDrive, History, Map as MapIcon, Minus, MonitorCog, Moon, Package, Plus, Sparkles, Target, Trash2
} from 'lucide-react'
import { fileKind, isInside } from '../../../shared/space'
import { useStore } from '../store'
import { useProgress } from '../progress'
import { GB, isOldApp, useSpace, type SpaceTab } from '../space'
import { isGame } from '../catalog'
import { Badge, Button, Card, CountUp, PageHeader, Skeleton, cx } from '../ui'
import { C } from '../theme'
import { daysSince, errText, fmtBytes } from '../format'
import { blizzard, burst } from '../Fx'
import { AppsTab } from './space/AppsTab'
import { FilesTab } from './space/FilesTab'
import { MapTab } from './space/MapTab'

const TABS: { id: SpaceTab; icon: ReactNode }[] = [
  { id: 'apps', icon: <AppWindow className="size-4" /> },
  { id: 'files', icon: <Files className="size-4" /> },
  { id: 'map', icon: <MapIcon className="size-4" /> }
]

export function Space(): ReactNode {
  const { t } = useTranslation()
  const s = useSpace()
  const { start, refreshDrives } = s

  useEffect(() => {
    start()
    const id = setInterval(() => void refreshDrives(), 5000)
    return () => clearInterval(id)
  }, [start, refreshDrives])

  const count: Record<SpaceTab, string | null> = {
    apps: s.apps ? String(s.apps.length) : null,
    files: null,
    map: null
  }

  return (
    <div>
      <PageHeader icon={<HardDrive className="size-5" />} title={t('space.title')} subtitle={t('space.subtitle')} />
      <div className="mb-5 grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-5">
        <GoalCard />
        <QuickWins />
      </div>

      <div className="mb-4 flex gap-1 rounded-2xl border border-line bg-deep/60 p-1">
        {TABS.map((x) => (
          <button
            key={x.id}
            onClick={() => s.setTab(x.id)}
            className={cx(
              'relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm transition-colors',
              s.tab === x.id ? 'font-medium text-frost' : 'text-muted hover:text-text'
            )}
          >
            {s.tab === x.id && (
              <motion.span
                layoutId="space-tab"
                className="absolute inset-0 rounded-xl border border-teal/50 bg-teal/25"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative">{x.icon}</span>
            <span className="relative">{t(`space.tabs.${x.id}`)}</span>
            {count[x.id] && <span className="relative text-xs text-muted">{count[x.id]}</span>}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={s.tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {s.tab === 'apps' ? <AppsTab /> : s.tab === 'files' ? <FilesTab /> : <MapTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/** "I need N GB for a game": free space, what's picked to remove, and the goal line. */
function GoalCard(): ReactNode {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const fmt = (v: number): string => fmtBytes(v, lang)
  const { toast } = useStore()
  const { track } = useProgress()
  const s = useSpace()
  const { goal, setGoal } = s
  const d = s.drives?.find((x) => x.root === goal.drive)
  const need = goal.gb * GB
  const free = d?.free ?? 0

  const pickedApps = (s.apps ?? []).filter((a) => s.selApps.has(a.id) && a.drive === goal.drive).reduce((a, x) => a + (x.size ?? 0), 0)
  const pickedFiles = (s.files?.files ?? [])
    .filter((f) => s.selFiles.has(f.path) && f.path.slice(0, 2).toUpperCase() === goal.drive)
    .reduce((a, f) => a + f.size, 0)
  const picked = pickedApps + pickedFiles
  const after = free + picked
  const scale = Math.max(need, after, 1) * 1.08

  // celebrate once when the goal is reached by removing things (not by typing a smaller number)
  const was = useRef<{ key: string; short: boolean } | null>(null)
  useEffect(() => {
    if (!d) return
    const key = `${goal.drive}|${goal.gb}`
    const short = free < need
    if (was.current && was.current.key === key && was.current.short && !short) {
      blizzard()
      toast(t('space.goal.reached', { drive: goal.drive }))
      track({ type: 'goal' })
    }
    was.current = { key, short }
  }, [d, free, need, goal.drive, goal.gb, t, toast, track])

  const setGb = (gb: number): void => setGoal({ ...goal, gb: Math.max(1, Math.min(9999, Math.round(gb))) })
  const state = free >= need ? 'enough' : after >= need ? 'enoughAfter' : picked > 0 ? 'shortAfter' : 'short'

  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-teal/20 blur-3xl" />
      <div className="relative">
        <h2 className="font-display mb-2.5 flex items-center gap-2 text-sm font-semibold">
          <Target className="size-4 text-ice" />
          {t('space.goal.title')}
        </h2>
        <div className="mb-3">
          <div className="flex flex-wrap gap-1.5">
            {(s.drives ?? []).map((x) => (
              <button
                key={x.root}
                onClick={() => setGoal({ ...goal, drive: x.root })}
                className={cx(
                  'flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs transition-colors',
                  x.root === goal.drive ? 'border-teal/70 bg-teal/25 text-frost' : 'border-line bg-panel2/60 text-muted hover:text-text'
                )}
              >
                <span className="font-display font-semibold">{x.root}</span>
                <span className="tabular-nums">{t('space.goal.driveFree', { free: fmt(x.free), total: fmt(x.total) })}</span>
                {x.system && <MonitorCog className="size-3 opacity-70" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <div className="text-xs text-muted">{t('space.goal.free', { drive: goal.drive })}</div>
            <div className="font-display frost-text text-4xl font-bold tabular-nums">{d ? <CountUp value={free} format={fmt} /> : '…'}</div>
          </div>
          <AnimatePresence>
            {picked > 0 && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <div className="text-xs text-muted">{t('space.goal.after')}</div>
                <div className="font-display text-2xl font-bold text-ice tabular-nums">
                  <CountUp value={after} format={fmt} duration={500} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="ml-auto">
            <div className="mb-1 text-xs text-muted">{t('space.goal.need')}</div>
            <div className="flex items-center gap-1.5">
              <button className="grid size-9 place-items-center rounded-lg border border-line bg-panel2 hover:border-teal/60" onClick={() => setGb(goal.gb - 5)}>
                <Minus className="size-4" />
              </button>
              <input
                type="number"
                value={goal.gb}
                min={1}
                onChange={(e) => setGb(Number(e.target.value) || 1)}
                className="no-spin font-display h-9 w-20 rounded-lg border border-line bg-panel2 text-center text-lg font-semibold outline-none focus:border-teal/70"
              />
              <button className="grid size-9 place-items-center rounded-lg border border-line bg-panel2 hover:border-teal/60" onClick={() => setGb(goal.gb + 5)}>
                <Plus className="size-4" />
              </button>
              <span className="text-sm text-muted">{t('space.goal.gb')}</span>
            </div>
          </div>
        </div>

        {/* free (solid) + picked (striped) against the goal line */}
        <div className="relative mt-5 h-4 rounded-full bg-[#3a3a43]">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: `linear-gradient(90deg, ${C.teal}, ${free >= need ? C.good : C.ice})` }}
            initial={false}
            animate={{ width: `${(Math.min(free, scale) / scale) * 100}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          />
          <motion.div
            className="stripes absolute inset-y-0 rounded-r-full bg-ice/45"
            initial={false}
            animate={{ left: `${(free / scale) * 100}%`, width: `${(picked / scale) * 100}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          />
          <motion.div
            className="absolute -top-1.5 -bottom-1.5 w-0.5 rounded-full bg-frost shadow-[0_0_10px_rgba(217,231,232,0.8)]"
            initial={false}
            animate={{ left: `${(need / scale) * 100}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
          <span className={cx(state === 'enough' || state === 'enoughAfter' ? 'text-good' : 'text-warn')}>
            {t(`space.goal.${state}`, { size: fmt(Math.max(0, need - after)) })}
          </span>
          {picked > 0 && (
            <span className="text-xs text-muted">
              {t('space.goal.selected')}: <span className="text-ice tabular-nums">{fmt(picked)}</span>
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-muted/70">{t('space.goal.hint')}</p>
      </div>
    </Card>
  )
}

interface Win {
  id: string
  size: number | null
  icon: ReactNode
  text?: string
  action: () => void | Promise<void>
}

/** The biggest easy wins, each with one button. */
function QuickWins(): ReactNode {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const fmt = (v: number): string => fmtBytes(v, lang)
  const { junk, go, toast, scan, sys } = useStore()
  const { track } = useProgress()
  const s = useSpace()
  const [busy, setBusy] = useState<string | null>(null)
  const admin = !!sys?.isAdmin

  const emptyBin = async (e?: { clientX: number; clientY: number }): Promise<void> => {
    setBusy('recycle')
    try {
      const r = await window.api.cleanJunk(['recycle'])
      track({ type: 'clean', freed: r.freed })
      burst(e ? { x: e.clientX, y: e.clientY, big: r.freed > GB } : { big: r.freed > GB })
      toast(t('cleaner.resultTitle', { size: fmt(r.freed) }))
      s.setBinHint(false)
      void s.refreshExtras()
      void s.refreshDrives()
      void scan()
    } catch (err) {
      toast(errText(err, t('common.uacDenied')), 'err')
    } finally {
      setBusy(null)
    }
  }

  const wins = useMemo<Win[]>(() => {
    const out: Win[] = []
    const x = s.extras
    // the bin's button calls emptyBin() itself (it needs the click position for confetti)
    if (x && x.recycle > 20 * 1024 ** 2) out.push({ id: 'recycle', size: x.recycle, icon: <Trash2 className="size-4" />, action: () => {} })
    const junkSize = (junk ?? []).filter((j) => j.defaultOn && j.id !== 'recycle').reduce((a, j) => a + (j.size ?? 0), 0)
    if (junkSize > 100 * 1024 ** 2) out.push({ id: 'junk', size: junkSize, icon: <Sparkles className="size-4" />, action: () => go('cleaner') })
    // games on the disk the space is needed on
    const games = (s.apps ?? []).filter((a) => isGame(a) && a.drive === s.goal.drive)
    const oldGames = games.filter((a) => isOldApp(a, admin))
    if (oldGames.length)
      out.push({
        id: 'oldGames',
        size: oldGames.reduce((a, g) => a + (g.size ?? 0), 0),
        icon: <Gamepad2 className="size-4" />,
        text: t('space.wins.oldGames.d', { n: oldGames.length }),
        action: () => {
          s.setTab('apps')
          s.setAppFilter('games')
          s.setAppSort('last')
        }
      })
    // nothing old? the biggest game is still the quickest way to make room
    const biggest = games.filter((a) => (a.size ?? 0) > 5 * GB).sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[0]
    if (biggest && !oldGames.some((g) => g.id === biggest.id))
      out.push({
        id: 'biggest',
        size: biggest.size,
        icon: <Gamepad2 className="size-4" />,
        text: t('space.wins.biggest.d', { name: biggest.name }),
        action: () => {
          s.setTab('apps')
          s.setAppFilter('games')
          s.setAppSort('size')
        }
      })
    const files = s.files?.files ?? []
    const downloads = s.places?.downloads
    const installers = downloads ? files.filter((f) => fileKind(f.path) === 'installer' && isInside(f.path, downloads) && daysSince(f.lastUsed) >= 30) : []
    const instSize = installers.reduce((a, f) => a + f.size, 0)
    if (instSize > 50 * 1024 ** 2)
      out.push({
        id: 'installers',
        size: instSize,
        icon: <Package className="size-4" />,
        action: () => {
          s.setTab('files')
          s.setFileView({ ...s.fileView, mode: 'old', kind: 'installer', age: 30, minSize: 10 * 1024 ** 2 })
        }
      })
    const groups = new Map<string, number[]>()
    for (const f of files) if (f.copyOf) groups.set(f.copyOf, [...(groups.get(f.copyOf) ?? []), f.size])
    const wasted = [...groups.values()].reduce((a, g) => a + (g.length > 1 ? g[0] * (g.length - 1) : 0), 0)
    if (wasted > 100 * 1024 ** 2)
      out.push({
        id: 'copies',
        size: wasted,
        icon: <Copy className="size-4" />,
        action: () => {
          s.setTab('files')
          s.setFileView({ ...s.fileView, mode: 'copies', kind: 'all' })
        }
      })
    if (x?.hiberfil) out.push({ id: 'hiberfil', size: x.hiberfil, icon: <Moon className="size-4" />, action: () => go('boost') })
    if (x?.windowsOld) out.push({ id: 'windowsOld', size: null, icon: <History className="size-4" />, action: () => void window.api.openStorageSettings() })
    return out.sort((a, b) => (b.size ?? 0) - (a.size ?? 0)).slice(0, 5)
  }, [s, junk, admin, t, go])

  const loading = !s.extras || !s.apps || (!s.files && !s.failed.files)

  return (
    <Card delay={0.05} className="flex flex-col">
      <h2 className="font-display mb-3 flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4 text-ice" />
        {t('space.wins.title')}
      </h2>
      <div className="flex-1 space-y-2">
        {wins.map((w, i) => (
          <motion.div
            key={w.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i }}
            className={cx(
              'flex items-center gap-3 rounded-xl border bg-panel2/70 px-3 py-2.5',
              w.id === 'recycle' && s.binHint ? 'pulse border-teal/70' : 'border-line'
            )}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-teal/15 text-ice">{w.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{t(`space.wins.${w.id}.t`)}</span>
                {w.size != null && <Badge tone="frost">{fmt(w.size)}</Badge>}
              </div>
              <div className="truncate text-[11px] text-muted" title={w.text ?? t(`space.wins.${w.id}.d`)}>
                {w.text ?? t(`space.wins.${w.id}.d`)}
              </div>
            </div>
            <Button
              size="sm"
              variant={w.id === 'recycle' ? 'primary' : 'soft'}
              loading={busy === w.id}
              onClick={(e) => (w.id === 'recycle' ? void emptyBin(e) : void w.action())}
            >
              {t(`space.wins.${w.id}.a`)}
            </Button>
          </motion.div>
        ))}
        {wins.length === 0 &&
          (loading ? (
            <div className="space-y-2">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <p className="pt-1 text-center text-xs text-muted">{t('space.wins.searching')}</p>
            </div>
          ) : (
            <div className="grid h-full place-items-center py-6 text-center text-sm text-muted">{t('space.wins.none')}</div>
          ))}
        {wins.length > 0 && loading && <p className="text-center text-[11px] text-muted">{t('space.wins.searching')}</p>}
      </div>
    </Card>
  )
}
