import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { AppWindow, Bug, ChevronRight, Cpu, Download, FolderClock, Globe, HardDrive, Lock, MonitorCog, RefreshCw, Sparkles, Trash2, Wand2 } from 'lucide-react'
import type { CleanResult } from '../../../shared/types'
import { useStore } from '../store'
import { useProgress } from '../progress'
import { Badge, Button, Card, Checkbox, CountUp, PageHeader, Skeleton, cx } from '../ui'
import { errText, fmtBytes } from '../format'
import { burst } from '../Fx'

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
  const { junk, scanning, scan, toast, go } = useStore()
  const { track } = useProgress()
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
  const fmt = (v: number): string => fmtBytes(v, lang)

  const clean = async (e: React.MouseEvent): Promise<void> => {
    const at = { x: e.clientX, y: e.clientY }
    setCleaning(true)
    setResult(null)
    try {
      const r = await window.api.cleanJunk([...sel])
      setResult(r)
      burst({ ...at, big: r.freed > 100 * 1024 ** 2 })
      track({ type: 'clean', freed: r.freed })
      if (r.adminDenied) toast(t('cleaner.adminDenied'), 'info')
    } catch (err) {
      toast(errText(err, t('common.uacDenied')), 'err')
    } finally {
      setCleaning(false)
      void scan()
    }
  }

  return (
    <div>
      <PageHeader
        icon={<Sparkles className="size-5" />}
        title={t('cleaner.title')}
        subtitle={t('cleaner.subtitle')}
        actions={
          <Button icon={<RefreshCw className={cx('size-4', scanning && 'animate-spin')} />} disabled={cleaning || scanning} onClick={() => void scan()}>
            {t('cleaner.rescan')}
          </Button>
        }
      />

      <Card className="relative mb-5 flex items-center gap-6 overflow-hidden">
        {(scanning || cleaning) && <div className="skeleton absolute inset-x-0 bottom-0 h-1 opacity-80" />}
        <motion.div
          className="accent-gradient grid size-16 place-items-center rounded-2xl text-[#1a1a1f]"
          animate={cleaning ? { rotate: [0, -18, 18, -18, 0] } : scanning ? { scale: [1, 1.08, 1] } : {}}
          transition={{ duration: cleaning ? 0.6 : 1.2, repeat: cleaning || scanning ? Infinity : 0 }}
        >
          <Wand2 className="size-8" />
        </motion.div>
        <div className="flex-1">
          <div className="text-sm text-muted">{scanning ? t('cleaner.scanning') : cleaning ? t('cleaner.cleaning') : t('cleaner.willClean')}</div>
          <div className="font-display frost-text text-4xl font-bold tabular-nums">{junk ? <CountUp value={selectedSize} format={fmt} /> : '…'}</div>
          {junk && <div className="mt-0.5 text-xs text-muted">{t('cleaner.found', { size: fmt(totalFound) })}</div>}
        </div>
        <Button
          variant="primary"
          size="lg"
          className={!cleaning && !scanning && selectedSize > 0 ? 'pulse' : undefined}
          icon={<Sparkles className="size-5" />}
          loading={cleaning}
          disabled={!junk || scanning || sel.size === 0}
          onClick={(e) => void clean(e)}
        >
          {t('cleaner.clean')}
        </Button>
      </Card>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.96 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 overflow-hidden"
          >
            <div className="card rounded-2xl border border-good/40 bg-good/5 p-5">
              <div className="font-display text-lg font-semibold text-good">
                <CountUp value={result.freed} duration={1400} format={(v) => t('cleaner.resultTitle', { size: fmt(v) })} />
              </div>
              <p className="mt-1 text-sm text-muted">{t('cleaner.resultFiles', { n: result.deleted, f: result.failed })}</p>
              {result.skipped.length > 0 && <p className="mt-1 text-sm text-warn">{t('cleaner.resultSkipped', { list: result.skipped.join(', ') })}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-3">
        {(junk ?? Array.from({ length: 8 }, () => null)).map((j, i) =>
          !j ? (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ) : (
            <Card key={j.id} hover delay={i * 0.04} className={cx('flex gap-4 p-4', !sel.has(j.id) && 'opacity-60')}>
              <Checkbox
                checked={sel.has(j.id)}
                onChange={(v) => {
                  const n = new Set(sel)
                  if (v) n.add(j.id)
                  else n.delete(j.id)
                  setPicked(n)
                }}
              />
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal/15 text-ice">{ICONS[j.id]}</div>
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
                        {g.label} · {fmt(g.size)}
                        {g.running && ` · ${t('cleaner.running')}`}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-sm font-semibold tabular-nums">{j.size == null ? '—' : fmt(j.size)}</div>
                <div className="text-xs text-muted">{j.size == null ? t('cleaner.needsAdmin') : t('cleaner.files', { n: j.files })}</div>
              </div>
            </Card>
          )
        )}
      </div>

      <Card delay={0.3} className="mt-5 flex items-center gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal/15 text-ice">
          <HardDrive className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium">{t('cleaner.moreSpace')}</div>
          <p className="text-sm text-muted">{t('cleaner.moreSpaceText')}</p>
        </div>
        <Button onClick={() => go('space')}>
          {t('cleaner.moreSpaceBtn')}
          <ChevronRight className="size-4" />
        </Button>
      </Card>
    </div>
  )
}