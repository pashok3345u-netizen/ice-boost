// Does the build work together, how much power it needs, and what the upgrade costs.
import type { Build, Part, Slot } from './catalog'
import type { Pick } from './Scene'

export type IssueId = 'socket' | 'ddr' | 'slots' | 'psuLow' | 'psuTight' | 'coolerWeak' | 'coolerTight' | 'noBox' | 'ramSlow' | 'bios'

export interface Issue {
  id: IssueId
  /** bad = won't work, warn = works but not great */
  level: 'bad' | 'warn'
  /** parts involved; the first one is usually the one to change */
  slots: Slot[]
  vars: Record<string, string | number>
}

/** W the whole PC draws in games: CPU + video card + board, memory, drives, fans */
export function powerDraw(b: Build): number {
  return (b.cpu.power ?? 100) + (b.gpu.power ?? 200) + 50
}

/** a PSU with ~30% room over the draw, rounded up to 50 W */
export function psuNeed(b: Build): number {
  return Math.ceil((powerDraw(b) * 1.3) / 50) * 50
}

export function checkBuild(b: Build): Issue[] {
  const out: Issue[] = []
  const add = (id: IssueId, level: Issue['level'], slots: Slot[], vars: Issue['vars'] = {}): void => {
    out.push({ id, level, slots, vars })
  }

  if (b.cpu.socket && b.mobo.socket && b.cpu.socket !== b.mobo.socket) {
    add('socket', 'bad', ['mobo', 'cpu'], { cpu: b.cpu.socket, board: b.mobo.socket })
  }
  const ddrOk = !b.mobo.ddr || !b.ram.ddr || b.mobo.ddr === b.ram.ddr
  if (!ddrOk) add('ddr', 'bad', ['ram', 'mobo'], { board: b.mobo.ddr ?? 0, ram: b.ram.ddr ?? 0 })
  if (b.mobo.ramSlots && (b.ram.sticks ?? 0) > b.mobo.ramSlots) {
    add('slots', 'bad', ['ram', 'mobo'], { slots: b.mobo.ramSlots, sticks: b.ram.sticks ?? 0 })
  }
  const limit = Math.min(b.cpu.ramMax ?? Infinity, b.mobo.ramMax ?? Infinity)
  if (ddrOk && b.ram.mhz && limit < b.ram.mhz) add('ramSlow', 'warn', ['ram'], { mhz: limit, have: b.ram.mhz })
  // 13th/14th gen Intel on early 600-series boards needs a newer BIOS
  if (b.mobo.chipset === 'B660' && /i[3579]-1[34]\d{3}/i.test(b.cpu.name ?? '')) add('bios', 'warn', ['mobo'])

  const draw = powerDraw(b)
  const watt = b.psu.watt ?? 0
  if (watt && watt < draw * 1.05) add('psuLow', 'bad', ['psu'], { need: psuNeed(b), have: watt })
  else if (watt && watt < draw * 1.3) add('psuTight', 'warn', ['psu'], { need: psuNeed(b), have: watt })

  // the cooler from the CPU's own box is made for it; anything else has to handle the CPU's heat
  const heat = b.cpu.power ?? 0
  const cool = b.cooler.cool ?? 0
  const ownBox = b.cooler.cooler === 'box' && b.cpu.box !== false
  if (!ownBox && heat && cool && heat > cool * 1.15) add('coolerWeak', 'bad', ['cooler', 'cpu'], { cpu: heat, cooler: cool })
  else if (!ownBox && heat && cool && heat > cool) add('coolerTight', 'warn', ['cooler', 'cpu'], { cpu: heat, cooler: cool })
  else if (b.cooler.cooler === 'box' && b.cpu.box === false && !b.cpu.mine) add('noBox', 'warn', ['cooler', 'cpu'])

  return out
}

export function partAt(b: Build, p: Pick): Part {
  return p.slot === 'storage' ? b.storage[p.index ?? 0] : b[p.slot]
}

export function withPart(b: Build, p: Pick, part: Part): Build {
  if (p.slot !== 'storage') return { ...b, [p.slot]: part }
  const storage = [...b.storage]
  storage[p.index ?? 0] = { ...part, id: `${part.id}#${p.index ?? 0}` }
  return { ...b, storage }
}

/** every place in the build: one per slot, one per drive */
export function picks(b: Build, slots: Slot[]): Pick[] {
  return slots.flatMap((slot): Pick[] => (slot === 'storage' ? b.storage.map((_, index) => ({ slot, index })) : [{ slot }]))
}

// ---- money

export type BuyMode = 'new' | 'used'

/** what the part costs to buy; parts no longer sold new fall back to the used price */
export function buyPrice(part: Part, mode: BuyMode): number | null {
  const pr = part.price
  if (!pr) return null
  return mode === 'new' ? (pr.new ?? pr.used ?? null) : (pr.used ?? pr.new ?? null)
}

export function samePart(a: Part, b: Part): boolean {
  return a.id.split('#')[0] === b.id.split('#')[0]
}

export interface Cost {
  buy: number
  sell: number
  total: number
  /** changed parts without a price */
  unknown: number
  changed: number
}

/** buy the new parts, sell the ones they replace (on Avito) */
export function upgradeCost(b: Build, mine: Build, mode: BuyMode, sellOld: boolean): Cost {
  const c: Cost = { buy: 0, sell: 0, total: 0, unknown: 0, changed: 0 }
  for (const p of picks(b, ['cpu', 'cooler', 'gpu', 'ram', 'mobo', 'storage', 'psu', 'case'])) {
    const now = partAt(b, p)
    const old = p.slot === 'storage' ? mine.storage[p.index ?? 0] : mine[p.slot]
    if (!old || samePart(now, old)) continue
    c.changed++
    const price = buyPrice(now, mode)
    if (price == null) c.unknown++
    else c.buy += price
    if (sellOld) c.sell += old.price?.used ?? 0
  }
  c.total = c.buy - c.sell
  return c
}

/** what the PC would fetch on Avito, sold part by part */
export function resale(b: Build): number {
  return picks(b, ['cpu', 'cooler', 'gpu', 'ram', 'mobo', 'storage', 'psu', 'case']).reduce((s, p) => s + (partAt(b, p).price?.used ?? 0), 0)
}
