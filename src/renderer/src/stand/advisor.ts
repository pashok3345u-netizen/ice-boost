// "What to buy for N ₽": tries every video card × processor × memory kit on top of the user's own PC,
// adds whatever else the swap forces (a board for a new socket or memory type, a cooler that can
// handle the CPU, a PSU with enough watts), drops anything that doesn't fit together or the budget,
// and ranks what's left by the FPS it gives in the user's games.
import { options, type Build, type Part, type Slot } from './catalog'
import { checkBuild, psuNeed, samePart, type BuyMode, type Issue } from './check'
import { estimate, GAMES, type Calibration, type Preset, type Res } from './games'

export interface PlanItem {
  slot: Slot
  part: Part
  /** what it replaces */
  old: Part
  price: number
  /** bought only because another part needs it (a board for a new CPU, a stronger PSU...) */
  forced: boolean
}

export interface Plan {
  build: Build
  items: PlanItem[]
  buy: number
  sell: number
  /** what the user pays: buy, minus selling the old parts if they want to */
  net: number
  /** average FPS change in the chosen games, 0.4 = +40% */
  gain: number
  /** works, but worth knowing (BIOS update, memory runs slower...) */
  warns: Issue[]
}

export interface AdviceOptions {
  budget: number
  mode: BuyMode
  sellOld: boolean
  res: Res
  preset: Preset
  cal: Calibration | null
  /** game ids that matter most (the user's installed games); empty = all games equally */
  focus: string[]
}

export interface Advice {
  /** most FPS within the budget */
  best: Plan | null
  /** most FPS per ruble, when it's a different plan */
  value: Plan | null
  /** a bit over the budget but clearly better */
  stretch: Plan | null
  /** nothing useful fits: the cheapest upgrade that gives a real boost */
  cheapest: Plan | null
}

/** below this an upgrade isn't worth the money or the hassle */
const MIN_GAIN = 0.1

/** Strict price: "new" means really sold new (no quiet fallback to Avito), "used" means Avito. */
function price(p: Part, mode: BuyMode): number | null {
  return p.price?.[mode] ?? null
}

function cheapest(list: Part[], mode: BuyMode): Part | undefined {
  return list.filter((p) => price(p, mode) != null).sort((a, b) => (price(a, mode) ?? 0) - (price(b, mode) ?? 0))[0]
}

/** the build with the parts forced by the main swap, or null when nothing makes it work */
function complete(mine: Build, gpu: Part, cpu: Part, ram: Part, mode: BuyMode): Build | null {
  let b: Build = { ...mine, gpu, cpu, ram }
  const board = b.mobo
  // the user's own processor and memory already work in the user's board, even if we don't know it
  const boardOk =
    (samePart(cpu, mine.cpu) && samePart(ram, mine.ram)) ||
    (board.socket === cpu.socket && (!board.ddr || board.ddr === ram.ddr) && (!board.ramSlots || board.ramSlots >= (ram.sticks ?? 2)))
  if (!boardOk) {
    const fit = cheapest(
      options('mobo').filter((m) => m.socket === cpu.socket && m.ddr === ram.ddr && (m.ramSlots ?? 4) >= (ram.sticks ?? 2)),
      mode
    )
    if (!fit) return null
    b = { ...b, mobo: fit }
  }
  const ids = (): Set<string> => new Set(checkBuild(b).map((i) => i.id))
  if (['coolerWeak', 'coolerTight', 'noBox'].some((id) => ids().has(id))) {
    const fit = cheapest(options('cooler').filter((c) => c.cooler === 'tower' && (c.cool ?? 0) >= (cpu.power ?? 0)), mode)
    if (!fit) return null
    b = { ...b, cooler: fit }
  }
  if (ids().has('psuLow') || ids().has('psuTight')) {
    const fit = cheapest(options('psu').filter((p) => (p.watt ?? 0) >= psuNeed(b)), mode)
    if (!fit) return null
    b = { ...b, psu: fit }
  }
  return checkBuild(b).some((i) => i.level === 'bad') ? null : b
}

const SLOTS_BOUGHT: Slot[] = ['gpu', 'cpu', 'ram', 'mobo', 'cooler', 'psu']

