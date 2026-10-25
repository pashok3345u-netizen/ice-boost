import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft, Boxes, ChevronRight, CircuitBoard, Cpu, Fan, Gpu as GpuIcon, HardDrive, MemoryStick, MousePointerClick, PcCase, Plug,
  RotateCcw, Undo2
} from 'lucide-react'
import { useStore } from '../store'
import { Badge, Button, PageHeader, Spinner, cx } from '../ui'
import { buildFromSystem, options, SLOTS, type Build, type Part, type Slot } from '../stand/catalog'
import { PcScene, samePick, type Pick } from '../stand/Scene'

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
      break
    case 'mobo':
      if (p.chipset) bits.push(t('stand.spec.chipset', { v: p.chipset }))
      if (p.socket) bits.push(t('stand.spec.socket', { v: p.socket }))
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

function partAt(b: Build, p: Pick): Part {
  return p.slot === 'storage' ? b.storage[p.index ?? 0] : b[p.slot]
}

// the edited build stays while you visit other pages
let draftKeep: Build | null = null

export function Stand(): ReactNode {
  const { t } = useTranslation()
  const { sys, gpu } = useStore()
  const mine = useMemo(() => (sys ? buildFromSystem(sys) : null), [sys])
  const [draft, setDraftState] = useState<Build | null>(draftKeep)
  const [pick, setPick] = useState<Pick | null>(null)
  const [hover, setHover] = useState<Pick | null>(null)
  const [exploded, setExploded] = useState(false)
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])

  const setDraft = (b: Build | null): void => {
    draftKeep = b
    setDraftState(b)
  }
  const build = draft ?? mine
  const changed = !!draft && [draft.cpu, draft.cooler, draft.gpu, draft.ram, draft.mobo, draft.psu, draft.case, ...draft.storage].some((p) => !p.mine)

  const choose = (p: Pick | null): void => {
    setPick(p)
    if (p) setExploded(false)
  }

  const replace = (p: Pick, part: Part): void => {
    if (!build) return
    if (p.slot === 'storage') {
      const storage = [...build.storage]
      storage[p.index ?? 0] = { ...part, id: `${part.id}#${p.index ?? 0}` }
      setDraft({ ...build, storage })
    } else {
      setDraft({ ...build, [p.slot]: part })
    }
  }

  const rows: Pick[] = build
    ? SLOTS.flatMap((slot): Pick[] => (slot === 'storage' ? build.storage.map((_, index) => ({ slot, index })) : [{ slot }]))
    : []

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
              gpuRpm={gpu?.now?.fanRpm ?? null}
              onHover={setHover}
              onPick={choose}
              onReady={onReady}
            />
          )}
          <AnimatePresence>
            {!ready && (
              <motion.div
                exit={{ opacity: 0 }}
                className="absolute inset-0 grid place-items-center bg-[#1b1b21] text-sm text-muted"
              >
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="size-7" />
                  {t('stand.loading')}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
                onBack={() => setPick(null)}
                onReplace={(part) => replace(pick, part)}
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
                <div className="px-5 pt-5 pb-2 text-xs font-medium tracking-wide text-muted uppercase">{t('stand.parts')}</div>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                  {build ? (
                    rows.map((p) => {
                      const part = partAt(build, p)
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
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal/15 text-ice">{ICON[p.slot]}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[11px] text-muted">{t(`stand.slot.${p.slot}`)}</span>
                            <span className="block truncate text-sm font-medium">{partName(part, t)}</span>
                          </span>
                          {!part.mine ? (
                            <Badge tone="ice">{t('stand.changed')}</Badge>
                          ) : part.guess ? (
                            <Badge tone="warn">{t('stand.guess')}</Badge>
                          ) : null}
                          <ChevronRight className="size-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      )
                    })
                  ) : (
                    <div className="grid place-items-center py-10">
                      <Spinner />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </div>
    </div>
  )
}

function Details({
  pick, build, mine, onBack, onReplace
}: {
  pick: Pick
  build: Build
  mine: Build | null
  onBack: () => void
  onReplace: (p: Part) => void
}): ReactNode {
  const { t } = useTranslation()
  const part = partAt(build, pick)
  const original = mine ? partAt(mine, pick) : undefined
  const list = options(pick.slot).filter(
    (o) => o.id !== part.id.split('#')[0] && !(part.mine && part.name && o.match?.test(part.name))
  )

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
        <div className="mt-3 flex flex-wrap gap-1.5">
          {part.mine ? <Badge tone="good">{t('stand.mine')}</Badge> : <Badge tone="ice">{t('stand.changed')}</Badge>}
          {part.mine && part.guess && <Badge tone="warn">{t('stand.guess')}</Badge>}
        </div>
        {part.mine && part.guess && <p className="mt-3 text-xs leading-relaxed text-muted">{t('stand.guessNote')}</p>}
        {!part.mine && original && (
          <Button size="sm" className="mt-4" icon={<Undo2 className="size-3.5" />} onClick={() => onReplace(original)}>
            {t('stand.backMine', { name: partName(original, t) })}
          </Button>
        )}
      </div>
      <div className="px-5 pt-4 pb-2 text-xs font-medium tracking-wide text-muted uppercase">{t('stand.swap')}</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {list.length ? (
          list.map((o) => (
            <button
              key={o.id}
              onClick={() => onReplace(o)}
              className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{partName(o, t)}</span>
                <span className="block truncate text-[11px] text-muted">{partSpec(o, t)}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ice" />
            </button>
          ))
        ) : (
          <p className="px-2.5 text-xs text-muted">{t('stand.caseNote')}</p>
        )}
      </div>
    </motion.div>
  )
}
