import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft, Boxes, CircleCheck, Gauge, List, CircuitBoard, Cpu, Fan, Gpu as GpuIcon, HardDrive, MemoryStick, MousePointerClick, OctagonAlert,
  PcCase, Plug, RotateCcw, TriangleAlert, Undo2
} from 'lucide-react'
import { useStore } from '../store'
import { Badge, Button, Checkbox, CountUp, PageHeader, Spinner, cx } from '../ui'
import { buildFromSystem, options, SLOTS, type Build, type Part, type Slot } from '../stand/catalog'
import {
  buyPrice, checkBuild, partAt, picks, resale, samePart, upgradeCost, withPart, type BuyMode, type Issue
} from '../stand/check'
import { PcScene, samePick, type Pick } from '../stand/Scene'
import { FpsPanel } from '../stand/FpsPanel'
import { calibrationFor, gain, loadMeasures, pcKey, resFromScreen, saveMeasures, type Calibration, type Measure, type Preset, type Res } from '../stand/games'

const ICON: Record<Slot, ReactNode> = {
  cpu: <Cpu className="size-[18px]" />,
  cooler: <Fan className="size-[18px]" />,
  gpu: <GpuIcon className="size-[18px]" />,
  ram: <MemoryStick className="size-[18px]" />,
  mobo: <CircuitBoard className="size-[18px]" />,
  storage: <HardDrive className="size-[18px]" />,
  psu: <Plug className="size-[18px]" />,
  case: <PcCase className="size-[18px]" />
}

function size(gb: number, t: TFunction): string {
  return gb >= 1000 ? t('stand.tb', { v: +(gb / 1000).toFixed(1) }) : t('stand.gb', { v: gb })
}

export function rub(v: number, lang: string): string {
  return `${Math.round(v).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US')} ₽`
}

export function partName(p: Part, t: TFunction): string {
  if (p.name) return p.name
  switch (p.slot) {
    case 'cooler':
      return t('stand.name.box')
    case 'ram':
      return t('stand.name.ram', { ddr: p.ddr ?? 4, gb: p.gb ?? 0 })
    case 'psu':
      return t('stand.name.psu', { w: p.watt ?? 0 })
    case 'storage':
      return t(`stand.name.${p.disk ?? 'sata'}`, { size: size(p.gb ?? 0, t) })
    default:
      return '—'
  }
}

export function partSpec(p: Part, t: TFunction): string {
  const bits: string[] = []
  switch (p.slot) {
    case 'cpu':
      if (p.cores) bits.push(t('stand.spec.cores', { count: p.cores }), t('stand.spec.threads', { count: p.threads ?? p.cores }))
      if (p.ghz) bits.push(t('stand.spec.ghz', { v: p.ghz }))
      if (p.socket) bits.push(p.socket)
      break
    case 'gpu':
      if (p.vram) bits.push(t('stand.spec.vram', { v: p.vram }))
      bits.push(t('stand.spec.fans', { count: p.fans ?? 2 }))
      break
    case 'ram':
      bits.push(t('stand.spec.sticks', { n: p.sticks ?? 2, per: Math.round((p.gb ?? 0) / (p.sticks || 1)), ddr: p.ddr ?? 4 }))
      if (p.mhz) bits.push(t('stand.spec.mhz', { v: p.mhz }))
      break
    case 'cooler':
      bits.push(t(`stand.spec.${p.cooler ?? 'tower'}`))
      if (p.cool) bits.push(t('stand.spec.cool', { v: p.cool }))
      break
    case 'mobo':
      if (p.chipset) bits.push(t('stand.spec.chipset', { v: p.chipset }))
      if (p.socket) bits.push(t('stand.spec.socket', { v: p.socket }))
      if (p.ddr) bits.push(`DDR${p.ddr}`)
      break
    case 'storage':
      bits.push(t(`stand.kind.${p.disk ?? 'sata'}`))
      if (p.name) bits.push(size(p.gb ?? 0, t))
      break
    case 'psu':
      if (p.name) bits.push(t('stand.spec.watt', { v: p.watt }))
      break
    case 'case':
      bits.push(t('stand.spec.case'))
      break
  }
  return bits.join(' · ')
}

