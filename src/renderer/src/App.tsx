import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, CircleCheck, CircleX, Gauge, Info, Power, Rocket, Settings as SettingsIcon, Sparkles } from 'lucide-react'
import { StoreProvider, useStore, type Page } from './store'
import { Badge, Logo, cx } from './ui'
import { Dashboard } from './pages/Dashboard'
import { Boost } from './pages/Boost'
import { Cleaner } from './pages/Cleaner'
import { Startup } from './pages/Startup'
import { Processes } from './pages/Processes'
import { Settings } from './pages/Settings'

const NAV: { id: Page; icon: ReactNode }[] = [
  { id: 'dashboard', icon: <Gauge className="size-[18px]" /> },
  { id: 'boost', icon: <Rocket className="size-[18px]" /> },
  { id: 'cleaner', icon: <Sparkles className="size-[18px]" /> },
  { id: 'startup', icon: <Power className="size-[18px]" /> },
  { id: 'processes', icon: <Activity className="size-[18px]" /> },
  { id: 'settings', icon: <SettingsIcon className="size-[18px]" /> }
]

function Shell(): ReactNode {
  const { t } = useTranslation()
  const { page, go, sys, toasts } = useStore()

  return (
    <div className="flex h-full flex-col">
      <header className="drag flex h-10 shrink-0 items-center gap-2.5 border-b border-line/60 pl-4 pr-[150px]">
        <Logo size={20} />
        <span className="text-sm font-semibold tracking-wide">IceBoost</span>
        <span className="text-[11px] text-muted">v0.1</span>
        {sys && (
          <span className="ml-2">
            <Badge tone={sys.isAdmin ? 'good' : 'muted'}>{sys.isAdmin ? t('common.adminOn') : t('common.adminOff')}</Badge>
          </span>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-line/60 p-3">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={cx(
                'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition',
                page === n.id ? 'bg-ice/10 font-medium text-ice' : 'text-muted hover:bg-panel2 hover:text-text'
              )}
            >
              {n.icon}
              {t(`nav.${n.id}`)}
            </button>
          ))}
          <div className="mt-auto rounded-xl border border-line bg-panel/60 p-3 text-[11px] leading-relaxed text-muted">
            {sys ? (
              <>
                <div className="truncate text-text">{sys.cpu.replace(/\(R\)|\(TM\)|CPU|@.*$/g, '').replace(/\s+/g, ' ').trim()}</div>
                <div className="truncate">{sys.gpu}</div>
              </>
            ) : (
              <div className="h-8 animate-pulse rounded bg-panel2" />
            )}
          </div>
        </nav>

        <main className="glow-bg min-w-0 flex-1 overflow-y-auto px-8 py-7">
          {page === 'dashboard' && <Dashboard />}
          {page === 'boost' && <Boost />}
          {page === 'cleaner' && <Cleaner />}
          {page === 'startup' && <Startup />}
          {page === 'processes' && <Processes />}
          {page === 'settings' && <Settings />}
        </main>
      </div>

      <div className="pointer-events-none fixed right-5 bottom-5 z-[60] flex w-96 flex-col gap-2">
        {toasts.map((x) => (
          <div
            key={x.id}
            className={cx(
              'fade-up flex items-start gap-2.5 rounded-xl border bg-panel px-4 py-3 text-sm shadow-2xl',
              x.kind === 'err' ? 'border-bad/40' : x.kind === 'info' ? 'border-ice/30' : 'border-good/40'
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
          </div>
        ))}
      </div>
    </div>
  )
}

export function App(): ReactNode {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
