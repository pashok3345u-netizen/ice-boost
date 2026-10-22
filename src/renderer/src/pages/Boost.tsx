import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { Gamepad2, Lightbulb, Lock, RefreshCw, Rocket, RotateCcw, ShieldCheck, Sparkles, Undo2, X, Zap } from 'lucide-react'
import { TWEAKS, TWEAK_GROUPS, type Tweak } from '../../../shared/tweaks'
import type { ProcInfo } from '../../../shared/types'
import { useStore } from '../store'
import { useProgress } from '../progress'
import { Badge, Button, Card, Checkbox, Modal, PageHeader, Skeleton, Spinner, Toggle } from '../ui'
import { errText, fmtBytes } from '../format'
import { CLOSEABLE } from '../catalog'
import { burst } from '../Fx'

type Pending = { ids: string[]; at?: { x: number; y: number } } | null

export function Boost(): ReactNode {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { tweaks, loadTweaks, restoreDone, setRestoreDone, toast, sys } = useStore()
  const { track } = useProgress()
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<Pending>(null)
  const [restoring, setRestoring] = useState(false)
  const [reverting, setReverting] = useState(false)

  const stateOf = useCallback((id: string) => tweaks?.find((s) => s.id === id), [tweaks])
  const uac = t('common.uacDenied')

  const report = (res: Record<string, { ok: boolean; error?: string }>): void => {
    const bad = Object.values(res).find((r) => !r.ok)
    if (bad) toast(errText(new Error(bad.error), uac), 'err')
  }

  const apply = async (ids: string[], at?: { x: number; y: number }): Promise<void> => {
    setBusy((b) => new Set([...b, ...ids]))
    try {
      const res = await window.api.applyTweaks(ids)
      report(res)
      const ok = Object.values(res).filter((r) => r.ok).length
      if (ok) {
        toast(lang === 'ru' ? `Включено: ${ok}` : `Turned on: ${ok}`)
        burst(at ? { ...at } : { big: ok > 3 })
        track({ type: 'tweaks', count: ok })
      }
    } catch (e) {
      toast(errText(e, uac), 'err')
    } finally {
      await loadTweaks()
      setBusy((b) => new Set([...b].filter((x) => !ids.includes(x))))
    }
  }

  const revert = async (ids: string[]): Promise<void> => {
    setBusy((b) => new Set([...b, ...ids]))
    try {
      report(await window.api.revertTweaks(ids))
    } catch (e) {
      toast(errText(e, uac), 'err')
    } finally {
      await loadTweaks()
      setBusy((b) => new Set([...b].filter((x) => !ids.includes(x))))
    }
  }

  const makeRestorePoint = async (): Promise<boolean> => {
    setRestoring(true)
    try {
      const r = await window.api.createRestorePoint()
      if (r.status === 'error') {
        toast(`${t('boost.restoreError')}: ${errText(new Error(r.error), uac)}`, 'err')
        return false
      }
      setRestoreDone(true)
      toast(r.status === 'created' ? t('boost.restoreCreated') : t('boost.restoreLimit'), r.status === 'created' ? 'ok' : 'info')
      return true
    } finally {
      setRestoring(false)
    }
  }

  // strong (system-wide) tweaks: offer a restore point first
  const requestApply = (ids: string[], at?: { x: number; y: number }): void => {
    const strong = ids.some((id) => TWEAKS.find((tw) => tw.id === id)?.level === 'strong')
    if (strong && !restoreDone) setPending({ ids, at })
    else void apply(ids, at)
  }

  const recommendedTodo = useMemo(
    () => TWEAKS.filter((tw) => tw.recommended && !stateOf(tw.id)?.applied).map((tw) => tw.id),
    [stateOf]
  )
  const withBackup = useMemo(() => (tweaks ?? []).filter((s) => s.hasBackup).map((s) => s.id), [tweaks])
  const appliedCount = (tweaks ?? []).filter((s) => s.applied).length

  return (
    <div>
      <PageHeader
        icon={<Rocket className="size-5" />}
        title={t('boost.title')}
        subtitle={t('boost.subtitle')}
        actions={
          <>
            <Button variant="ghost" icon={<ShieldCheck className="size-4" />} loading={restoring} onClick={() => void makeRestorePoint()}>
              {t('boost.restorePoint')}
            </Button>
            <Button
              icon={<Undo2 className="size-4" />}
              disabled={withBackup.length === 0 || reverting}
              loading={reverting}
              onClick={async () => {
                setReverting(true)
                await revert(withBackup)
                setReverting(false)
              }}
            >
              {t('boost.revertAll')}
            </Button>
            <Button
              variant="primary"
              icon={<Zap className="size-4" />}
              disabled={recommendedTodo.length === 0 || busy.size > 0}
              loading={busy.size > 0 && recommendedTodo.every((id) => busy.has(id))}
              onClick={() => requestApply(recommendedTodo)}
            >
              {t('boost.applyRec')}
            </Button>
          </>
        }
      />

      {tweaks && (
        <Card className="mb-5 flex items-center gap-4 px-5 py-3.5">
          <span className="font-display text-sm whitespace-nowrap text-muted">
            <span className="text-lg font-semibold text-frost">{appliedCount}</span> / {TWEAKS.length}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#3a3a43]">
            <motion.div
              className="accent-gradient h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(appliedCount / TWEAKS.length) * 100}%` }}
              transition={{ type: 'spring', stiffness: 90, damping: 18 }}
            />
          </div>
        </Card>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-5">
        <div className="space-y-6">
          {TWEAK_GROUPS.map((g, gi) => (
            <section key={g}>
              <h2 className="font-display mb-3 text-xs font-semibold tracking-[0.18em] text-muted uppercase">{t(`boost.group.${g}`)}</h2>
              <div className="space-y-2">
                {TWEAKS.filter((tw) => tw.group === g).map((tw, i) => (
                  <TweakRow
                    key={tw.id}
                    delay={gi * 0.05 + i * 0.04}
                    tweak={tw}
                    applied={stateOf(tw.id)?.applied}
                    busy={busy.has(tw.id)}
                    onChange={(on, e) => (on ? requestApply([tw.id], { x: e.clientX, y: e.clientY }) : void revert([tw.id]))}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="space-y-5">
          <BeforeGame />
          <Card delay={0.1}>
            <h2 className="font-display mb-3 flex items-center gap-2 text-sm font-semibold">
              <Lightbulb className="size-4 text-warn" />
              {t('boost.tips')}
            </h2>
            <ul className="space-y-3 text-sm text-muted">
              {['steam', 'discord', 'gpu', 'monitor', 'reboot'].map((k, i) => (
                <motion.li key={k} className="flex gap-2" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.06 }}>
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ice" />
                  <span>{t(`boost.tip.${k}`, { hz: sys?.refresh ?? 60 })}</span>
                </motion.li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Modal open={pending !== null} onClose={() => setPending(null)}>
        <div className="mb-4 flex items-center gap-3">
          <ShieldCheck className="size-6 text-ice" />
          <h2 className="font-display font-semibold">{t('boost.restorePoint')}</h2>
        </div>
        <p className="text-sm text-muted">{t('boost.confirmStrong')}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setPending(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => {
              const p = pending!
              setPending(null)
              void apply(p.ids, p.at)
            }}
          >
            {t('boost.applyWithout')}
          </Button>
          <Button
            variant="primary"
            loading={restoring}
            onClick={async () => {
              const p = pending!
              const ok = await makeRestorePoint()
              setPending(null)
              if (ok) void apply(p.ids, p.at)
            }}
          >
            {t('boost.createAndApply')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function TweakRow({
  tweak, applied, busy, onChange, delay
}: {
  tweak: Tweak
  applied?: boolean
  busy: boolean
  onChange: (on: boolean, e: React.MouseEvent) => void
  delay: number
}): ReactNode {
  const { t } = useTranslation()
  return (
    <Card hover delay={delay} className={applied ? 'flex items-center gap-4 border-teal/50! px-5 py-4' : 'flex items-center gap-4 px-5 py-4'}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{t(`boost.tweak.${tweak.id}.t`)}</span>
          {tweak.level === 'strong' ? <Badge tone="warn">{t('boost.level.strong')}</Badge> : <Badge tone="good">{t('boost.level.safe')}</Badge>}
          {tweak.recommended && <Badge tone="ice" icon={<Sparkles className="size-3" />}>{t('boost.recommended')}</Badge>}
          {tweak.admin && <Badge icon={<Lock className="size-3" />}>{t('common.admin')}</Badge>}
          {tweak.restart !== 'none' && <Badge icon={<RotateCcw className="size-3" />}>{t(`common.restart.${tweak.restart}`)}</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted">{t(`boost.tweak.${tweak.id}.d`)}</p>
      </div>
      {applied === undefined ? <Spinner /> : <Toggle checked={applied} busy={busy} onChange={onChange} />}
    </Card>
  )
}

function BeforeGame(): ReactNode {
  const { t, i18n } = useTranslation()
  const { toast } = useStore()
  const { track } = useProgress()
  const [procs, setProcs] = useState<ProcInfo[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [closing, setClosing] = useState(false)

  const load = useCallback(async () => {
    try {
      const list = await window.api.getProcesses()
      setProcs(list)
      setPicked(new Set(CLOSEABLE.filter((c) => c.def && list.some((p) => p.name.toLowerCase() === c.proc.toLowerCase())).map((c) => c.proc)))
    } catch {
      setProcs([])
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    if (!procs) return []
    const seen = new Set<string>()
    return CLOSEABLE.flatMap((c) => {
      const p = procs.find((x) => x.name.toLowerCase() === c.proc.toLowerCase())
      if (!p || seen.has(c.label)) return []
      seen.add(c.label)
      const label = c.proc === 'PhoneExperienceHost' && i18n.language === 'ru' ? 'Связь с телефоном' : c.proc.startsWith('Widget') && i18n.language === 'ru' ? 'Виджеты Windows' : c.label
      const same = CLOSEABLE.filter((x) => x.label === c.label).map((x) => x.proc)
      const ram = procs.filter((x) => same.some((s) => s.toLowerCase() === x.name.toLowerCase())).reduce((s, x) => s + x.ram, 0)
      return [{ procs: same, key: c.proc, label, ram }]
    })
  }, [procs, i18n.language])

  const close = async (e: React.MouseEvent): Promise<void> => {
    const names = rows.filter((r) => picked.has(r.key)).flatMap((r) => r.procs)
    const at = { x: e.clientX, y: e.clientY }
    setClosing(true)
    try {
      await window.api.closeApps(names)
      toast(t('boost.closed'))
      burst(at)
      track({ type: 'appsClosed' })
    } catch (err) {
      toast(errText(err, t('common.uacDenied')), 'err')
    } finally {
      setClosing(false)
      void load()
    }
  }

  return (
    <Card delay={0.05} className="border-teal/40!">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-display flex items-center gap-2 text-sm font-semibold">
          <Gamepad2 className="size-4 text-ice" />
          {t('boost.before')}
        </h2>
        <Button variant="ghost" size="sm" icon={<RefreshCw className="size-3.5" />} onClick={() => void load()} />
      </div>
      <p className="mb-4 text-xs text-muted">{t('boost.beforeHint')}</p>
      {!procs ? (
        <div className="space-y-2">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">{t('boost.nothingToClose')}</p>
      ) : (
        <>
          <div className="space-y-1">
            {rows.map((r, i) => (
              <motion.label
                key={r.key}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-panel2"
              >
                <Checkbox
                  checked={picked.has(r.key)}
                  onChange={(v) =>
                    setPicked((s) => {
                      const n = new Set(s)
                      if (v) n.add(r.key)
                      else n.delete(r.key)
                      return n
                    })
                  }
                />
                <span className="flex-1 truncate text-sm">{r.label}</span>
                <span className="text-xs text-muted tabular-nums">{fmtBytes(r.ram, i18n.language)}</span>
              </motion.label>
            ))}
          </div>
          <Button className="mt-4 w-full" variant="danger" icon={<X className="size-4" />} loading={closing} disabled={picked.size === 0} onClick={(e) => void close(e)}>
            {t('boost.closeSelected')}
          </Button>
        </>
      )}
    </Card>
  )
}