// the edited build and the money settings stay while you visit other pages
let draftKeep: Build | null = null
let modeKeep: BuyMode = 'new'
let sellKeep = true
let tabKeep: 'parts' | 'fps' = 'parts'
let resKeep: Res | null = null
let presetKeep: Preset = 'high'

function IssueLine({ issue, onClick }: { issue: Issue; onClick?: () => void }): ReactNode {
  const { t } = useTranslation()
  const bad = issue.level === 'bad'
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cx(
        'flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left text-xs leading-relaxed transition-colors',
        bad ? 'border-bad/40 bg-bad/10 text-bad' : 'border-warn/40 bg-warn/10 text-warn',
        onClick && (bad ? 'hover:bg-bad/20' : 'hover:bg-warn/20')
      )}
    >
      {bad ? <OctagonAlert className="mt-px size-3.5 shrink-0" /> : <TriangleAlert className="mt-px size-3.5 shrink-0" />}
      <span>{t(`stand.issue.${issue.id}`, issue.vars)}</span>
    </button>
  )
}

export function Stand(): ReactNode {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { sys, gpu } = useStore()
  const mine = useMemo(() => (sys ? buildFromSystem(sys) : null), [sys])
  const [draft, setDraftState] = useState<Build | null>(draftKeep)
  const [mode, setModeState] = useState<BuyMode>(modeKeep)
  const [sellOld, setSellState] = useState(sellKeep)
  const [tab, setTabState] = useState(tabKeep)
  const [resPick, setResState] = useState<Res | null>(resKeep)
  const [preset, setPresetState] = useState<Preset>(presetKeep)
  const [measures, setMeasures] = useState<Record<string, Measure>>(loadMeasures)
  const [pick, setPick] = useState<Pick | null>(null)
  const [hover, setHover] = useState<Pick | null>(null)
  const [exploded, setExploded] = useState(false)
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])

  const setDraft = (b: Build | null): void => {
    draftKeep = b
    setDraftState(b)
  }
  const setMode = (m: BuyMode): void => {
    modeKeep = m
    setModeState(m)
  }
  const setSell = (v: boolean): void => {
    sellKeep = v
    setSellState(v)
  }
  const setTab = (v: 'parts' | 'fps'): void => {
    tabKeep = v
    setTabState(v)
  }
  const setRes = (v: Res): void => {
    resKeep = v
    setResState(v)
  }
  const setPreset = (v: Preset): void => {
    presetKeep = v
    setPresetState(v)
  }
  // the screen's own resolution until the user picks another one
  const res = resPick ?? resFromScreen(sys?.resolution ?? '')
  const cal = useMemo(() => (mine ? calibrationFor(mine, measures) : null), [mine, measures])
  const measure = (game: string, fps: number | null): void => {
    if (!mine) return
    const next = { ...measures }
    if (fps == null) delete next[game]
    else next[game] = { fps, res, preset, pc: pcKey(mine) }
    saveMeasures(next)
    setMeasures(next)
  }

  const build = draft ?? mine
  const changed = !!draft && !!mine && picks(draft, SLOTS).some((p) => !samePart(partAt(draft, p), partAt(mine, p)))
  const issues = useMemo(() => (build ? checkBuild(build) : []), [build])
  const badSlots = useMemo(() => [...new Set(issues.filter((i) => i.level === 'bad').flatMap((i) => i.slots))], [issues])
  const cost = build && mine ? upgradeCost(build, mine, mode, sellOld) : null

  const choose = (p: Pick | null): void => {
    setPick(p)
    if (p) setExploded(false)
  }

  const rows: Pick[] = build ? picks(build, SLOTS) : []
  const hint = hover && build ? `${t(`stand.slot.${hover.slot}`)} · ${partName(partAt(build, hover), t)}` : t('stand.hint')

  return (
    <div className="flex h-[calc(100vh-96px)] flex-col">
      <PageHeader
        title={t('stand.title')}
        subtitle={t('stand.subtitle')}
        icon={<PcCase className="size-5" />}
        actions={
          <>
            {changed && (
              <Button icon={<RotateCcw className="size-4" />} onClick={() => setDraft(null)}>
                {t('stand.reset')}
              </Button>
            )}
            <Button
              variant={exploded ? 'soft' : 'primary'}
              icon={<Boxes className="size-4" />}
              onClick={() => {
                setExploded(!exploded)
                setPick(null)
              }}
              disabled={!ready}
            >
              {exploded ? t('stand.assemble') : t('stand.explode')}
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-line bg-[#1b1b21]">
          {build && (
            <PcScene
              build={build}
              pick={pick}
              hover={hover}
              exploded={exploded}
              bad={badSlots}
              gpuRpm={gpu?.now?.fanRpm ?? null}
              onHover={setHover}
              onPick={choose}
              onReady={onReady}
            />
          )}
          <AnimatePresence>
            {!ready && (
              <motion.div exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center bg-[#1b1b21] text-sm text-muted">
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="size-7" />
                  {t('stand.loading')}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* what doesn't fit together — click to open that part */}
          {ready && (issues.length > 0 || changed) && (
            <div className="absolute top-3 left-3 flex w-[min(360px,calc(100%-24px))] flex-col gap-1.5">
              {issues.length ? (
                issues.map((i) => (
                  <motion.div key={i.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                    <div className="backdrop-blur">
                      <IssueLine issue={i} onClick={() => choose({ slot: i.slots[0] })} />
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex w-fit items-center gap-2 rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-xs text-good backdrop-blur"
                >
                  <CircleCheck className="size-3.5" />
                  {t('stand.allOk')}
                </motion.div>
              )}
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <div className="flex items-center gap-2 rounded-full border border-line/80 bg-deep/80 px-4 py-1.5 text-xs text-muted backdrop-blur">
              <MousePointerClick className="size-3.5 text-ice" />
              <span className={cx(hover && 'text-frost')}>{hint}</span>
            </div>
          </div>
        </div>

        <aside className="card flex w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl border border-line">
          <AnimatePresence mode="wait" initial={false}>
            {build && pick ? (
              <Details
                key={`${pick.slot}${pick.index ?? ''}`}
                pick={pick}
                build={build}
                mine={mine}
                mode={mode}
                res={res}
                preset={preset}
                cal={cal}
                issues={issues.filter((i) => i.slots.includes(pick.slot))}
                onBack={() => setPick(null)}
                onReplace={(part) => setDraft(withPart(build, pick, part))}
              />
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="flex gap-1 px-4 pt-4 pb-3">
                  {(['parts', 'fps'] as const).map((x) => (
                    <button
                      key={x}
                      onClick={() => setTab(x)}
                      className={cx(
                        'relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors',
                        tab === x ? 'text-frost' : 'text-muted hover:text-text'
                      )}
                    >
                      {tab === x && (
                        <motion.span layoutId="stand-tab" className="absolute inset-0 rounded-lg border border-teal/50 bg-teal/20" />
                      )}
                      <span className="relative">{x === 'parts' ? <List className="size-3.5" /> : <Gauge className="size-3.5" />}</span>
                      <span className="relative">{t(`stand.tab.${x}`)}</span>
                    </button>
                  ))}
                </div>
                {tab === 'fps' && build ? (
                  <FpsPanel
                    build={build}
                    before={changed ? mine : null}
                    cal={cal}
                    res={res}
                    preset={preset}
                    refresh={sys?.refresh ?? 0}
                    onRes={setRes}
                    onPreset={setPreset}
                    onPick={(slot) => choose({ slot })}
                    onMeasure={measure}
                  />
                ) : (
                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                  {build ? (
                    rows.map((p) => {
                      const part = partAt(build, p)
                      const own = mine ? samePart(part, partAt(mine, p)) : true
                      const level = issues.find((i) => i.slots.includes(p.slot) && i.level === 'bad')
                        ? 'bad'
                        : issues.find((i) => i.slots.includes(p.slot))
                          ? 'warn'
                          : null
                      const price = own ? part.price?.used : buyPrice(part, mode)
                      return (
                        <button
                          key={`${p.slot}${p.index ?? ''}`}
                          onClick={() => choose(p)}
                          onMouseEnter={() => setHover(p)}
                          onMouseLeave={() => setHover(null)}
                          className={cx(
                            'group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/5',
                            samePick(hover, p) && 'bg-white/5'
                          )}
                        >
                          <span
                            className={cx(
                              'relative grid size-9 shrink-0 place-items-center rounded-lg',
                              level === 'bad' ? 'bg-bad/15 text-bad' : 'bg-teal/15 text-ice'
                            )}
                          >
                            {ICON[p.slot]}
                            {level && (
                              <span
                                className={cx('absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-panel', level === 'bad' ? 'bg-bad' : 'bg-warn')}
                              />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-[11px] text-muted">
                              {t(`stand.slot.${p.slot}`)}
                              {!own ? (
                                <Badge tone="ice">{t('stand.changed')}</Badge>
                              ) : part.guess ? (
                                <Badge tone="warn">{t('stand.guess')}</Badge>
                              ) : null}
                            </span>
                            <span className="block truncate text-sm font-medium">{partName(part, t)}</span>
                          </span>
                          {price != null && price > 0 && (
                            <span className={cx('shrink-0 text-xs tabular-nums', own ? 'text-muted' : 'text-ice')}>{rub(price, lang)}</span>
                          )}
                        </button>
                      )
                    })
                  ) : (
                    <div className="grid place-items-center py-10">
                      <Spinner />
                    </div>
                  )}
                </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* money: what the upgrade costs, or what the PC is worth now */}
          {build && cost && (
            <div className="border-t border-line/70 bg-deep/40 px-5 py-4">
              {changed ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium tracking-wide text-muted uppercase">{t('stand.cost.title')}</span>
                    <div className="flex rounded-lg border border-line bg-deep p-0.5 text-[11px]">
                      {(['new', 'used'] as BuyMode[]).map((m) => (
                        <button
                          key={m}
                          onClick={() => setMode(m)}
                          className={cx('rounded-md px-2 py-0.5 transition-colors', mode === m ? 'bg-teal/30 text-frost' : 'text-muted hover:text-text')}
                        >
                          {t(`stand.cost.${m}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted">{t('stand.cost.buy')}</span>
                      <span className="tabular-nums">{rub(cost.buy, lang)}</span>
                    </div>
                    <label className="flex cursor-pointer items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-muted">
                        <Checkbox checked={sellOld} onChange={setSell} />
                        {t('stand.cost.sell')}
                      </span>
                      <span className={cx('tabular-nums', sellOld ? 'text-good' : 'text-muted line-through')}>
                        −{rub(sellOld ? cost.sell : upgradeCost(build, mine!, mode, true).sell, lang)}
                      </span>
                    </label>
                  </div>
                  <div className="mt-3 flex items-end justify-between border-t border-line/60 pt-3">
                    <span className="text-sm text-muted">{t('stand.cost.total')}</span>
                    <span className="font-display text-xl font-semibold text-frost tabular-nums">
                      <CountUp value={Math.max(0, cost.total)} format={(v) => rub(v, lang)} duration={500} />
                    </span>
                  </div>
                  {cost.unknown > 0 && <div className="mt-1 text-[11px] text-warn">{t('stand.cost.unknown', { count: cost.unknown })}</div>}
                </>
              ) : (
                <>
                  <div className="flex items-end justify-between">
                    <span className="text-xs font-medium tracking-wide text-muted uppercase">{t('stand.cost.resale')}</span>
                    <span className="font-display text-lg font-semibold text-frost tabular-nums">~{rub(resale(build), lang)}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{t('stand.cost.pickHint')}</p>
                </>
              )}
              <p className="mt-2 text-[10px] text-muted/70">{t('stand.cost.note')}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function Details({
  pick, build, mine, mode, res, preset, cal, issues, onBack, onReplace
}: {
  pick: Pick
  build: Build
  mine: Build | null
  mode: BuyMode
  res: Res
  preset: Preset
  cal: Calibration | null
  issues: Issue[]
  onBack: () => void
  onReplace: (p: Part) => void
}): ReactNode {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const part = partAt(build, pick)
  const original = mine ? partAt(mine, pick) : undefined
  const own = original ? samePart(part, original) : true

  // every option with its price and what would break if you took it
  const list = useMemo(() => {
    const before = new Set(checkBuild(build).map((i) => i.id))
    return options(pick.slot)
      .filter((o) => !samePart(o, part) && !(part.mine && part.name && o.match?.test(part.name)))
      .map((o) => {
        const next = withPart(build, pick, o)
        const fresh = checkBuild(next).filter((i) => i.slots.includes(pick.slot) && !before.has(i.id))
        const worst = fresh.find((i) => i.level === 'bad') ?? fresh[0]
        // how much FPS this swap gives on average (only parts that change FPS)
        const fps = ['gpu', 'cpu', 'ram'].includes(pick.slot) ? gain(build, next, res, preset, cal) : null
        return { o, price: buyPrice(o, mode), worst, fps }
      })
      .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
  }, [build, pick, part, mode, res, preset, cal])

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.18 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="border-b border-line/70 p-5">
        <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-frost">
          <ArrowLeft className="size-3.5" />
          {t('stand.back')}
        </button>
        <div className="flex items-center gap-2 text-xs text-ice">
          {ICON[pick.slot]}
          {t(`stand.slot.${pick.slot}`)}
        </div>
        <div className="font-display mt-2 text-lg leading-snug font-semibold">{partName(part, t)}</div>
        <div className="mt-1 text-sm text-muted">{partSpec(part, t)}</div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {own ? <Badge tone="good">{t('stand.mine')}</Badge> : <Badge tone="ice">{t('stand.changed')}</Badge>}
          {own && part.guess && <Badge tone="warn">{t('stand.guess')}</Badge>}
        </div>
        <div className="mt-3 text-xs text-muted">
          {own ? (
            (part.price?.used ?? 0) > 0 && t('stand.cost.sellFor', { v: rub(part.price!.used!, lang) })
          ) : part.price ? (
            <span className="flex flex-wrap gap-x-3">
              <span>
                {t('stand.cost.newPrice')}: {part.price.new != null ? rub(part.price.new, lang) : t('stand.cost.onlyUsed')}
              </span>
              {part.price.used != null && (
                <span>
                  {t('stand.cost.usedPrice')}: {rub(part.price.used, lang)}
                </span>
              )}
            </span>
          ) : (
            t('stand.cost.noPrice')
          )}
        </div>
        {own && part.guess && <p className="mt-3 text-xs leading-relaxed text-muted">{t('stand.guessNote')}</p>}
        {issues.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {issues.map((i) => (
              <IssueLine key={i.id} issue={i} />
            ))}
          </div>
        )}
        {!own && original && (
          <Button size="sm" className="mt-4" icon={<Undo2 className="size-3.5" />} onClick={() => onReplace(original)}>
            {t('stand.backMine', { name: partName(original, t) })}
          </Button>
        )}
      </div>
      <div className="px-5 pt-4 pb-2 text-xs font-medium tracking-wide text-muted uppercase">{t('stand.swap')}</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {list.length ? (
          list.map(({ o, price, worst, fps }) => (
            <button
              key={o.id}
              onClick={() => onReplace(o)}
              className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/5"
            >
              <span className="min-w-0 flex-1">
                <span className={cx('block truncate text-sm font-medium', worst?.level === 'bad' && 'text-muted')}>{partName(o, t)}</span>
                <span className="block truncate text-[11px] text-muted">{partSpec(o, t)}</span>
                {fps != null && Math.abs(fps) >= 0.03 && (
                  <span className={cx('mt-0.5 block text-[11px] font-medium', fps > 0 ? 'text-good' : 'text-bad')}>
                    {t('stand.fps.gain', { v: `${fps > 0 ? '+' : ''}${Math.round(fps * 100)}` })}
                  </span>
                )}
                {worst && (
                  <span className={cx('mt-0.5 flex items-center gap-1 text-[11px]', worst.level === 'bad' ? 'text-bad' : 'text-warn')}>
                    {worst.level === 'bad' ? <OctagonAlert className="size-3" /> : <TriangleAlert className="size-3" />}
                    {t(`stand.tag.${worst.id}`)}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right text-xs tabular-nums">
                {price == null ? (
                  <span className="text-muted">—</span>
                ) : (
                  <>
                    <span className="block text-frost">{price === 0 ? t('stand.cost.free') : rub(price, lang)}</span>
                    {mode === 'new' && o.price?.new == null && <span className="block text-[10px] text-muted">{t('stand.cost.usedShort')}</span>}
                  </>
                )}
              </span>
            </button>
          ))
        ) : (
          <p className="px-2.5 text-xs text-muted">{t('stand.caseNote')}</p>
        )}
      </div>
    </motion.div>
  )
}
