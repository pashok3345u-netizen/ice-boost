import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { Lock, Trophy, Zap } from 'lucide-react'
import { ACHIEVEMENTS, levelOf, titleKey, useProgress } from '../progress'
import { Card, CountUp, PageHeader, cx } from '../ui'
import { fmtBytes } from '../format'

export function Achievements(): ReactNode {
  const { t, i18n } = useTranslation()
  const { xp, stats, unlocked, allRec } = useProgress()
  const { level, into, need } = levelOf(xp)
  const got = Object.keys(unlocked).length

  const tiles = [
    { label: t('ach.stats.freed'), value: stats.freed, format: (v: number) => fmtBytes(v, i18n.language) },
    { label: t('ach.stats.cleans'), value: stats.cleans },
    { label: t('ach.stats.tweaks'), value: stats.tweaks },
    { label: t('ach.stats.streak'), value: stats.streak, suffix: ' 🔥' }
  ]

  return (
    <div>
      <PageHeader icon={<Trophy className="size-5" />} title={t('ach.pageTitle')} subtitle={t('ach.subtitle')} />

      <div className="mb-5 grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-5">
        <Card className="relative flex items-center gap-6 overflow-hidden">
          <div className="pointer-events-none absolute -top-20 -left-10 size-64 rounded-full bg-teal/30 blur-3xl" />
          <motion.div
            className="accent-gradient relative grid size-28 shrink-0 place-items-center rounded-3xl shadow-xl shadow-teal/30"
            initial={{ rotate: -12, scale: 0.6 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 14 }}
          >
            <span className="font-display text-5xl font-black text-[#1a1a1f]">{level}</span>
          </motion.div>
          <div className="relative min-w-0 flex-1">
            <div className="text-xs tracking-[0.2em] text-muted uppercase">{t('ach.titleLabel')}</div>
            <div className="font-display frost-text text-2xl font-bold">{t(`ach.title.${titleKey(level)}`)}</div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#3a3a43]">
              <motion.div
                className="accent-gradient h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(into / need) * 100}%` }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-muted tabular-nums">
              <span>{t('ach.xp', { a: into, b: need })}</span>
              <span>{t('ach.toNext', { n: need - into })}</span>
            </div>
          </div>
        </Card>

        <Card delay={0.05}>
          <h2 className="font-display mb-3 flex items-center gap-2 text-sm font-semibold">
            <Zap className="size-4 text-warn" />
            {t('ach.howTo')}
          </h2>
          <ul className="space-y-2 text-sm text-muted">
            {(t('ach.howList', { returnObjects: true }) as string[]).map((s) => (
              <li key={s} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ice" />
                {s}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        {tiles.map((x, i) => (
          <Card key={x.label} hover delay={0.08 + i * 0.05} className="p-4">
            <div className="text-xs text-muted">{x.label}</div>
            <div className="font-display mt-1 text-2xl font-bold">
              <CountUp value={x.value} format={x.format} />
              {x.suffix}
            </div>
          </Card>
        ))}
      </div>

      <h2 className="font-display mb-3 flex items-center justify-between text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        <span>{t('ach.pageTitle')}</span>
        <span>{t('ach.count', { a: got, b: ACHIEVEMENTS.length })}</span>
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {ACHIEVEMENTS.map((a, i) => {
          const done = !!unlocked[a.id]
          const hidden = a.secret && !done
          const p = done ? 1 : Math.max(0, Math.min(1, a.progress(stats, { allRec })))
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.035 }}
              whileHover={{ y: -3, rotate: done ? -0.6 : 0 }}
              className={cx(
                'card relative flex items-center gap-3.5 overflow-hidden rounded-2xl border p-4',
                done ? 'border-teal/60 shadow-[0_10px_30px_-18px_rgba(82,138,154,0.9)]' : 'border-line'
              )}
            >
              <div
                className={cx(
                  'grid size-12 shrink-0 place-items-center rounded-xl text-2xl',
                  done ? 'accent-gradient' : 'bg-panel2 grayscale'
                )}
              >
                {hidden ? <Lock className="size-5 text-muted" /> : <span className={done ? '' : 'opacity-40'}>{a.emoji}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className={cx('truncate text-sm font-semibold', !done && 'text-muted')}>{hidden ? t('ach.locked') : t(`ach.list.${a.id}.t`)}</div>
                <div className="truncate text-xs text-muted">{hidden ? t('ach.lockedHint') : t(`ach.list.${a.id}.d`)}</div>
                {!done && !hidden && p > 0 && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#3a3a43]">
                    <div className="h-full rounded-full bg-teal" style={{ width: `${p * 100}%` }} />
                  </div>
                )}
              </div>
              <div className={cx('font-display shrink-0 text-xs font-bold', done ? 'text-good' : 'text-muted/70')}>
                {done ? '✓' : `+${a.xp}`}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
