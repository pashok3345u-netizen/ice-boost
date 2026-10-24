import { useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { Activity, CircleCheck, CircleX, Gauge, Gpu as GpuIcon, Info, Power, Rocket, Settings as SettingsIcon, Sparkles, Trophy } from 'lucide-react'
import { checkGpu, tempLevel } from '../../shared/gpu'
import { StoreProvider, useStore, type Page } from './store'
import { ProgressProvider, useProgress, levelOf, titleKey, ACHIEVEMENTS } from './progress'
import { useHealth } from './health'
import { Badge, Logo, cx } from './ui'
import { BurstLayer, SnowBackground, blizzard } from './Fx'
import { MascotMini } from './Mascot'
import { Dashboard } from './pages/Dashboard'
import { Gpu, LEVEL_COLOR } from './pages/Gpu'
import { Boost } from './pages/Boost'
import { Cleaner } from './pages/Cleaner'
import { Startup } from './pages/Startup'
import { Processes } from './pages/Processes'
import { Achievements } from './pages/Achievements'
import { Settings } from './pages/Settings'

const NAV: { id: Page; icon: ReactNode }[] = [
  { id: 'dashboard', icon: <Gauge className="size-[18px]" /> },
  { id: 'gpu', icon: <GpuIcon className="size-[18px]" /> },
  { id: 'boost', icon: <Rocket className="size-[18px]" /> },
  { id: 'cleaner', icon: <Sparkles className="size-[18px]" /> },
  { id: 'startup', icon: <Power className="size-[18px]" /> },
  { id: 'processes', icon: <Activity className="size-[18px]" /> },
  { id: 'achievements', icon: <Trophy className="size-[18px]" /> },
  { id: 'settings', icon: <SettingsIcon className="size-[18px]" /> }
]

const PAGES: Record<Page, () => ReactNode> = {
  dashboard: Dashboard,
  gpu: Gpu,
  boost: Boost,
  cleaner: Cleaner,
  startup: Startup,
  processes: Processes,
  achievements: Achievements,
  settings: Settings
}

function Profile(): ReactNode {
  const { t } = useTranslation()
  const { go } = useStore()
  const { xp, lastGain, unlocked } = useProgress()
  const { score, ready } = useHealth()
  const { level, into, need } = levelOf(xp)
  return (
    <button
      onClick={() => go('achievements')}
      className="card card-hover relative mt-auto w-full rounded-2xl border border-line p-3 text-left"
    >
      <AnimatePresence>
        {lastGain && (
          <motion.span
            key={lastGain.id}
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: [0, 1, 1, 0], y: -46 }}
            transition={{ duration: 1.8 }}
            className="font-display pointer-events-none absolute top-0 right-3 text-sm font-bold text-good"
          >
            +{lastGain.amount} XP
          </motion.span>
        )}
      </AnimatePresence>
      <div className="flex items-center gap-2.5">
        <MascotMini score={ready ? score : 60} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-semibold">{t('ach.level', { n: level })}</div>
          <div className="truncate text-[11px] text-ice">{t(`ach.title.${titleKey(level)}`)}</div>
        </div>
        <div className="text-[11px] text-muted">
          🏆 {Object.keys(unlocked).length}/{ACHIEVEMENTS.length}
        </div>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#3a3a43]">
        <motion.div
          className="accent-gradient h-full rounded-full"
          initial={false}
          animate={{ width: `${(into / need) * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
      <div className="mt-1 text-right text-[10px] text-muted tabular-nums">{t('ach.xp', { a: into, b: need })}</div>
    </button>
  )
}

function Shell(): ReactNode {
  const { t } = useTranslation()
  const { page, go, sys, gpu, toasts } = useStore()
  const { track } = useProgress()
  const logoClicks = useRef<number[]>([])
  const PageView = PAGES[page]
  // GPU temperature right in the menu; blinks when the card is hot
  const gpuNow = gpu?.now
  const gpuLevel = gpuNow ? checkGpu(gpuNow).level : 'ok'
  const gpuAlarm = gpuLevel === 'hot' || gpuLevel === 'danger'
  const gpuTemp =
    gpuNow?.temp != null
      ? { v: Math.round(gpuNow.temp), color: gpuAlarm ? LEVEL_COLOR[gpuLevel] : LEVEL_COLOR[tempLevel(gpuNow.temp, gpuNow.maxTemp)] }
      : null

  // easter egg: click the logo 5 times fast
  const onLogo = (): void => {
    const now = Date.now()
    logoClicks.current = [...logoClicks.current.filter((x) => now - x < 2000), now]
    if (logoClicks.current.length >= 5) {
      logoClicks.current = []
      blizzard()
      track({ type: 'secret' })
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="drag flex h-10 shrink-0 items-center gap-2.5 bg-deep pl-4 pr-[150px]">
        <motion.button className="no-drag" whileHover={{ rotate: 12, scale: 1.1 }} whileTap={{ scale: 0.85 }} onClick={onLogo}>
          <Logo size={20} />
        </motion.button>
        <span className="font-display text-[13px] font-semibold tracking-wide">IceBoost</span>
        <span className="text-[11px] text-muted">v0.3</span>
        {sys && (
          <span className="ml-2">
            <Badge tone={sys.isAdmin ? 'good' : 'muted'}>{sys.isAdmin ? t('common.adminOn') : t('common.adminOff')}</Badge>
          </span>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-60 shrink-0 flex-col gap-1 bg-deep p-3">
          {NAV.map((n, i) => (
            <motion.button
              key={n.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.04 * i }}
              whileHover={{ x: 3 }}
              onClick={() => go(n.id)}
              className={cx(
                'relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors',
                page === n.id ? 'font-medium text-frost' : 'text-muted hover:text-text'
              )}
            >
              {page === n.id && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-xl border border-teal/50 bg-teal/25 shadow-[0_0_24px_-8px_rgba(82,138,154,0.9)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className={cx('relative', page === n.id && 'text-ice')}>{n.icon}</span>
              <span className="relative">{t(`nav.${n.id}`)}</span>
              {n.id === 'gpu' && gpuTemp && (
                <span
                  className={cx('relative ml-auto flex items-center gap-1.5 text-xs font-medium tabular-nums', gpuAlarm && 'animate-pulse')}
                  style={{ color: gpuTemp.color }}
                >
                  {gpuAlarm && <span className="size-1.5 rounded-full bg-current" />}
                  {gpuTemp.v}°
                </span>
              )}
            </motion.button>
          ))}
          <Profile />
        </nav>

        <main className="relative min-w-0 flex-1 overflow-hidden rounded-tl-2xl border-t border-l border-line/70 bg-bg">
          <div className="glow-bg pointer-events-none absolute inset-0" />
          <SnowBackground />
          <div className="absolute inset-0 overflow-y-auto px-8 py-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={page}
                initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                transition={{ duration: 0.22 }}
              >
                <PageView />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <div className="pointer-events-none fixed right-5 bottom-5 z-[60] flex w-96 flex-col gap-2">
        <AnimatePresence>
          {toasts.map((x) => (
            <motion.div
              key={x.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className={cx(
                'card flex items-start gap-2.5 rounded-xl border bg-panel px-4 py-3 text-sm shadow-2xl',
                x.kind === 'err' ? 'border-bad/50' : x.kind === 'info' ? 'border-teal/50' : 'border-good/50'
              )}
            >
              {x.kind === 'err' ? (
                <CircleX className="mt-0.5 size-4 shrink-0 text-bad" />
              ) : x.kind === 'info' ? (
                <Info className="mt-0.5 size-4 shrink-0 text-ice" />
              ) : (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-good" />
              )}
              <span>{x.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <BurstLayer />
    </div>
  )
}

export function App(): ReactNode {
  return (
    <StoreProvider>
      <ProgressProvider>
        <Shell />
      </ProgressProvider>
    </StoreProvider>
  )
}
