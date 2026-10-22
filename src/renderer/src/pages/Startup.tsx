import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { Lock, Power, RefreshCw } from 'lucide-react'
import { useStore } from '../store'
import { useProgress } from '../progress'
import { Badge, Button, Card, PageHeader, Skeleton, Toggle, cx } from '../ui'
import { errText } from '../format'
import { startupHint, startupTitle } from '../catalog'
import { burst } from '../Fx'

const ORDER = { disable: 0, optional: 1, keep: 2 }

export function Startup(): ReactNode {
  const { t } = useTranslation()
  const { startup, loadStartup, toast } = useStore()
  const { track } = useProgress()
  const [busy, setBusy] = useState<string | null>(null)

  const rows = useMemo(
    () =>
      (startup ?? [])
        .map((s) => ({ ...s, ...startupHint(s), title: startupTitle(s) }))
        .sort((a, b) => Number(b.enabled) - Number(a.enabled) || ORDER[a.hint] - ORDER[b.hint] || a.title.localeCompare(b.title)),
    [startup]
  )
  const enabled = rows.filter((r) => r.enabled).length

  const toggle = async (id: string, on: boolean, e: React.MouseEvent): Promise<void> => {
    const at = { x: e.clientX, y: e.clientY }
    setBusy(id)
    try {
      const r = await window.api.setStartup(id, on)
      if (!r.ok) toast(errText(new Error(r.error), t('common.uacDenied')), 'err')
      else if (!on) {
        burst(at)
        track({ type: 'startupOff' })
      }
    } finally {
      await loadStartup()
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader
        icon={<Power className="size-5" />}
        title={t('startup.title')}
        subtitle={t('startup.subtitle')}
        actions={
          <Button icon={<RefreshCw className="size-4" />} onClick={() => void loadStartup()}>
            {t('common.refresh')}
          </Button>
        }
      />
      {startup && (
        <Card className="mb-4 flex items-center gap-4 px-5 py-3.5">
          <span className="text-sm text-muted">{t('startup.enabled', { n: enabled, total: rows.length })}</span>
          <div className="flex flex-1 gap-1">
            {rows.map((r) => (
              <motion.span
                key={r.id}
                layout
                className={cx('h-2 flex-1 rounded-full', r.enabled ? 'bg-teal' : 'bg-[#3a3a43]')}
              />
            ))}
          </div>
        </Card>
      )}
      {!startup ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="text-center text-muted">{t('startup.empty')}</Card>
      ) : (
        <motion.div layout className="space-y-2">
          {rows.map((r, i) => (
            <motion.div key={r.id} layout transition={{ type: 'spring', stiffness: 400, damping: 34 }}>
              <Card hover delay={i * 0.03} className={cx('flex items-center gap-4 px-5 py-3.5', !r.enabled && 'opacity-60')}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.title}</span>
                    {r.company && <span className="text-xs text-muted">{r.company}</span>}
                    <Badge tone={r.hint === 'keep' ? 'good' : r.hint === 'disable' ? 'warn' : 'muted'}>{t(`startup.hint.${r.hint}`)}</Badge>
                    {r.admin && <Badge icon={<Lock className="size-3" />}>{t('common.admin')}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{t(`startup.why.${r.why}`)}</p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted/60" title={r.command}>
                    {r.command}
                  </p>
                </div>
                <Toggle checked={r.enabled} busy={busy === r.id} onChange={(v, e) => void toggle(r.id, v, e)} />
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
