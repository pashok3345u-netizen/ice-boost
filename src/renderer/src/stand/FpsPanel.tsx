import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, ChevronDown, Cpu, Gpu as GpuIcon, Pencil, Scale, TriangleAlert, X } from 'lucide-react'
import { Badge, cx } from '../ui'
import { isGame } from '../catalog'
import type { Build, Slot } from './catalog'
import {
  bottleneck, estimate, GAMES, looksCapped, PRESETS, RESES, type Calibration, type Game, type GameCat, type Preset, type Res
} from './games'

type Cat = 'all' | GameCat | 'mine'

// installed games: asked once per app run (the list comes from the registry and Steam)
let installedPromise: Promise<string[]> | null = null
function installedGames(): Promise<string[]> {
  installedPromise ??= window.api
    .getApps()
    .then((apps) => apps.filter((a) => isGame(a)).map((a) => a.name))
    .catch(() => [])
  return installedPromise
}

/** names of installed games (null while loading) */
export function useInstalledGames(): string[] | null {
  const [installed, setInstalled] = useState<string[] | null>(null)
  useEffect(() => {
    let alive = true
    void installedGames().then((list) => alive && setInstalled(list))
    return () => {
      alive = false
    }
  }, [])
  return installed
}

export function Segmented<T extends string>({
  value, items, onChange
}: {
  value: T
  items: { id: T; label: string }[]
  onChange: (v: T) => void
}): ReactNode {
  return (
    <div className="flex rounded-lg border border-line bg-deep p-0.5 text-[11px]">
      {items.map((x) => (
        <button
          key={x.id}
          onClick={() => onChange(x.id)}
          className={cx('flex-1 rounded-md px-2 py-1 transition-colors', value === x.id ? 'bg-teal/30 text-frost' : 'text-muted hover:text-text')}
        >
          {x.label}
        </button>
      ))}
    </div>
  )
}

function fpsColor(fps: number): string {
  return fps < 30 ? 'text-bad' : fps < 60 ? 'text-warn' : 'text-good'
}

function barColor(fps: number): string {
  return fps < 30 ? 'bg-bad' : fps < 60 ? 'bg-warn' : 'bg-good'
}

/** typing your real FPS for a game */
function MeasureEditor({
  start, settings, refresh, onSave, onCancel
}: {
  start: number | null
  settings: string
  refresh: number
  onSave: (fps: number) => void
  onCancel: () => void
}): ReactNode {
  const { t } = useTranslation()
  const [text, setText] = useState(start ? String(start) : '')
  const fps = Math.round(Number(text))
  const ok = Number.isFinite(fps) && fps >= 5 && fps <= 1000
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="mt-2 rounded-lg border border-teal/40 bg-deep/70 p-2.5">
        <div className="text-[11px] text-muted">{t('stand.fps.measureAsk', { settings })}</div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            autoFocus
            inputMode="numeric"
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && ok) onSave(fps)
              if (e.key === 'Escape') onCancel()
            }}
            placeholder="FPS"
            className="h-8 w-20 rounded-md border border-line bg-bg px-2 text-sm tabular-nums outline-none focus:border-teal"
          />
          <button
            disabled={!ok}
            onClick={() => onSave(fps)}
            className="grid size-8 place-items-center rounded-md bg-teal/30 text-frost transition-colors hover:bg-teal/50 disabled:opacity-40"
          >
            <Check className="size-4" />
          </button>
          <button onClick={onCancel} className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-white/5 hover:text-text">
            <X className="size-4" />
          </button>
        </div>
        {ok && looksCapped(fps, refresh) && (
          <div className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-warn">
            <TriangleAlert className="mt-0.5 size-3 shrink-0" />
            {t('stand.fps.capped')}
          </div>
        )}
      </div>
    </motion.div>
  )
}

let catKeep: Cat = 'all'

