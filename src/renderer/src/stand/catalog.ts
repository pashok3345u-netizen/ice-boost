// Parts the Stand knows: specs, which 3D shape to show, power and prices.
// Prices are approximate, rubles, October 2026: new = Russian shops (3DNews "Компьютер месяца",
// iXBT GPU chart), used = Avito. Memory is in a shortage, so RAM is unusually expensive.
import type { SystemInfo } from '../../../shared/types'

export type Slot = 'cpu' | 'cooler' | 'gpu' | 'ram' | 'mobo' | 'storage' | 'psu' | 'case'
export const SLOTS: Slot[] = ['gpu', 'cpu', 'ram', 'cooler', 'mobo', 'storage', 'psu', 'case']

export type DiskKind = 'm2' | 'sata' | 'hdd'

export const PRICES_DATE = '2026-10'

export interface Price {
  /** in a shop; missing = not sold new any more */
  new?: number
  /** on Avito */
  used?: number
}

export interface Part {
  id: string
  slot: Slot
  /** empty = the name is made from the specs (generic parts like "SSD 1 TB") */
  name?: string
  /** tells the detected Windows name apart from the catalog one */
  match?: RegExp
  price?: Price
  cores?: number
  threads?: number
  ghz?: number
  socket?: string
  /** gaming speed: video cards vs RTX 4060 = 100 (1080p), processors vs Core i5-10400F = 100 */
  perf?: number
  /** W the part draws under load (CPU: what the cooler has to take away too) */
  power?: number
  /** CPU comes with a cooler in the box */
  box?: boolean
  /** fastest memory the CPU or board runs, MHz */
  ramMax?: number
  vram?: number
  fans?: 1 | 2 | 3
  gb?: number
  sticks?: number
  ddr?: 4 | 5
  mhz?: number
  disk?: DiskKind
  cooler?: 'box' | 'tower'
  /** W of heat the cooler can handle */
  cool?: number
  watt?: number
  chipset?: string
  /** memory slots on the board */
  ramSlots?: number
  /** this part is in the user's PC (found by IceBoost) */
  mine?: boolean
  /** Windows can't see this part, so IceBoost guessed it */
  guess?: boolean
}

export interface Build {
  cpu: Part
  cooler: Part
  gpu: Part
  ram: Part
  mobo: Part
  storage: Part[]
  psu: Part
  case: Part
}

const p = (n: number | null, u: number): Price => (n == null ? { used: u } : { new: n, used: u })

const cpu = (
  id: string, name: string, match: RegExp, cores: number, threads: number, ghz: number, socket: string,
  power: number, box: boolean, price: Price, ramMax?: number
): Part => ({ id, slot: 'cpu', name, match, cores, threads, ghz, socket, power, box, price, ramMax })

const gpu = (id: string, name: string, match: RegExp, vram: number, fans: 1 | 2 | 3, power: number, price: Price): Part => ({
  id, slot: 'gpu', name, match, vram, fans, power, price
})

const ram = (gb: number, sticks: number, ddr: 4 | 5, mhz: number, price: Price): Part => ({
  id: `ram-${ddr}-${gb}-${sticks}-${mhz}`, slot: 'ram', gb, sticks, ddr, mhz, price
})

const disk = (kind: DiskKind, gb: number, price: Price): Part => ({ id: `disk-${kind}-${gb}`, slot: 'storage', disk: kind, gb, price })

const psu = (watt: number, price: Price): Part => ({ id: `psu-${watt}`, slot: 'psu', watt, price })

const board = (chipset: string, socket: string, ddr: 4 | 5, ramSlots: number, price: Price, ramMax?: number): Part => ({
  id: `mobo-${chipset}`, slot: 'mobo', name: chipset, chipset, socket, ddr, ramSlots, price, ramMax
})

