import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { Clock, Gamepad2, RefreshCw, Search, ShieldAlert, Trash2 } from 'lucide-react'
import type { InstalledApp } from '../../../../shared/types'
import { useStore } from '../../store'
import { GB, isOldApp, sumSize, useSpace, type AppFilter, type AppSort } from '../../space'
import { appHint, isGame } from '../../catalog'
import { Badge, Button, Card, Checkbox, Skeleton, cx } from '../../ui'
import { daysSince, fmtAgo, fmtBytes, fmtDate } from '../../format'
import { UninstallModal } from './UninstallModal'
import { Chip, ScanLine, SelectionBar } from './bits'

const COLS = 'grid grid-cols-[20px_32px_minmax(0,1fr)_168px_92px_96px] items-center gap-3'
const FILTERS: AppFilter[] = ['all', 'games', 'old', 'big', 'store']
const SORTS: AppSort[] = ['size', 'last', 'name', 'date']

export function AppIcon({ src, name, size = 32 }: { src?: string; name: string; size?: number }): ReactNode {
  if (src) return <img src={src} alt="" className="shrink-0 rounded-md" style={{ width: size, height: size }} draggable={false} />
  return (
    <span
      className="accent-gradient font-display grid shrink-0 place-items-center rounded-lg text-sm font-bold text-[#1d1d22]"
      style={{ width: size, height: size }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

export function AppsTab(): ReactNode {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { sys } = useStore()
  const s = useSpace()
  const admin = !!sys?.isAdmin
  const [q, setQ] = useState('')
  const [removing, setRemoving] = useState<InstalledApp[] | null>(null)
  const scanning = !!s.status?.apps.running
  const fmt = (v: number | null): string => fmtBytes(v, lang)

  const rows = useMemo(
    () => (s.apps ?? []).map((a) => ({ ...a, hint: appHint(a.name), game: isGame(a), old: isOldApp(a, admin) })),
    [s.apps, admin]
  )
  type Row = (typeof rows)[number]

  const pass = (r: Row, f: AppFilter): boolean =>
    f === 'all' ||
    (f === 'games' && r.game) ||
    (f === 'old' && r.old && r.hint?.hint !== 'keep') ||
    (f === 'big' && (r.size ?? 0) >= GB) ||
    (f === 'store' && r.kind === 'store')

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = rows.filter(
      (r) => pass(r, s.appFilter) && (!needle || r.name.toLowerCase().includes(needle) || (r.publisher ?? '').toLowerCase().includes(needle))
    )
    const by: Record<AppSort, (a: Row, b: Row) => number> = {
      size: (a, b) => (b.size ?? 0) - (a.size ?? 0),
      // never started / unknown first
      last: (a, b) => (a.lastUsed ?? 0) - (b.lastUsed ?? 0) || (b.size ?? 0) - (a.size ?? 0),
      name: (a, b) => a.name.localeCompare(b.name, lang),
      date: (a, b) => (b.installed ?? 0) - (a.installed ?? 0)
    }
    return list.sort(by[s.appSort])
  }, [rows, q, s.appFilter, s.appSort, lang])

  const picked = rows.filter((r) => s.selApps.has(r.id))
  const toggle = (id: string, on: boolean): void => {
    const n = new Set(s.selApps)
    if (on) n.add(id)
    else n.delete(id)
    s.setSelApps(n)
  }

  const lastUsed = (r: Row): ReactNode => {
    if (r.lastUsed) {
      const old = daysSince(r.lastUsed) > 90
      return (
        <span className={cx('flex items-center gap-1.5 text-xs', old ? 'text-warn' : 'text-muted')}>
          <Clock className="size-3.5 shrink-0" />
          {t(r.game ? 'space.apps.played' : 'space.apps.last', { ago: fmtAgo(r.lastUsed, lang) })}
        </span>
      )
    }
    // Steam writes "last played" itself, so no date there means the game was never started
    if (r.kind === 'steam' && s.appsMeasured)
      return (
        <span className="flex items-center gap-1.5 text-xs text-warn">
          <Clock className="size-3.5 shrink-0" />
          {t('space.apps.neverPlayed')}
        </span>
      )
    if (r.old)
      return (
        <span className="flex items-center gap-1.5 text-xs text-warn" title={t('space.apps.neverHint')}>
          <Clock className="size-3.5 shrink-0" />
          {t('space.apps.never')}
        </span>
      )
    return (
      <span className="text-xs text-muted/60" title={admin ? t('space.apps.neverHint') : t('space.apps.unknownHint')}>
        {!s.appsMeasured ? '…' : t('space.apps.unknown')}
      </span>
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-line bg-panel2 px-3 focus-within:border-teal/70">
          <Search className="size-4 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('space.apps.search')}
            className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
          />
        </label>
        {FILTERS.map((f) => (
          <Chip key={f} active={s.appFilter === f} onClick={() => s.setAppFilter(f)} count={rows.filter((r) => pass(r, f)).length}>
            {t(`space.apps.filter.${f}`)}
          </Chip>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>{t('space.apps.sortLabel')}:</span>
        {SORTS.map((x) => (
          <button
            key={x}
            onClick={() => s.setAppSort(x)}
            className={cx('rounded-lg px-2 py-1 transition-colors', s.appSort === x ? 'bg-teal/20 text-ice' : 'hover:text-text')}
          >
            {t(`space.apps.sort.${x}`)}
          </button>
        ))}
        <span className="flex-1" />
        <Button size="sm" variant="ghost" icon={<RefreshCw className={cx('size-3.5', scanning && 'animate-spin')} />} disabled={scanning} onClick={() => void s.refreshApps()}>
          {t('common.refresh')}
        </Button>
      </div>

      <AnimatePresence>
        {scanning && s.status && (
          <ScanLine
            text={t('space.apps.measuring', { done: s.status.apps.done, total: s.status.apps.total || '…' })}
            progress={s.status.apps.total ? s.status.apps.done / s.status.apps.total : 0}
          />
        )}
      </AnimatePresence>

      <Card className="p-0">
        {!s.apps ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted">{t('space.apps.empty')}</div>
        ) : (
          shown.map((r, i) => {
            const sel = s.selApps.has(r.id)
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i, 14) * 0.02 }}
                className={cx(COLS, 'border-b border-line/50 px-4 py-2.5 last:border-0', sel ? 'bg-teal/10' : 'hover:bg-panel2/60')}
              >
                <Checkbox checked={sel} disabled={!r.canUninstall} onChange={(v) => toggle(r.id, v)} />
                <AppIcon src={s.icons[r.id]} name={r.name} />
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium" title={r.name}>
                      {r.name}
                    </span>
                    {r.game && <Badge tone="ice" icon={<Gamepad2 className="size-3" />}>{t('space.apps.game')}</Badge>}
                    {r.kind === 'steam' && <Badge>Steam</Badge>}
                    {r.kind === 'epic' && <Badge>Epic</Badge>}
                    {r.kind === 'store' && <Badge>Store</Badge>}
                    {r.drive && s.drives && s.drives.length > 1 && <Badge tone={r.drive === s.goal.drive ? 'frost' : 'muted'}>{r.drive}</Badge>}
                    {r.hint && (
                      <Badge tone={r.hint.hint === 'keep' ? 'good' : 'warn'} icon={<ShieldAlert className="size-3" />}>
                        {t(`space.apps.hint.${r.hint.hint}`)}
                      </Badge>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {r.hint ? (
                      <span className={r.hint.hint === 'keep' ? 'text-good/90' : 'text-warn/90'}>{t(`space.apps.why.${r.hint.why}`)}</span>
                    ) : (
                      [r.publisher, r.version, r.installed && t('space.apps.installed', { date: fmtDate(r.installed, lang) })].filter(Boolean).join(' · ')
                    )}
                  </div>
                </div>
                {lastUsed(r)}
                <div className="text-right">
                  {r.size == null ? (
                    scanning ? <Skeleton className="ml-auto h-4 w-14" /> : <span className="text-muted/60">—</span>
                  ) : (
                    <span className={cx('font-display text-sm font-semibold tabular-nums', (r.size ?? 0) >= 10 * GB && 'text-ice')} title={r.measured ? undefined : t('space.apps.approx')}>
                      {!r.measured && '≈'}
                      {fmt(r.size)}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  {r.canUninstall && (
                    <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => setRemoving([r])}>
                      {t('space.apps.remove')}
                    </Button>
                  )}
                </div>
              </motion.div>
            )
          })
        )}
      </Card>

      <SelectionBar
        open={picked.length > 0}
        text={t('space.apps.selected', { n: picked.length, size: fmt(sumSize(picked)) })}
        clearText={t('space.apps.clear')}
        actionText={t('space.apps.removeSelected')}
        onClear={() => s.setSelApps(new Set())}
        onAction={() => setRemoving(picked)}
      />

      <UninstallModal list={removing} onClose={() => setRemoving(null)} />
    </div>
  )
}
