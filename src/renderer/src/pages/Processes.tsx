import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { Activity } from 'lucide-react'
import type { ProcInfo } from '../../../shared/types'
import { isProtected } from '../../../shared/protected'
import { useStore } from '../store'
import { Bar, Button, Card, PageHeader, Skeleton, cx } from '../ui'
import { C } from '../theme'
import { errText, fmtBytes } from '../format'

const COLS = 'grid grid-cols-[minmax(0,1fr)_90px_80px_220px_110px] items-center gap-4'

export function Processes(): ReactNode {
  const { t, i18n } = useTranslation()
  const { toast, live } = useStore()
  const [list, setList] = useState<ProcInfo[] | null>(null)
  const [sort, setSort] = useState<'ram' | 'cpu'>('ram')
  const [confirm, setConfirm] = useState<string | null>(null)
  const [gone, setGone] = useState<Set<string>>(new Set())

  useEffect(() => {
    let alive = true
    const tick = async (): Promise<void> => {
      try {
        const l = await window.api.getProcesses()
        if (alive) setList(l)
      } catch {
        // skip
      }
    }
    void tick()
    const id = setInterval(tick, 3000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const rows = useMemo(
    () => [...(list ?? [])].filter((p) => !gone.has(p.name)).sort((a, b) => b[sort] - a[sort]).slice(0, 30),
    [list, sort, gone]
  )
  const maxRam = Math.max(1, ...rows.map((r) => r.ram))

  const end = async (name: string): Promise<void> => {
    setConfirm(null)
    try {
      const r = await window.api.killProcess(name)
      if (r.ok) {
        toast(t('procs.ended', { name }))
        setGone((g) => new Set([...g, name]))
        setTimeout(() => setGone((g) => new Set([...g].filter((x) => x !== name))), 6000)
      } else toast(r.error === 'PROTECTED' ? t('procs.protected') : errText(new Error(r.error), t('common.uacDenied')), 'err')
    } catch (e) {
      toast(errText(e, t('common.uacDenied')), 'err')
    }
  }

  const th = (key: 'ram' | 'cpu', label: string): ReactNode => (
    <button onClick={() => setSort(key)} className={cx('text-right transition-colors', sort === key ? 'text-ice' : 'hover:text-text')}>
      {label} {sort === key ? '↓' : ''}
    </button>
  )

  return (
    <div>
      <PageHeader icon={<Activity className="size-5" />} title={t('procs.title')} subtitle={t('procs.subtitle')} />
      <Card className="p-0">
        <div className={cx(COLS, 'border-b border-line px-5 py-3 text-xs font-medium tracking-wider text-muted uppercase')}>
          <span>{t('procs.name')}</span>
          <span className="text-right">{t('procs.count')}</span>
          {th('cpu', t('procs.cpu'))}
          {th('ram', t('procs.ram'))}
          <span />
        </div>
        {!list ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : (
          rows.map((p, i) => (
            <motion.div
              key={p.name}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ layout: { type: 'spring', stiffness: 500, damping: 40 }, opacity: { delay: Math.min(i, 15) * 0.02 } }}
              className={cx(COLS, 'border-b border-line/50 px-5 py-2.5 text-sm last:border-0 hover:bg-panel2/60')}
            >
              <div className="min-w-0">
                <div className="truncate">{p.desc || p.name}</div>
                {p.desc && <div className="truncate text-xs text-muted">{p.name}.exe</div>}
              </div>
              <span className="text-right text-muted tabular-nums">{p.count}</span>
              <span className={cx('text-right tabular-nums', p.cpu > 20 ? 'font-semibold text-warn' : '')}>{p.cpu.toFixed(1)}%</span>
              <div className="flex items-center gap-3">
                <Bar value={(p.ram / maxRam) * 100} color={C.ice} />
                <span className="w-20 shrink-0 text-right tabular-nums">{fmtBytes(p.ram, i18n.language)}</span>
              </div>
              <div className="text-right">
                {isProtected(p.name) ? (
                  <span className="text-xs text-muted/50">Windows</span>
                ) : confirm === p.name ? (
                  <Button size="sm" variant="danger" onClick={() => void end(p.name)} onMouseLeave={() => setConfirm(null)}>
                    {t('procs.sure')}
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(p.name)}>
                    {t('procs.end')}
                  </Button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </Card>
      {live && (
        <p className="mt-3 text-right text-xs text-muted">
          RAM: {fmtBytes(live.ramUsed, i18n.language)} / {fmtBytes(live.ramTotal, i18n.language)}
        </p>
      )}
    </div>
  )
}