export const CATALOG: Part[] = [
  cpu('i3-10105f', 'Intel Core i3-10105F', /i3-10105f?\b/i, 4, 8, 3.7, 'LGA1200', 90, true, p(6000, 3500), 2666),
  cpu('i5-9400f', 'Intel Core i5-9400F', /i5-9400f?\b/i, 6, 6, 2.9, 'LGA1151', 75, true, p(null, 3500), 2666),
  cpu('i5-10400f', 'Intel Core i5-10400F', /i5-10400f?\b/i, 6, 12, 2.9, 'LGA1200', 120, true, p(8000, 5000), 2666),
  cpu('i5-12400f', 'Intel Core i5-12400F', /i5-12400f?\b/i, 6, 12, 2.5, 'LGA1700', 117, true, p(13000, 9000)),
  cpu('i5-13400f', 'Intel Core i5-13400F', /i5-13400f?\b/i, 10, 16, 2.5, 'LGA1700', 148, true, p(15000, 11000)),
  cpu('i5-14600kf', 'Intel Core i5-14600KF', /i5-14600kf?\b/i, 14, 20, 3.5, 'LGA1700', 181, false, p(22000, 17000)),
  cpu('i7-14700kf', 'Intel Core i7-14700KF', /i7-14700kf?\b/i, 20, 28, 3.4, 'LGA1700', 253, false, p(32000, 25000)),
  cpu('r5-3600', 'AMD Ryzen 5 3600', /ryzen 5 3600\b/i, 6, 12, 3.6, 'AM4', 88, true, p(null, 5000)),
  cpu('r5-5600', 'AMD Ryzen 5 5600', /ryzen 5 5600\b/i, 6, 12, 3.5, 'AM4', 76, true, p(11500, 8000)),
  cpu('r7-5700x3d', 'AMD Ryzen 7 5700X3D', /ryzen 7 5700x3d\b/i, 8, 16, 3.0, 'AM4', 142, false, p(22000, 17000)),
  cpu('r5-7500f', 'AMD Ryzen 5 7500F', /ryzen 5 7500f\b/i, 6, 12, 3.7, 'AM5', 88, false, p(14000, 11000)),
  cpu('r7-7800x3d', 'AMD Ryzen 7 7800X3D', /ryzen 7 7800x3d\b/i, 8, 16, 4.2, 'AM5', 162, false, p(29500, 24000)),
  cpu('r7-9800x3d', 'AMD Ryzen 7 9800X3D', /ryzen 7 9800x3d\b/i, 8, 16, 4.7, 'AM5', 162, false, p(45000, 38000)),

  gpu('gtx1650', 'GeForce GTX 1650', /gtx ?1650\b(?! super)/i, 4, 1, 75, p(15000, 7000)),
  gpu('gtx1660s', 'GeForce GTX 1660 Super', /gtx ?1660 super/i, 6, 2, 125, p(null, 9500)),
  gpu('rtx3050', 'GeForce RTX 3050', /rtx ?3050\b/i, 8, 2, 130, p(25000, 14500)),
  gpu('rtx3060', 'GeForce RTX 3060', /rtx ?3060\b(?! ti)/i, 12, 2, 170, p(32000, 19000)),
  gpu('rtx4060', 'GeForce RTX 4060', /rtx ?4060\b(?! ti)/i, 8, 2, 115, p(32000, 24000)),
  gpu('rtx4060ti', 'GeForce RTX 4060 Ti', /rtx ?4060 ?ti/i, 8, 2, 160, p(42000, 30000)),
  gpu('rtx5060', 'GeForce RTX 5060', /rtx ?5060\b(?! ti)/i, 8, 2, 145, p(48000, 36000)),
  gpu('rtx4070s', 'GeForce RTX 4070 Super', /rtx ?4070 super/i, 12, 3, 220, p(75000, 55000)),
  gpu('rtx5070', 'GeForce RTX 5070', /rtx ?5070\b(?! ti)/i, 12, 3, 250, p(88000, 65000)),
  gpu('rtx5070ti', 'GeForce RTX 5070 Ti', /rtx ?5070 ?ti/i, 16, 3, 300, p(133000, 100000)),
  gpu('rx580', 'Radeon RX 580', /rx ?580\b/i, 8, 2, 185, p(null, 5000)),
  gpu('rx590', 'Radeon RX 590', /rx ?590\b/i, 8, 2, 225, p(null, 6000)),
  gpu('rx6600', 'Radeon RX 6600', /rx ?6600\b(?! xt)/i, 8, 2, 132, p(28000, 13000)),
  gpu('rx7600', 'Radeon RX 7600', /rx ?7600\b(?! xt)/i, 8, 2, 165, p(33000, 22000)),
  gpu('rx9060xt', 'Radeon RX 9060 XT', /rx ?9060 ?xt/i, 16, 2, 160, p(65000, 50000)),
  gpu('rx7800xt', 'Radeon RX 7800 XT', /rx ?7800 ?xt/i, 16, 3, 263, p(70000, 50000)),
  gpu('rx9070xt', 'Radeon RX 9070 XT', /rx ?9070 ?xt/i, 16, 3, 304, p(98000, 75000)),
  gpu('arc-b580', 'Intel Arc B580', /arc.*b580/i, 12, 2, 190, p(50000, 32000)),

  ram(8, 1, 4, 2666, p(5500, 3000)),
  ram(16, 2, 4, 2666, p(9500, 6000)),
  ram(16, 2, 4, 3200, p(10500, 6500)),
  ram(32, 2, 4, 3200, p(20000, 13000)),
  ram(32, 2, 4, 3600, p(21500, 14000)),
  ram(64, 4, 4, 3200, p(40000, 26000)),
  ram(32, 2, 5, 6000, p(50000, 38000)),
  ram(64, 2, 5, 6000, p(98000, 75000)),

  { id: 'cooler-box', slot: 'cooler', cooler: 'box', cool: 80, price: { new: 0, used: 0 } },
  { id: 'se224', slot: 'cooler', name: 'ID-Cooling SE-224-XTS', cooler: 'tower', cool: 200, price: p(2000, 1200) },
  { id: 'ak400', slot: 'cooler', name: 'DeepCool AK400', cooler: 'tower', cool: 220, price: p(3000, 1800) },
  { id: 'pa120', slot: 'cooler', name: 'Thermalright Peerless Assassin 120', cooler: 'tower', cool: 245, price: p(4000, 2500) },
  { id: 'ak620', slot: 'cooler', name: 'DeepCool AK620', cooler: 'tower', cool: 260, price: p(6000, 3800) },

  board('H310', 'LGA1151', 4, 2, p(null, 3000), 2666),
  board('B460', 'LGA1200', 4, 4, p(null, 4500), 2933),
  board('B560', 'LGA1200', 4, 4, p(7000, 5000)),
  board('B660', 'LGA1700', 4, 4, p(8000, 6000)),
  board('B760', 'LGA1700', 5, 4, p(12000, 8500)),
  board('A520', 'AM4', 4, 2, p(5500, 3500)),
  board('B550', 'AM4', 4, 4, p(10000, 7000)),
  board('B650', 'AM5', 5, 4, p(13000, 9500)),

  disk('hdd', 1000, p(5500, 2000)),
  disk('hdd', 2000, p(7500, 3500)),
  disk('sata', 256, p(3500, 1500)),
  disk('sata', 512, p(6500, 3000)),
  disk('sata', 1000, p(12000, 6500)),
  disk('m2', 512, p(7500, 4000)),
  disk('m2', 1000, p(15500, 8500)),
  disk('m2', 2000, p(22000, 14000)),

  psu(450, p(3000, 1500)),
  psu(550, p(3500, 2000)),
  psu(650, p(4000, 2500)),
  psu(750, p(6500, 4000)),
  psu(850, p(8500, 5500)),

  { id: 'case-mid', slot: 'case', name: 'Mid-Tower ATX', price: p(3500, 1500) }
]

