// "Optimize in 1 click": restore point → clean junk → turn on recommended tweaks.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, CircleX, LoaderCircle, Rocket } from 'lucide-react'
import { TWEAKS } from '../../shared/tweaks'
import { useStore } from './store'
import { Button, Modal, cx } from './ui'
import { errText, fmtBytes } from './format'

type StepId = 'restore' | 'clean' | 'tweaks'
type StepState = 'wait' | 'run' | 'ok' | 'fail' | 'skip'

interface Result {
  freed: number
  applied: number
  needReboot: boolean
  strongSkipped: boolean
}

export function OneClick({ open, onClose }: { open: boolean; onClose: () => void }): ReactNode {
  const { t, i18n } = useTranslation()
  const store = useStore()
  const [steps, setSteps] = useState<Record<StepId, StepState>>({ restore: 'wait', clean: 'wait', tweaks: 'wait' })
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!open || started.current) return
    started.current = true
    setResult(null)
    setError(null)
    const set = (id: StepId, s: StepState): void => setSteps((p) => ({ ...p, [id]: s }))
    setSteps({ restore: 'wait', clean: 'wait', tweaks: 'wait' })

    void (async () => {
      const states = store.tweaks ?? []
      const todo = TWEAKS.filter((tw) => tw.recommended && !states.find((s) => s.id === tw.id)?.applied)
      const hasStrong = todo.some((tw) => tw.level === 'strong')
      let strongSkipped = false
      try {
        // 1. restore point, only if system-wide tweaks will change
        if (hasStrong && !store.restoreDone) {
          set('restore', 'run')
          const r = await window.api.createRestorePoint()
          if (r.status === 'error') {
            strongSkipped = true
            set('restore', 'fail')
          } else {
            store.setRestoreDone(true)
            set('restore', 'ok')
          }
        } else set('restore', 'skip')

        // 2. junk
        set('clean', 'run')
        const junk = store.junk ?? (await window.api.scanJunk())
        const ids = junk.filter((j) => j.defaultOn && (j.size == null || j.size > 0)).map((j) => j.id)
        const cleaned = ids.length ? await window.api.cleanJunk(ids) : { freed: 0, deleted: 0, failed: 0, skipped: [] }
        set('clean', 'ok')

        // 3. tweaks
        set('tweaks', 'run')
        const apply = todo.filter((tw) => !(strongSkipped && tw.level === 'strong'))
        const res = apply.length ? await window.api.applyTweaks(apply.map((tw) => tw.id)) : {}
        const okIds = Object.entries(res).filter(([, r]) => r.ok).map(([id]) => id)
        set('tweaks', okIds.length === apply.length ? 'ok' : 'fail')

        setResult({
          freed: cleaned.freed,
          applied: okIds.length,
          needReboot: TWEAKS.some((tw) => okIds.includes(tw.id) && tw.restart !== 'none'),
          strongSkipped
        })
      } catch (e) {
        setError(errText(e, t('common.uacDenied')))
      } finally {
        void store.scan()
        void store.loadTweaks()
      }
    })()
  }, [open, store, t])

  const close = (): void => {
    started.current = false
    onClose()
  }
  const busy = !result && !error

  const icon = (s: StepState): ReactNode => {
    if (s === 'run') return <LoaderCircle className="size-5 animate-spin text-ice" />
    if (s === 'ok') return <CircleCheck className="size-5 text-good" />
    if (s === 'fail') return <CircleX className="size-5 text-warn" />
    return <span className={cx('size-5 rounded-full border-2', s === 'skip' ? 'border-line opacity-40' : 'border-[#2a3958]')} />
  }

  return (
    <Modal open={open} onClose={busy ? undefined : close}>
      <div className="mb-5 flex items-center gap-3">
        <div className="ice-gradient grid size-10 place-items-center rounded-xl text-slate-950">
          <Rocket className="size-5" />
        </div>
        <h2 className="text-lg font-semibold">{result ? t('dash.run.result') : t('dash.run.title')}</h2>
      </div>

      <div className="space-y-3">
        {(['restore', 'clean', 'tweaks'] as StepId[]).map((id) => (
          <div key={id} className={cx('flex items-center gap-3 text-sm', steps[id] === 'skip' && 'opacity-40')}>
            {icon(steps[id])}
            {t(`dash.run.${id}`)}
          </div>
        ))}
      </div>

      {result && (
        <div className="fade-up mt-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-panel2 p-4">
              <div className="text-xs text-muted">{t('dash.run.freed')}</div>
              <div className="ice-text text-2xl font-bold">{fmtBytes(result.freed, i18n.language)}</div>
            </div>
            <div className="rounded-xl bg-panel2 p-4">
              <div className="text-xs text-muted">{t('dash.run.applied')}</div>
              <div className="ice-text text-2xl font-bold">{result.applied}</div>
            </div>
          </div>
          {result.strongSkipped && <p className="text-xs text-warn">{t('dash.run.skippedStrong')}</p>}
          {result.needReboot && <p className="text-xs text-muted">{t('dash.run.needReboot')}</p>}
        </div>
      )}
      {error && <p className="mt-5 text-sm text-bad">{error}</p>}

      <div className="mt-6 flex justify-end">
        <Button variant={busy ? 'soft' : 'primary'} disabled={busy} onClick={close}>
          {t('common.done')}
        </Button>
      </div>
    </Modal>
  )
}
