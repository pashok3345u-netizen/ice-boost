// Removes apps one by one: starts the app's own uninstaller (or Steam / Store), waits until Windows
// no longer lists it, then looks for leftovers. Nothing here deletes by itself — leftovers go to the bin on request.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { CircleCheck, CircleX, FolderOpen, LoaderCircle, SkipForward, Trash2, TriangleAlert } from 'lucide-react'
import type { InstalledApp, Leftover } from '../../../../shared/types'
import { useStore } from '../../store'
import { useProgress } from '../../progress'
import { sumSize, useSpace } from '../../space'
import { appHint } from '../../catalog'
import { Button, Checkbox, Modal, Toggle, cx } from '../../ui'
import { errText, fmtBytes } from '../../format'
import { burst } from '../../Fx'
import { AppIcon } from './AppsTab'

type State = 'wait' | 'run' | 'done' | 'skip' | 'fail'

interface Item {
  app: InstalledApp
  state: State
  error?: string
  leftovers: Leftover[]
  picked: Set<string>
  freed: number
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export function UninstallModal({ list, onClose }: { list: InstalledApp[] | null; onClose: () => void }): ReactNode {
  const { t, i18n } = useTranslation()
  const fmt = (v: number): string => fmtBytes(v, i18n.language)
  const { toast } = useStore()
  const { track } = useProgress()
  const space = useSpace()
  const [step, setStep] = useState<'confirm' | 'run' | 'done'>('confirm')
  const [quiet, setQuiet] = useState(true)
  const [items, setItems] = useState<Item[]>([])
  const [moving, setMoving] = useState(false)
  const [moved, setMoved] = useState<number | null>(null)
  const skip = useRef(new Set<string>())
  const alive = useRef(true)
  // the last list stays on screen while the window fades out
  const last = useRef<InstalledApp[] | null>(null)
  if (list) last.current = list

  useEffect(() => {
    if (!list) return
    alive.current = true
    skip.current = new Set()
    setStep('confirm')
    setMoved(null)
    setItems(list.map((app) => ({ app, state: 'wait', leftovers: [], picked: new Set(), freed: 0 })))
    return () => {
      alive.current = false
    }
  }, [list])

  const patch = (id: string, p: Partial<Item>): void => setItems((all) => all.map((x) => (x.app.id === id ? { ...x, ...p } : x)))

  const run = async (): Promise<void> => {
    if (!list) return
    setStep('run')
    const removed: string[] = []
    for (const app of list) {
      if (!alive.current) return
      patch(app.id, { state: 'run' })
      try {
        const r = await window.api.uninstallApp(app.id, quiet)
        if (!r.ok) {
          patch(app.id, { state: 'fail', error: r.error === 'NO_UNINSTALLER' ? t('space.un.noUninstaller') : errText(new Error(r.error), t('common.uacDenied')) })
          continue
        }
        // the uninstaller works on its own — wait until Windows stops listing the app
        let gone = false
        while (alive.current && !skip.current.has(app.id)) {
          if (!(await window.api.appInstalled(app.id))) {
            gone = true
            break
          }
          await sleep(1500)
        }
        if (!gone) {
          patch(app.id, { state: 'skip' })
          continue
        }
        // give it a moment to finish deleting files
        await sleep(1500)
        const left = await window.api.findLeftovers(app.id).catch(() => [])
        const freed = Math.max(0, (app.size ?? 0) - sumSize(left))
        patch(app.id, { state: 'done', leftovers: left, picked: new Set(left.map((l) => l.path)), freed })
        removed.push(app.id)
        track({ type: 'uninstall', freed })
        burst({ big: freed > 5 * 1024 ** 3 })
      } catch (e) {
        patch(app.id, { state: 'fail', error: errText(e, t('common.uacDenied')) })
      }
    }
    if (!alive.current) return
    space.dropApps(removed)
    void space.refreshDrives()
    setStep('done')
  }

  const leftoverPaths = items.flatMap((x) => x.leftovers.filter((l) => x.picked.has(l.path)))
  const moveLeftovers = async (): Promise<void> => {
    setMoving(true)
    try {
      const r = await window.api.trashPaths(leftoverPaths.map((l) => l.path))
      setMoved(r.size)
      space.setBinHint(true)
      void space.refreshExtras()
    } catch (e) {
      toast(errText(e, t('common.uacDenied')), 'err')
    } finally {
      setMoving(false)
    }
  }

  const close = (): void => {
    // skipped apps may have been removed after all — the list catches up
    const skipped = items.filter((x) => x.state === 'skip').map((x) => x.app.id)
    if (skipped.length)
      void Promise.all(skipped.map(async (id) => ((await window.api.appInstalled(id).catch(() => true)) ? null : id))).then((ids) =>
        space.dropApps(ids.filter((x): x is string => !!x))
      )
    onClose()
  }

  const view = list ?? last.current
  if (!view) return null
  const total = sumSize(view)
  const warns = view.map((a) => ({ a, h: appHint(a.name) })).filter((x) => x.h?.hint === 'keep' || x.h?.hint === 'careful')
  const hasSteam = view.some((a) => a.kind === 'steam')
  const hasEpic = view.some((a) => a.kind === 'epic')
  const doneItems = items.filter((x) => x.state === 'done')
  const freedTotal = doneItems.reduce((s, x) => s + x.freed, 0)

  return (
    <Modal open={!!list} onClose={step === 'run' ? undefined : close} wide>
      <h3 className="font-display text-lg font-semibold">{step === 'done' && doneItems.length ? t('space.un.finishTitle') : t('space.un.title')}</h3>
      {step === 'confirm' && (
        <>
          <p className="mt-1 text-sm text-muted">{t('space.un.text', { n: view.length, size: fmt(total) })}</p>
          <div className="mt-4 max-h-52 space-y-1.5 overflow-y-auto pr-1">
            {view.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl bg-panel2/70 px-3 py-2">
                <AppIcon src={space.icons[a.id]} name={a.name} size={24} />
                <span className="flex-1 truncate text-sm">{a.name}</span>
                <span className="text-xs text-muted tabular-nums">{a.size != null ? fmt(a.size) : '—'}</span>
              </div>
            ))}
          </div>
          {warns.length > 0 && (
            <div className="mt-3 space-y-1.5 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
              {warns.map(({ a, h }) => (
                <div key={a.id} className="flex gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  {t('space.un.warn', { name: a.name, why: t(`space.apps.why.${h!.why}`) })}
                </div>
              ))}
            </div>
          )}
          {view.some((a) => a.quiet) && (
            <div className="mt-4 flex items-center gap-4 rounded-xl border border-line bg-panel2/50 p-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t('space.un.quiet')}</div>
                <p className="mt-0.5 text-xs text-muted">{t('space.un.quietText')}</p>
              </div>
              <Toggle checked={quiet} onChange={setQuiet} />
            </div>
          )}
          {hasSteam && <p className="mt-3 text-xs text-muted">{t('space.un.steamNote')}</p>}
          {hasEpic && <p className="mt-1 text-xs text-muted">{t('space.un.epicNote')}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => void run()}>
              {t('space.un.start')}
            </Button>
          </div>
        </>
      )}