// Gaming speed, rough averages from reviews (TechPowerUp / Gamers Nexus / HowManyFPS / CheckFPS style
// comparisons). RX 590 ≈ 48% of an RTX 4060; RTX 5070 ≈ 1.55× an RTX 5060 at 1080p.
const PERF: Record<string, number> = {
  'i3-10105f': 82, 'i5-9400f': 88, 'i5-10400f': 100, 'i5-12400f': 132, 'i5-13400f': 140, 'i5-14600kf': 175,
  'i7-14700kf': 185, 'r5-3600': 90, 'r5-5600': 128, 'r7-5700x3d': 155, 'r5-7500f': 158, 'r7-7800x3d': 210, 'r7-9800x3d': 240,
  gtx1650: 35, gtx1660s: 58, rtx3050: 62, rtx3060: 84, rtx4060: 100, rtx4060ti: 124, rtx5060: 120, rtx4070s: 178,
  rtx5070: 186, rtx5070ti: 230, rx580: 43, rx590: 48, rx6600: 85, rx7600: 102, rx9060xt: 140, rx7800xt: 170, rx9070xt: 225,
  'arc-b580': 108
}
for (const x of CATALOG) if (PERF[x.id]) x.perf = PERF[x.id]

export function options(slot: Slot): Part[] {
  return CATALOG.filter((x) => x.slot === slot)
}

// ---- reading the user's PC