function plan(mine: Build, b: Build, o: AdviceOptions, gainOf: (b: Build) => number | null): Plan | null {
  const items: PlanItem[] = []
  for (const slot of SLOTS_BOUGHT) {
    const now = b[slot] as Part
    const old = mine[slot] as Part
    if (samePart(now, old)) continue
    const cost = price(now, o.mode)
    if (cost == null) return null
    // memory bought only because the new board takes another type counts as forced too
    const forced = !['gpu', 'cpu', 'ram'].includes(slot) || (slot === 'ram' && now.ddr !== old.ddr)
    items.push({ slot, part: now, old, price: cost, forced })
  }
  if (!items.length) return null
  const buy = items.reduce((s, i) => s + i.price, 0)
  const sell = o.sellOld ? items.reduce((s, i) => s + (i.old.price?.used ?? 0), 0) : 0
  const gain = gainOf(b)
  if (gain == null) return null
  return { build: b, items, buy, sell, net: Math.max(0, buy - sell), gain, warns: checkBuild(b).filter((i) => i.level === 'warn') }
}

export function advise(mine: Build, o: AdviceOptions): Advice {
  // FPS of the user's PC now, per game, computed once
  const weightOf = (id: string): number => (o.focus.length ? (o.focus.includes(id) ? 3 : 1) : 1)
  const base = new Map(GAMES.map((g) => [g.id, estimate(mine, g, o.res, o.preset, o.cal)?.fps ?? null]))
  const gainOf = (b: Build): number | null => {
    let sum = 0
    let w = 0
    for (const g of GAMES) {
      const was = base.get(g.id)
      const now = estimate(b, g, o.res, o.preset, o.cal)?.fps
      if (!was || !now) return null
      sum += weightOf(g.id) * Math.log(now / was)
      w += weightOf(g.id)
    }
    return Math.exp(sum / w) - 1
  }

  // Only real upgrades: never sell a part to buy a weaker or identical one to free money for another
  // (a test run once "sold" 16 GB to buy 8 GB in one stick, and swapped identical memory for 500 ₽).
  const onSale = (p: Part): boolean => price(p, o.mode) != null
  const faster = (p: Part, now: Part): boolean => !!p.perf && (!now.perf || p.perf >= now.perf * 1.1)
  const gpus = [mine.gpu, ...options('gpu').filter((p) => onSale(p) && faster(p, mine.gpu))]
  const cpus = [mine.cpu, ...options('cpu').filter((p) => onSale(p) && faster(p, mine.cpu))]
  const gb = mine.ram.gb ?? 0
  const rams = [
    mine.ram,
    ...options('ram').filter(
      (p) =>
        onSale(p) &&
        ((p.gb ?? 0) > gb || // more memory
          ((p.gb ?? 0) >= gb && p.ddr !== mine.ram.ddr) || // same size, the type a new board needs
          ((mine.ram.sticks ?? 2) === 1 && (p.sticks ?? 2) >= 2 && (p.gb ?? 0) >= gb)) // out of single channel
    )
  ]

  const all: Plan[] = []
  for (const gpu of gpus) {
    for (const cpu of cpus) {
      for (const ram of rams) {
        const b = complete(mine, gpu, cpu, ram, o.mode)
        const pl = b && plan(mine, b, o, gainOf)
        if (pl && pl.gain >= MIN_GAIN) all.push(pl)
      }
    }
  }

  // close gains count as equal: then the cheaper plan with fewer parts wins
  const better = (a: Plan, b: Plan): boolean =>
    Math.abs(a.gain - b.gain) > 0.02 ? a.gain > b.gain : a.net !== b.net ? a.net < b.net : a.items.length < b.items.length

  const fits = all.filter((p) => p.net <= o.budget)
  const best = fits.reduce<Plan | null>((acc, p) => (!acc || better(p, acc) ? p : acc), null)
  const perRuble = (p: Plan): number => p.gain / Math.max(1000, p.net)
  const value = fits
    .filter((p) => p !== best && best && p.net < best.net * 0.8 && p.gain >= best.gain * 0.6)
    .reduce<Plan | null>((acc, p) => (!acc || perRuble(p) > perRuble(acc) ? p : acc), null)
  const stretch = all
    .filter((p) => p.net > o.budget && p.net <= o.budget * 1.35 && p.gain >= (best?.gain ?? 0) + 0.15)
    .reduce<Plan | null>((acc, p) => (!acc || better(p, acc) ? p : acc), null)
  const cheapestPlan = best ? null : all.reduce<Plan | null>((acc, p) => (!acc || p.net < acc.net ? p : acc), null)
  return { best, value, stretch, cheapest: cheapestPlan }
}
