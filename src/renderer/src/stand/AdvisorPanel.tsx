import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { ArrowRight, Check, Columns2, Sparkles, TriangleAlert } from 'lucide-react'
import { Button, Checkbox, cx } from '../ui'
import type { Build } from './catalog'
import type { BuyMode } from './check'
import { advise, type Plan } from './advisor'
import { estimate, GAMES, type Calibration, type Preset, type Res } from './games'
import { Segmented, useInstalledGames } from './FpsPanel'
import { ICON, partName, rub } from './names'

const CHIPS = [10000, 20000, 30000, 50000, 80000, 120000]
const MAX = 150000

let budgetKeep = 30000
let focusKeep: 'mine' | 'all' = 'mine'

function sameBuild(a: Build | null, b: Build): boolean {
  if (!a) return false
  return (['cpu', 'cooler', 'gpu', 'ram', 'mobo', 'psu'] as const).every((s) => a[s].id.split('#')[0] === b[s].id.split('#')[0])
}

function PlanCard({
  title, note, plan, mine, res, preset, cal, focus, active, tone, onTry, onCompare
}: {
  title: string
  note?: string
  plan: Plan
  mine: Build
  res: Res
  preset: Preset
  cal: Calibration | null
  focus: string[]
  /** this plan is on the stand right now */
  active: boolean
  tone: 'best' | 'other'
  onTry: () => void
  onCompare: () => void
}): ReactNode {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const ru = lang === 'ru'
  // the user's games first, then the rest; four lines are enough on a card
  const games = [...GAMES].sort((a, b) => Number(focus.includes(b.id)) - Number(focus.includes(a.id))).slice(0, 4)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cx('rounded-2xl border p-4', tone === 'best' ? 'border-teal/50 bg-teal/10' : 'border-line bg-deep/40')}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-medium tracking-wide text-ice uppercase">{title}</div>
          {note && <div className="mt-0.5 text-[11px] text-muted">{note}</div>}
        </div>
        <div className="text-right">
          <div className="font-display text-xl leading-none font-semibold text-good tabular-nums">+{Math.round(plan.gain * 100)}%</div>
          <div className="mt-1 text-[10px] text-muted">{t('stand.advice.fps')}</div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {plan.items.map((i) => (
          <div key={i.slot} className="flex items-center gap-2 text-xs">
            <span className="text-ice">{ICON[i.slot]}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{partName(i.part, t)}</span>
              {i.forced && <span className="block text-[10px] text-muted">{t(`stand.advice.forced.${i.slot}`)}</span>}
            </span>
            <span className="shrink-0 tabular-nums">{rub(i.price, lang)}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-0.5 border-t border-line/60 pt-2 text-[11px]">
        {games.map((g) => {
          const was = estimate(mine, g, res, preset, cal)?.fps
          const now = estimate(plan.build, g, res, preset, cal)?.fps
          if (!was || !now) return null
          return (
            <div key={g.id} className="flex items-center gap-1.5 text-muted">
              <span className="min-w-0 flex-1 truncate">{ru && g.nameRu ? g.nameRu : g.name}</span>
              <span className="tabular-nums">{was}</span>
              <ArrowRight className="size-3" />
              <span className="font-medium text-frost tabular-nums">{now}</span>
            </div>
          )
        })}
      </div>

      {plan.items.some((i) => i.slot === 'mobo') && (
        <div className="mt-2 text-[11px] leading-relaxed text-muted">{t('stand.advice.rebuild')}</div>
      )}
      {plan.warns.map((w) => (
        <div key={w.id} className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-warn">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" />
          {t(`stand.issue.${w.id}`, w.vars)}
        </div>
      ))}

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="text-[11px] text-muted">
          {plan.sell > 0 ? (
            <span className="flex flex-wrap gap-x-1.5">
              <span className="whitespace-nowrap">{t('stand.advice.moneyBuy', { v: rub(plan.buy, lang) })}</span>
              <span className="whitespace-nowrap text-good">{t('stand.advice.moneySell', { v: rub(plan.sell, lang) })}</span>
            </span>
          ) : (
            t('stand.advice.buyOnly')
          )}
          <div className="font-display text-lg font-semibold text-frost tabular-nums">{rub(plan.net, lang)}</div>
        </div>
        <div className="flex gap-1.5">
          {active && (
            <Button size="sm" variant="ghost" icon={<Columns2 className="size-3.5" />} onClick={onCompare}>
              {t('stand.advice.compare')}
            </Button>
          )}
          <Button size="sm" variant={active ? 'soft' : 'primary'} icon={active ? <Check className="size-3.5" /> : undefined} onClick={onTry} disabled={active}>
            {active ? t('stand.advice.onStand') : t('stand.advice.try')}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

export function AdvisorPanel({
  mine, draft, mode, sellOld, res, preset, cal, onMode, onSell, onTry, onCompare
}: {
  mine: Build
  draft: Build | null
  mode: BuyMode
  sellOld: boolean
  res: Res
  preset: Preset
  cal: Calibration | null
  onMode: (m: BuyMode) => void
  onSell: (v: boolean) => void
  onTry: (b: Build) => void
  onCompare: () => void
}): ReactNode {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [budget, setBudgetState] = useState(budgetKeep)
  const [focusMode, setFocusState] = useState(focusKeep)
  const installed = useInstalledGames()
  const setBudget = (v: number): void => {
    budgetKeep = v
    setBudgetState(v)
  }
  const setFocus = (v: 'mine' | 'all'): void => {
    focusKeep = v
    setFocusState(v)
  }

  const mineIds = useMemo(() => GAMES.filter((g) => installed?.some((n) => g.match.test(n))).map((g) => g.id), [installed])
  const focus = useMemo(() => (focusMode === 'mine' ? mineIds : []), [focusMode, mineIds])
  const advice = useMemo(
    () => advise(mine, { budget, mode, sellOld, res, preset, cal, focus }),
    [mine, budget, mode, sellOld, res, preset, cal, focus]
  )

  const card = (key: string, title: string, plan: Plan | null, note?: string, tone: 'best' | 'other' = 'other'): ReactNode =>
    plan && (
      <PlanCard
        key={key}
        title={title}
        note={note}
        plan={plan}
        mine={mine}
        res={res}
        preset={preset}
        cal={cal}
        focus={focus}
        active={sameBuild(draft, plan.build)}
        tone={tone}
        onTry={() => onTry(plan.build)}
        onCompare={onCompare}
      />
    )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2.5 px-5 pb-3">
        <div className="flex items-end justify-between">
          <span className="text-xs text-muted">{t('stand.advice.budget')}</span>
          <span className="font-display text-xl font-semibold text-frost tabular-nums">{rub(budget, lang)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={MAX}
          step={1000}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="w-full accent-[#7db4c2]"
        />
        <div className="flex flex-wrap gap-1">
          {CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => setBudget(c)}
              className={cx(
                'rounded-full border px-2 py-0.5 text-[11px] tabular-nums transition-colors',
                budget === c ? 'border-teal/60 bg-teal/20 text-frost' : 'border-line text-muted hover:text-text'
              )}
            >
              {c / 1000}k
            </button>
          ))}
        </div>
        <Segmented value={mode} onChange={onMode} items={(['new', 'used'] as BuyMode[]).map((m) => ({ id: m, label: t(`stand.advice.mode.${m}`) }))} />
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <Checkbox checked={sellOld} onChange={onSell} />
          {t('stand.advice.sellOld')}
        </label>
        {mineIds.length > 0 && (
          <Segmented
            value={focusMode}
            onChange={setFocus}
            items={[
              { id: 'mine', label: t('stand.advice.focusMine') },
              { id: 'all', label: t('stand.advice.focusAll') }
            ]}
          />
        )}
        <div className="text-[10px] text-muted">
          {t('stand.advice.settings', { settings: `${t(`stand.fps.res.${res}`)} · ${t(`stand.fps.preset.${preset}`)}` })}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 pb-4">
        {advice.best ? (
          <>
            {card('best', t('stand.advice.best'), advice.best, undefined, 'best')}
            {card('value', t('stand.advice.value'), advice.value, t('stand.advice.valueNote'))}
            {advice.stretch &&
              card('stretch', t('stand.advice.stretch', { v: rub(advice.stretch.net - budget, lang) }), advice.stretch, t('stand.advice.stretchNote'))}
          </>
        ) : (
          <>
            <div className="flex items-start gap-2 rounded-xl border border-line bg-deep/40 px-3 py-2.5 text-xs leading-relaxed text-muted">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-ice" />
              {advice.cheapest ? t('stand.advice.none', { v: rub(advice.cheapest.net, lang) }) : t('stand.advice.nothing')}
            </div>
            {card('cheapest', t('stand.advice.cheapest'), advice.cheapest)}
          </>
        )}
        <p className="px-1 text-[10px] leading-relaxed text-muted/70">{t('stand.advice.note')}</p>
        {cal && Object.keys(cal.measures).length === 0 && <p className="px-1 text-[10px] leading-relaxed text-ice/80">{t('stand.advice.measureTip')}</p>}
      </div>
    </div>
  )
}
