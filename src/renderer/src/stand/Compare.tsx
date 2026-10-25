// "Before / after": the user's PC next to the edited one — parts, FPS in every game, money.
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, X } from 'lucide-react'
import { Modal, cx } from '../ui'
import { SLOTS, type Build } from './catalog'
import { buyPrice, checkBuild, partAt, picks, samePart, upgradeCost, type BuyMode } from './check'
import { estimate, GAMES, type Calibration, type Preset, type Res } from './games'
import { ICON, IssueLine, partName, rub } from './names'

export function Compare({
  open, onClose, mine, build, mode, sellOld, res, preset, cal, focus
}: {
  open: boolean
  onClose: () => void
  mine: Build
  build: Build
  mode: BuyMode
  sellOld: boolean
  res: Res
  preset: Preset
  cal: Calibration | null
  /** the user's installed games: listed first */
  focus: string[]
}): ReactNode {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const ru = lang === 'ru'
  const cost = upgradeCost(build, mine, mode, sellOld)
  const issues = checkBuild(build)

  const games = [...GAMES]
    .sort((a, b) => Number(focus.includes(b.id)) - Number(focus.includes(a.id)))
    .map((g) => ({ g, was: estimate(mine, g, res, preset, cal), now: estimate(build, g, res, preset, cal) }))
  const known = games.filter((x) => x.was && x.now)
  const avg = known.length ? Math.exp(known.reduce((s, x) => s + Math.log(x.now!.fps / x.was!.fps), 0) / known.length) - 1 : null
  const top = Math.max(1, ...known.map((x) => Math.max(x.was!.fps, x.now!.fps)))

  return (
    <Modal open={open} onClose={onClose} xl>
      <div className="flex max-h-[80vh] flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">{t('stand.compare.title')}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {t('stand.advice.settings', { settings: `${t(`stand.fps.res.${res}`)} · ${t(`stand.fps.preset.${preset}`)}` })}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-text">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 grid min-h-0 flex-1 grid-cols-[1fr_1fr] gap-5 overflow-y-auto pr-1">
          {/* parts */}
          <div>
            <div className="mb-2 grid grid-cols-[1fr_1fr] gap-2 text-[11px] font-medium tracking-wide text-muted uppercase">
              <span>{t('stand.compare.now')}</span>
              <span>{t('stand.compare.after')}</span>
            </div>
            <div className="space-y-1">
              {picks(build, SLOTS).map((p) => {
                const a = partAt(mine, p)
                const b = partAt(build, p)
                const changed = !!a && !samePart(a, b)
                const price = changed ? buyPrice(b, mode) : null
                return (
                  <div
                    key={`${p.slot}${p.index ?? ''}`}
                    className={cx('grid grid-cols-[1fr_1fr] gap-2 rounded-lg px-2 py-1.5 text-xs', changed && 'bg-teal/10')}
                  >
                    <span className="flex min-w-0 items-center gap-1.5 text-muted">
                      <span className="shrink-0 scale-90">{ICON[p.slot]}</span>
                      <span className="truncate">{a ? partName(a, t) : '—'}</span>
                    </span>
                    <span className={cx('min-w-0', changed ? 'text-frost' : 'text-muted')}>
                      <span className="block truncate font-medium">{partName(b, t)}</span>
                      {price != null && <span className="block text-[10px] text-ice tabular-nums">{rub(price, lang)}</span>}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 space-y-1.5 rounded-xl border border-line bg-deep/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">{t('stand.cost.buy')}</span>
                <span className="tabular-nums">{rub(cost.buy, lang)}</span>
              </div>
              {sellOld && (
                <div className="flex justify-between">
                  <span className="text-muted">{t('stand.cost.sell')}</span>
                  <span className="text-good tabular-nums">−{rub(cost.sell, lang)}</span>
                </div>
              )}
              <div className="flex items-end justify-between border-t border-line/60 pt-1.5">
                <span className="text-muted">{t('stand.cost.total')}</span>
                <span className="font-display text-lg font-semibold text-frost tabular-nums">{rub(Math.max(0, cost.total), lang)}</span>
              </div>
            </div>
            {issues.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {issues.map((i) => (
                  <IssueLine key={i.id} issue={i} />
                ))}
              </div>
            )}
          </div>

          {/* FPS */}
          <div>
            <div className="mb-2 flex items-end justify-between">
              <span className="text-[11px] font-medium tracking-wide text-muted uppercase">{t('stand.compare.fps')}</span>
              {avg != null && (
                <span className={cx('font-display text-lg font-semibold tabular-nums', avg >= 0 ? 'text-good' : 'text-bad')}>
                  {avg >= 0 ? '+' : ''}
                  {Math.round(avg * 100)}%
                </span>
              )}
            </div>
            <div className="space-y-2">
              {games.map(({ g, was, now }) => {
                if (!was || !now) return null
                const d = now.fps / was.fps - 1
                return (
                  <div key={g.id} className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={cx('min-w-0 flex-1 truncate', focus.includes(g.id) ? 'font-medium text-frost' : 'text-text')}>
                        {ru && g.nameRu ? g.nameRu : g.name}
                      </span>
                      <span className="text-muted tabular-nums">{was.fps}</span>
                      <ArrowRight className="size-3 text-muted" />
                      <span className="w-8 text-right font-semibold text-frost tabular-nums">{now.fps}</span>
                      <span className={cx('w-11 text-right text-[11px] tabular-nums', d > 0.02 ? 'text-good' : d < -0.02 ? 'text-bad' : 'text-muted')}>
                        {d >= 0 ? '+' : ''}
                        {Math.round(d * 100)}%
                      </span>
                    </div>
                    <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-[#3a3a43]">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-good/80" style={{ width: `${(now.fps / top) * 100}%` }} />
                      <div className="absolute inset-y-0 left-0 rounded-full bg-muted/70" style={{ width: `${(was.fps / top) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted/70">{t('stand.compare.note')}</p>
          </div>
        </div>
      </div>
    </Modal>
  )
}
