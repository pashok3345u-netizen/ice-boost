// "Optimize in 1 click": restore point → clean junk → turn on recommended tweaks.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { CircleCheck, CircleX, LoaderCircle, Rocket } from 'lucide-react'
import { TWEAKS } from '../../shared/tweaks'
import { useStore } from './store'
import { useProgress } from './progress'
import { Button, CountUp, Modal, cx } from './ui'
import { errText, fmtBytes } from './format'
import { burst } from './Fx'

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
  const { track } = useProgress()
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
        burst({ big: true })
        if (ids.length) track({ type: 'clean', freed: cleaned.freed })
        if (okIds.length) track({ type: 'tweaks', count: okIds.length })
        track({ type: 'oneClick' })
      } catch (e) {
        setError(errText(e, t('common.uacDenied')))
      } finally {
        void store.scan()
        void store.loadTweaks()
      }
    })()
  }, [open, store, t, track])

  const close = (): void => {
    started.current = false
    onClose()
  }
  const busy = !result && !error

  const icon = (s: StepState): ReactNode => {
    if (s === 'run') return <LoaderCircle className="size-5 animate-spin text-ice" />
    if (s === 'ok')
      return (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}>
          <CircleCheck className="size-5 text-good" />
        </motion.span>
      )
    if (s === 'fail') return <CircleX className="size-5 text-warn" />
    return <span className={cx('size-5 rounded-full border-2', s === 'skip' ? 'border-line opacity-40' : 'border-[#4a4a55]')} />
  }

  return (
    <Modal open={open} onClose={busy ? undefined : close}>
      <div className="mb-5 flex items-center gap-3">
        <motion.div
          className={cx('accent-gradient grid size-11 place-items-center rounded-xl text-[#1a1a1f]', busy && 'shake')}
          animate={result ? { y: [0, -40, 0], rotate: [0, -20, 0] } : {}}
          transition={{ duration: 0.8 }}
        >
          <Rocket className="size-5" />
        </motion.div>
        <h2 className="font-display text-lg font-semibold">{result ? t('dash.run.result') : t('dash.run.title')}</h2>
      </div>

      <div className="space-y-3">
        {(['restore', 'clean', 'tweaks'] as StepId[]).map((id, i) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: steps[id] === 'skip' ? 0.4 : 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className={cx('flex items-center gap-3 rounded-xl px-3 py-2 text-sm', steps[id] === 'run' && 'bg-teal/15')}
          >
            {icon(steps[id])}
            {t(`dash.run.${id}`)}
          </motion.div>
        ))}
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-panel2 p-4">
              <div className="text-xs text-muted">{t('dash.run.freed')}</div>
              <div className="font-display frost-text text-2xl font-bold">
                <CountUp value={result.freed} duration={1400} format={(v) => fmtBytes(v, i18n.language)} />
              </div>
            </div>
            <div className="rounded-xl border border-line bg-panel2 p-4">
              <div className="text-xs text-muted">{t('dash.run.applied')}</div>
              <div className="font-display frost-text text-2xl font-bold">
                <CountUp value={result.applied} duration={900} />
              </div>
            </div>
          </div>
          {result.strongSkipped && <p className="text-xs text-warn">{t('dash.run.skippedStrong')}</p>}
          {result.needReboot && <p className="text-xs text-muted">{t('dash.run.needReboot')}</p>}
        </motion.div>
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