export function FpsPanel({
  build, before, cal, res, preset, refresh, onRes, onPreset, onPick, onMeasure
}: {
  build: Build
  /** the user's own PC, when the build was changed — to show "was → now" */
  before: Build | null
  /** the user's real FPS measurements on their PC */
  cal: Calibration | null
  res: Res
  preset: Preset
  /** monitor refresh rate, Hz (0 = unknown) */
  refresh: number
  onRes: (r: Res) => void
  onPreset: (p: Preset) => void
  onPick: (slot: Slot) => void
  /** null = forget the measurement */
  onMeasure: (game: string, fps: number | null) => void
}): ReactNode {
  const { t, i18n } = useTranslation()
  const ru = i18n.language === 'ru'
  const [cat, setCatState] = useState<Cat>(catKeep)
  const installed = useInstalledGames()
  const [editing, setEditing] = useState<string | null>(null)
  const [howTo, setHowTo] = useState(false)
  const setCat = (c: Cat): void => {
    catKeep = c
    setCatState(c)
  }

  const mineIds = useMemo(
    () => new Set(GAMES.filter((g) => installed?.some((n) => g.match.test(n))).map((g) => g.id)),
    [installed]
  )
  const unknown = useMemo(
    () => [...new Set((installed ?? []).filter((n) => !GAMES.some((g) => g.match.test(n))))].slice(0, 8),
    [installed]
  )

  const settingsText = (r: Res, p: Preset): string => `${t(`stand.fps.res.${r}`)} · ${t(`stand.fps.preset.${p}`)}`
  const gameName = (g: Game): string => (ru && g.nameRu ? g.nameRu : g.name)

  const rows = GAMES.filter((g) => (cat === 'all' ? true : cat === 'mine' ? mineIds.has(g.id) : g.cat === cat))
    .map((g) => ({ g, now: estimate(build, g, res, preset, cal), was: before ? estimate(before, g, res, preset, cal) : null }))
    // your games first
    .sort((a, b) => Number(mineIds.has(b.g.id)) - Number(mineIds.has(a.g.id)))
  const neck = bottleneck(build, res, preset, cal)
  const top = Math.max(144, refresh || 0)
  const noData = !build.gpu.perf || !build.cpu.perf
  const measuredCount = Object.keys(cal?.measures ?? {}).length

  const cats: Cat[] = ['all', 'shooter', 'heavy', 'light', ...(mineIds.size ? (['mine'] as Cat[]) : [])]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 px-5 pb-3">
        <Segmented value={res} onChange={onRes} items={RESES.map((r) => ({ id: r, label: t(`stand.fps.res.${r}`) }))} />
        <Segmented value={preset} onChange={onPreset} items={PRESETS.map((p) => ({ id: p, label: t(`stand.fps.preset.${p}`) }))} />
        <div className="flex flex-wrap gap-1 pt-1">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cx(
                'rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
                cat === c ? 'border-teal/60 bg-teal/20 text-frost' : 'border-line text-muted hover:text-text'
              )}
            >
              {t(`stand.fps.cat.${c}`)}
              {c === 'mine' && ` · ${mineIds.size}`}
            </button>
          ))}
        </div>
        {neck && (
          <button
            onClick={() => neck !== 'balanced' && onPick(neck)}
            disabled={neck === 'balanced'}
            className="flex w-full items-start gap-2.5 rounded-xl border border-line bg-deep/60 px-3 py-2 text-left transition-colors enabled:hover:border-teal/50"
          >
            <span className="mt-0.5 text-ice">
              {neck === 'gpu' ? <GpuIcon className="size-4" /> : neck === 'cpu' ? <Cpu className="size-4" /> : <Scale className="size-4" />}
            </span>
            <span className="text-xs leading-relaxed">
              <span className="block font-medium text-frost">{t(`stand.fps.neck.${neck}`)}</span>
              <span className="text-muted">{t(`stand.fps.neckHint.${neck}`)}</span>
            </span>
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {/* how accurate this is, and how to make it exact */}
        <div className="mx-2.5 mb-2 rounded-xl border border-line/80 bg-deep/40 px-3 py-2 text-[11px] leading-relaxed text-muted">
          {measuredCount ? t('stand.fps.calibrated', { count: measuredCount }) : t('stand.fps.estimateNote')}
          <button onClick={() => setHowTo(!howTo)} className="mt-1 flex items-center gap-1 font-medium text-ice hover:text-frost">
            {t('stand.fps.howTo')}
            <ChevronDown className={cx('size-3 transition-transform', howTo && 'rotate-180')} />
          </button>
          <AnimatePresence initial={false}>
            {howTo && (
              <motion.ul
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-1 list-disc space-y-0.5 overflow-hidden pl-4"
              >
                {(['steam', 'amd', 'nvidia', 'roblox', 'tips'] as const).map((k) => (
                  <li key={k}>{t(`stand.fps.how.${k}`)}</li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        {noData ? (
          <p className="px-2.5 py-4 text-xs text-muted">{t('stand.fps.noData')}</p>
        ) : (
          rows.map(({ g, now, was }, i) => {
            if (!now) return null
            const delta = was ? now.fps / was.fps - 1 : 0
            const m = cal?.measures[g.id]
            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="group rounded-xl px-2.5 py-2 transition-colors hover:bg-white/5"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{gameName(g)}</span>
                  {mineIds.has(g.id) && <Badge tone="ice">{t('stand.fps.yours')}</Badge>}
                  {m && <Badge tone="good">{t('stand.fps.measured')}</Badge>}
                  {was && Math.abs(delta) >= 0.03 && (
                    <span className="flex items-center gap-1 text-[11px] text-muted tabular-nums">
                      {was.fps}
                      <ArrowRight className="size-3" />
                    </span>
                  )}
                  <span className={cx('font-display min-w-10 text-right text-base font-semibold tabular-nums', fpsColor(now.fps))}>
                    {/* exact only for the user's own PC with a measurement; everything else is a forecast */}
                    {!(now.measured && !before) && <span className="mr-0.5 text-xs font-normal text-muted">≈</span>}
                    {now.fps}
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#3a3a43]">
                  <motion.div
                    className={cx('h-full rounded-full', barColor(now.fps))}
                    initial={false}
                    animate={{ width: `${Math.min(100, (now.fps / top) * 100)}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                  />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-muted">
                  <span>{t(`stand.fps.cat.${g.cat}`)}</span>
                  {was && Math.abs(delta) >= 0.03 && (
                    <span className={delta > 0 ? 'text-good' : 'text-bad'}>
                      {delta > 0 ? '+' : ''}
                      {Math.round(delta * 100)}%
                    </span>
                  )}
                  {now.limit === 'cap' && <span>{t('stand.fps.cap', { v: now.fps })}</span>}
                  {now.vramShort && <span className="text-warn">{t('stand.fps.vram')}</span>}
                  {now.ramShort && <span className="text-warn">{t('stand.fps.ram')}</span>}
                  <span className="ml-auto flex items-center gap-1.5">
                    {m && (
                      <>
                        <span>{t('stand.fps.measuredAt', { fps: m.fps, settings: settingsText(m.res, m.preset) })}</span>
                        <button onClick={() => onMeasure(g.id, null)} className="text-muted hover:text-bad" title={t('stand.fps.forget')}>
                          <X className="size-3" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setEditing(editing === g.id ? null : g.id)}
                      className={cx(
                        'flex items-center gap-1 text-ice transition-opacity hover:text-frost',
                        !m && editing !== g.id && 'opacity-0 group-hover:opacity-100',
                        mineIds.has(g.id) && 'opacity-100'
                      )}
                    >
                      <Pencil className="size-3" />
                      {m ? '' : t('stand.fps.myFps')}
                    </button>
                  </span>
                </div>
                {g.hint && <div className="mt-1 text-[10px] leading-relaxed text-ice/80">{t(`stand.fps.hint.${g.id}`)}</div>}
                <AnimatePresence>
                  {editing === g.id && (
                    <MeasureEditor
                      start={m?.fps ?? null}
                      settings={settingsText(res, preset)}
                      refresh={refresh}
                      onSave={(fps) => {
                        onMeasure(g.id, fps)
                        setEditing(null)
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })
        )}
        {cat === 'mine' && unknown.length > 0 && (
          <p className="px-2.5 pt-2 text-[11px] leading-relaxed text-muted">{t('stand.fps.unknown', { list: unknown.join(', ') })}</p>
        )}
        <p className="px-2.5 pt-3 text-[10px] leading-relaxed text-muted/70">
          {refresh > 0 && `${t('stand.fps.monitor', { hz: refresh })} `}
          {t('stand.fps.note')}
        </p>
      </div>
    </div>
  )
}
