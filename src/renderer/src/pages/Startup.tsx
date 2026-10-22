import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, Power, RefreshCw } from 'lucide-react'
import { useStore } from '../store'
import { Badge, Button, Card, PageHeader, Toggle } from '../ui'
import { errText } from '../format'
import { startupHint, startupTitle } from '../catalog'

const ORDER = { disable: 0, optional: 1, keep: 2 }

export function Startup(): ReactNode {
  const { t } = useTranslation()
  const { startup, loadStartup, toast } = useStore()
  const [busy, setBusy] = useState<string | null>(null)

  const rows = useMemo(
    () =>
      (startup ?? [])
        .map((s) => ({ ...s, ...startupHint(s), title: startupTitle(s) }))
        .sort((a, b) => Number(b.enabled) - Number(a.enabled) || ORDER[a.hint] - ORDER[b.hint] || a.title.localeCompare(b.title)),
    [startup]
  )
  const enabled = rows.filter((r) => r.enabled).length

  const toggle = async (id: string, on: boolean): Promise<void> => {
    setBusy(id)
    try {
      const r = await window.api.setStartup(id, on)
      if (!r.ok) toast(errText(new Error(r.error), t('common.uacDenied')), 'err')
    } finally {
      await loadStartup()
      setBusy(null)
    }
  }

  return (
    <div className="fade-up">
      <PageHeader
        title={t('startup.title')}
        subtitle={t('startup.subtitle')}
        actions={
          <Button icon={<RefreshCw className="size-4" />} onClick={() => void loadStartup()}>
            {t('common.refresh')}
          </Button>
        }
      />
      {startup && (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted">
          <Power className="size-4 text-ice" />
          {t('startup.enabled', { n: enabled, total: rows.length })}
        </div>
      )}
      {!startup ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-panel" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="text-center text-muted">{t('startup.empty')}</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id} className={r.enabled ? 'flex items-center gap-4 px-5 py-3.5' : 'flex items-center gap-4 px-5 py-3.5 opacity-70'}>
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
              <Toggle checked={r.enabled} busy={busy === r.id} onChange={(v) => void toggle(r.id, v)} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
