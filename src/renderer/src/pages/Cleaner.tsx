import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AppWindow, Bug, Cpu, Download, Globe, Lock, RefreshCw, Sparkles, Trash2, Wand2, FolderClock, MonitorCog } from 'lucide-react'
import type { CleanResult } from '../../../shared/types'
import { useStore } from '../store'
import { Badge, Button, Card, Checkbox, PageHeader, Spinner } from '../ui'
import { errText, fmtBytes } from '../format'

const ICONS: Record<string, ReactNode> = {
  userTemp: <FolderClock className="size-5" />,
  winTemp: <MonitorCog className="size-5" />,
  browsers: <Globe className="size-5" />,
  apps: <AppWindow className="size-5" />,
  crashDumps: <Bug className="size-5" />,
  winUpdate: <Download className="size-5" />,
  shaders: <Cpu className="size-5" />,
  recycle: <Trash2 className="size-5" />
}

export function Cleaner(): ReactNode {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { junk, scanning, scan, toast } = useStore()
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const [result, setResult] = useState<CleanResult | null>(null)

  useEffect(() => {
    if (junk && picked === null) setPicked(new Set(junk.filter((j) => j.defaultOn).map((j) => j.id)))
  }, [junk, picked])

  const sel = picked ?? new Set<string>()
  const selectedSize = useMemo(
    () => (junk ?? []).filter((j) => sel.has(j.id)).reduce((s, j) => s + (j.size ?? 0) - j.groups.filter((g) => g.running).reduce((a, g) => a + g.size, 0), 0),
    [junk, sel]
  )
  const totalFound = useMemo(() => (junk ?? []).reduce((s, j) => s + (j.size ?? 0), 0), [junk])

  const clean = async (): Promise<void> => {
    setCleaning(true)
    setResult(null)
    try {
      const r = await window.api.cleanJunk([...sel])
      setResult(r)
      if (r.adminDenied) toast(t('cleaner.adminDenied'), 'info')
    } catch (e) {
      toast(errText(e, t('common.uacDenied')), 'err')
    } finally {
      setCleaning(false)
      void scan()
    }
  }

  return (
    <div className="fade-up">
      <PageHeader
        title={t('cleaner.title')}
        subtitle={t('cleaner.subtitle')}
        actions={
          <Button icon={<RefreshCw className="size-4" />} loading={scanning} disabled={cleaning} onClick={() => void scan()}>
            {t('cleaner.rescan')}
          </Button>
        }
      />

      <Card className="mb-5 flex items-center gap-6">
        <div className="ice-gradient grid size-16 place-items-center rounded-2xl text-slate-950">
          {scanning || cleaning ? <Spinner className="size-7 text-slate-950" /> : <Wand2 className="size-8" />}
        </div>
        <div className="flex-1">
          <div className="text-sm text-muted">{scanning ? t('cleaner.scanning') : cleaning ? t('cleaner.cleaning') : t('cleaner.willClean')}</div>
          <div className="ice-text text-4xl font-bold tabular-nums">{junk ? fmtBytes(selectedSize, lang) : '…'}</div>
          {junk && <div className="mt-0.5 text-xs text-muted">{t('cleaner.found', { size: fmtBytes(totalFound, lang) })}</div>}
        </div>
        <Button
          variant="primary"
          size="lg"
          icon={<Sparkles className="size-5" />}
          loading={cleaning}
          disabled={!junk || scanning || sel.size === 0}
          onClick={() => void clean()}
        >
          {t('cleaner.clean')}
        </Button>
      </Card>

      {result && (
        <Card className="fade-up mb-5 border-good/30 bg-good/5">
          <div className="text-lg font-semibold text-good">{t('cleaner.resultTitle', { size: fmtBytes(result.freed, lang) })}</div>
          <p className="mt-1 text-sm text-muted">{t('cleaner.resultFiles', { n: result.deleted, f: result.failed })}</p>
          {result.skipped.length > 0 && <p className="mt-1 text-sm text-warn">{t('cleaner.resultSkipped', { list: result.skipped.join(', ') })}</p>}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        {(junk ?? Array.from({ length: 8 }, () => null)).map((j, i) =>
          !j ? (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-panel" />
          ) : (
            <Card key={j.id} className="flex gap-4 p-4">
              <Checkbox
                checked={sel.has(j.id)}
                onChange={(v) =>
                  setPicked(() => {
                    const n = new Set(sel)
                    if (v) n.add(j.id)
                    else n.delete(j.id)
                    return n
                  })
                }
              />
              <div className="text-ice">{ICONS[j.id]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t(`cleaner.cat.${j.id}.t`)}</span>
                  {j.admin && <Badge icon={<Lock className="size-3" />}>{t('common.admin')}</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted">{t(`cleaner.cat.${j.id}.d`)}</p>
                {j.groups.length > 1 || j.groups.some((g) => g.running) ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {j.groups.map((g) => (
                      <Badge key={g.label} tone={g.running ? 'warn' : 'muted'}>
                        {g.label} · {fmtBytes(g.size, lang)}
                        {g.running && ` · ${t('cleaner.running')}`}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-semibold tabular-nums">{j.size == null ? '—' : fmtBytes(j.size, lang)}</div>
                <div className="text-xs text-muted">{j.size == null ? t('cleaner.needsAdmin') : t('cleaner.files', { n: j.files })}</div>
              </div>
            </Card>
          )
        )}
      </div>
    </div>
  )
}