function cleanCpu(s: string): string {
  return s
    .replace(/\((R|TM)\)/gi, '')
    .replace(/\bCPU\b|@.*$|\d+-Core Processor|with Radeon.*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanGpu(s: string): string {
  return s
    .replace(/^(NVIDIA|AMD)\s+/i, '')
    .replace(/\b(RX)(\d)/i, '$1 $2')
    .replace(/\s+Series$/i, '')
    .trim()
}

function guessFans(vram: number, name: string): 1 | 2 | 3 {
  if (/(4080|4090|5080|5090|7900|9070|3080|3090)/.test(name) || vram >= 16) return 3
  if (vram <= 4) return 1
  return 2
}

export function diskKind(media: string, bus: string): DiskKind | null {
  if (/usb|sd|mmc|virtual|file backed/i.test(bus)) return null
  if (/nvme/i.test(bus)) return 'm2'
  if (/ssd/i.test(media)) return 'sata'
  return 'hdd'
}

/** a drive's price from the catalog drive of the same kind with the closest size */
function diskPrice(kind: DiskKind, gb: number): Price | undefined {
  const same = options('storage').filter((d) => d.disk === kind)
  same.sort((a, b) => Math.abs(Math.log((a.gb ?? 1) / gb)) - Math.abs(Math.log((b.gb ?? 1) / gb)))
  return same[0]?.price
}

/** memory price by size: catalog price per GB of the same DDR type */
function ramPrice(gb: number, ddr: 4 | 5): Price {
  const same = options('ram').filter((r) => r.ddr === ddr)
  const per = (k: 'new' | 'used'): number => same.reduce((s, r) => s + (r.price?.[k] ?? 0) / (r.gb ?? 1), 0) / same.length
  const round = (v: number): number => Math.round(v / 500) * 500
  return { new: round(per('new') * gb), used: round(per('used') * gb) }
}

/** Turns what Windows reports into a Build. Parts Windows can't see (cooler, PSU, case) are guessed. */
export function buildFromSystem(sys: SystemInfo): Build {
  const found = (slot: Slot, name: string): Part | undefined => CATALOG.find((x) => x.slot === slot && x.match?.test(name))

  const cpuName = cleanCpu(sys.cpu)
  const cpuHit = found('cpu', cpuName)
  const myCpu: Part = { ...cpuHit, id: 'mine-cpu', slot: 'cpu', name: cpuName, cores: sys.cores, threads: sys.threads, mine: true }

  const gpuName = cleanGpu(sys.gpu)
  const gpuHit = found('gpu', gpuName)
  const vram = sys.vram > 0 ? Math.round(sys.vram / 2 ** 30) : gpuHit?.vram
  const myGpu: Part = {
    ...gpuHit,
    id: 'mine-gpu',
    slot: 'gpu',
    name: gpuName || '—',
    vram,
    fans: gpuHit?.fans ?? guessFans(vram ?? 8, gpuName),
    mine: true
  }

  const gb0 = Math.round(sys.ramTotal / 2 ** 30)
  const gb = gb0 > 12 ? Math.round(gb0 / 4) * 4 : gb0
  const ddr: 4 | 5 = sys.ramType === 34 ? 5 : 4
  const myRam: Part = {
    id: 'mine-ram',
    slot: 'ram',
    gb,
    sticks: Math.max(1, Math.min(4, sys.ramSticks || 2)),
    ddr,
    mhz: sys.ramSpeed || undefined,
    price: ramPrice(gb, ddr),
    mine: true
  }

  // the parts already work together, so the board takes the memory type and socket of what's in it
  const chipset = /\b([ABHXZQ]\d{3})/i.exec(sys.board)?.[1]?.toUpperCase()
  const boardHit = chipset ? CATALOG.find((x) => x.slot === 'mobo' && x.chipset === chipset) : undefined
  const myBoard: Part = {
    ...boardHit,
    id: 'mine-mobo',
    slot: 'mobo',
    name: sys.board.replace(/\s+/g, ' ').trim() || '—',
    socket: boardHit?.socket ?? cpuHit?.socket,
    ddr,
    // BIOSes often report more memory slots than the board has (H310M H: says 4, has 2), so the catalog wins
    ramSlots: boardHit?.ramSlots ?? (sys.ramSlots || undefined),
    mine: true
  }

  const storage: Part[] = sys.disks
    .map((d, i): Part | null => {
      const kind = diskKind(d.media, d.bus)
      if (!kind) return null
      const size = Math.round(d.size / 1e9)
      return { id: `mine-disk-${i}`, slot: 'storage', name: d.name, disk: kind, gb: size, price: diskPrice(kind, size), mine: true }
    })
    .filter((d): d is Part => d !== null)

  // boxed coolers come with non-K Intel and non-X Ryzen; everything else most likely has a tower
  const boxed = cpuHit ? !!cpuHit.box : /i[3579]-\d{4,5}F?\b(?!K)/i.test(cpuName) || /ryzen \d \d{4}\b(?!X)/i.test(cpuName)
  // a PSU with some room over what the PC draws
  const draw = (cpuHit?.power ?? 100) + (gpuHit?.power ?? 200) + 50
  const watt = options('psu').find((x) => (x.watt ?? 0) >= draw * 1.4)?.watt ?? 750
  const psuPart = options('psu').find((x) => x.watt === watt)!

  return {
    cpu: myCpu,
    cooler: { ...(boxed ? options('cooler')[0] : options('cooler')[1]), id: 'mine-cooler', mine: true, guess: true },
    gpu: myGpu,
    ram: myRam,
    mobo: myBoard,
    storage: storage.length ? storage : [{ ...options('storage')[2], id: 'mine-disk-0', mine: true, guess: true }],
    psu: { ...psuPart, id: 'mine-psu', mine: true, guess: true },
    case: { ...options('case')[0], id: 'mine-case', mine: true, guess: true }
  }
}