      {step !== 'confirm' && (
        <>
          {step === 'done' && (
            <p className={cx('mt-1 text-sm', doneItems.length ? 'text-good' : 'text-muted')}>
              {t('space.un.finish', { n: doneItems.length, size: fmt(freedTotal) })}
            </p>
          )}
          <div className="mt-4 max-h-[52vh] space-y-2 overflow-y-auto pr-1">
            {items.map((x) => (
              <ItemRow
                key={x.app.id}
                item={x}
                quiet={quiet}
                icon={space.icons[x.app.id]}
                onSkip={() => skip.current.add(x.app.id)}
                onPick={(path, on) => {
                  const n = new Set(x.picked)
                  if (on) n.add(path)
                  else n.delete(path)
                  patch(x.app.id, { picked: n })
                }}
                locked={moved !== null}
              />
            ))}
          </div>
          {step === 'done' && (
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              {moved !== null ? (
                <span className="mr-auto text-sm text-good">{t('space.un.leftoversMoved', { size: fmt(moved) })}</span>
              ) : (
                leftoverPaths.length > 0 && (
                  <Button icon={<Trash2 className="size-4" />} loading={moving} onClick={() => void moveLeftovers()}>
                    {t('space.un.removeLeftovers', { size: fmt(sumSize(leftoverPaths)) })}
                  </Button>
                )
              )}
              <Button variant="primary" onClick={close}>
                {t('common.done')}
              </Button>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

function ItemRow({
  item, quiet, icon, onSkip, onPick, locked
}: {
  item: Item
  quiet: boolean
  icon?: string
  onSkip: () => void
  onPick: (path: string, on: boolean) => void
  locked: boolean
}): ReactNode {
  const { t, i18n } = useTranslation()
  const fmt = (v: number): string => fmtBytes(v, i18n.language)
  const a = item.app
  const how =
    a.kind === 'steam' ? 'runningSteam' : a.kind === 'epic' ? 'runningEpic' : quiet && a.quiet ? 'runningQuiet' : 'runningWizard'
  const left = sumSize(item.leftovers)
  return (
    <div
      className={cx(
        'rounded-xl border px-3 py-2.5 transition-colors',
        item.state === 'run' ? 'border-teal/60 bg-teal/10' : item.state === 'done' ? 'border-good/30 bg-good/5' : 'border-line bg-panel2/50'
      )}
    >
      <div className="flex items-center gap-3">
        <AppIcon src={icon} name={a.name} size={24} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{a.name}</div>
          <div className={cx('text-xs', item.state === 'fail' ? 'text-bad' : item.state === 'done' ? 'text-good' : 'text-muted')}>
            {item.state === 'wait' && t('space.un.wait')}
            {item.state === 'run' && t(`space.un.${how}`)}
            {item.state === 'done' && `${t('space.un.done')} · ${fmt(item.freed)}`}
            {item.state === 'skip' && t('space.un.skipped')}
            {item.state === 'fail' && `${t('space.un.failed')}: ${item.error ?? ''}`}
          </div>
        </div>
        {item.state === 'run' && (
          <>
            <LoaderCircle className="size-4 animate-spin text-ice" />
            <Button size="sm" variant="ghost" icon={<SkipForward className="size-3.5" />} onClick={onSkip}>
              {t('space.un.skip')}
            </Button>
          </>
        )}
        {item.state === 'done' && <CircleCheck className="size-5 text-good" />}
        {item.state === 'fail' && <CircleX className="size-5 text-bad" />}
      </div>
      <AnimatePresence>
        {item.leftovers.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mt-2.5 border-t border-line/60 pt-2.5">
              <div className="mb-1.5 text-xs font-medium text-warn">{t('space.un.leftovers', { size: fmt(left) })}</div>
              {item.leftovers.map((l) => (
                <div key={l.path} className="flex items-center gap-2.5 py-1">
                  <Checkbox checked={item.picked.has(l.path)} disabled={locked} onChange={(v) => onPick(l.path, v)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[11px]" title={l.path}>
                      {l.path}
                    </div>
                    <div className="text-[11px] text-muted">{t(l.kind === 'install' ? 'space.un.leftInstall' : 'space.un.leftData')}</div>
                  </div>
                  <span className="text-xs text-muted tabular-nums">{fmt(l.size)}</span>
                  <button className="text-muted hover:text-ice" title={t('space.files.show')} onClick={() => void window.api.showInFolder(l.path)}>
                    <FolderOpen className="size-3.5" />
                  </button>
                </div>
              ))}
              <p className="mt-1 text-[11px] text-muted/80">{t('space.un.leftNote')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
