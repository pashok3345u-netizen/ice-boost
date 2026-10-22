import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProcInfo } from '../../../shared/types'
import { isProtected } from '../../../shared/protected'
import { useStore } from '../store'
import { Bar, Button, Card, PageHeader, cx } from '../ui'
import { errText, fmtBytes } from '../format'

export function Processes(): ReactNode {
  const { t, i18n } = useTranslation()
  const { toast, live } = useStore()
  const [list, setList] = useState<ProcInfo[] | null>(null)
  const [sort, setSort] = useState<'ram' | 'cpu'>('ram')
  const [confirm, setConfirm] = useState<string | null>(null)

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

  const rows = useMemo(() => [...(list ?? [])].sort((a, b) => b[sort] - a[sort]).slice(0, 30), [list, sort])
  const maxRam = Math.max(1, ...rows.map((r) => r.ram))

  const end = async (name: string): Promise<void> => {
    setConfirm(null)
    try {
      const r = await window.api.killProcess(name)
      if (r.ok) toast(t('procs.ended', { name }))
      else toast(r.error === 'PROTECTED' ? t('procs.protected') : errText(new Error(r.error), t('common.uacDenied')), 'err')
    } catch (e) {
      toast(errText(e, t('common.uacDenied')), 'err')
    }
  }

  const th = (key: 'ram' | 'cpu', label: string): ReactNode => (
    <button onClick={() => setSort(key)} className={cx('text-right', sort === key ? 'text-ice' : 'hover:text-text')}>
      {label} {sort === key ? '↓' : ''}
    </button>
  )

  return (
    <div className="fade-up">
      <PageHeader title={t('procs.title')} subtitle={t('procs.subtitle')} />
      <Card className="p-0">
        <div className="grid grid-cols-[minmax(0,1fr)_90px_80px_200px_110px] items-center gap-4 border-b border-line px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted">
          <span>{t('procs.name')}</span>
          <span className="text-right">{t('procs.count')}</span>
          {th('cpu', t('procs.cpu'))}
          {th('ram', t('procs.ram'))}
          <span />
        </div>
        {!list ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-panel2" />
            ))}
          </div>
        ) : (
          rows.map((p) => (
            <div key={p.name} className="grid grid-cols-[minmax(0,1fr)_90px_80px_200px_110px] items-center gap-4 border-b border-line/50 px-5 py-2.5 text-sm last:border-0 hover:bg-panel2/50">
              <div className="min-w-0">
                <div className="truncate">{p.desc || p.name}</div>
                {p.desc && <div className="truncate text-xs text-muted">{p.name}.exe</div>}
              </div>
              <span className="text-right tabular-nums text-muted">{p.count}</span>
              <span className={cx('text-right tabular-nums', p.cpu > 20 ? 'text-warn' : '')}>{p.cpu.toFixed(1)}%</span>
              <div className="flex items-center gap-3">
                <Bar value={(p.ram / maxRam) * 100} color="#a78bfa" />
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
            </div>
          ))
        )}
      </Card>
      {live && <p className="mt-3 text-right text-xs text-muted">RAM: {fmtBytes(live.ramUsed, i18n.language)} / {fmtBytes(live.ramTotal, i18n.language)}</p>}
    </div>
  )
}
