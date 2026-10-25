// Parts the Stand knows: specs + which 3D shape to show. Prices, FPS and compatibility come in later parts.
import type { SystemInfo } from '../../../shared/types'

export type Slot = 'cpu' | 'cooler' | 'gpu' | 'ram' | 'mobo' | 'storage' | 'psu' | 'case'
export const SLOTS: Slot[] = ['gpu', 'cpu', 'ram', 'cooler', 'mobo', 'storage', 'psu', 'case']

export type DiskKind = 'm2' | 'sata' | 'hdd'

export interface Part {
  id: string
  slot: Slot
  /** empty = the name is made from the specs (generic parts like "SSD 1 TB") */
  name?: string
  /** tells the detected Windows name apart from the catalog one */
  match?: RegExp
  cores?: number
  threads?: number
  ghz?: number
  socket?: string
  vram?: number
  fans?: 1 | 2 | 3
  gb?: number
  sticks?: number
  ddr?: 4 | 5
  mhz?: number
  disk?: DiskKind
  cooler?: 'box' | 'tower'
  watt?: number
  chipset?: string
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

const cpu = (id: string, name: string, match: RegExp, cores: number, threads: number, ghz: number, socket: string): Part => ({
  id, slot: 'cpu', name, match, cores, threads, ghz, socket
})
const gpu = (id: string, name: string, match: RegExp, vram: number, fans: 1 | 2 | 3): Part => ({ id, slot: 'gpu', name, match, vram, fans })
const ram = (gb: number, sticks: number, ddr: 4 | 5, mhz: number): Part => ({ id: `ram-${ddr}-${gb}-${sticks}-${mhz}`, slot: 'ram', gb, sticks, ddr, mhz })
const disk = (kind: DiskKind, gb: number): Part => ({ id: `disk-${kind}-${gb}`, slot: 'storage', disk: kind, gb })
const psu = (watt: number): Part => ({ id: `psu-${watt}`, slot: 'psu', watt })
const board = (chipset: string, socket: string, ddr: 4 | 5): Part => ({ id: `mobo-${chipset}`, slot: 'mobo', name: chipset, chipset, socket, ddr })

export const CATALOG: Part[] = [
  cpu('i3-10105f', 'Intel Core i3-10105F', /i3-10105f?\b/i, 4, 8, 3.7, 'LGA1200'),
  cpu('i5-9400f', 'Intel Core i5-9400F', /i5-9400f?\b/i, 6, 6, 2.9, 'LGA1151'),
  cpu('i5-10400f', 'Intel Core i5-10400F', /i5-10400f?\b/i, 6, 12, 2.9, 'LGA1200'),
  cpu('i5-12400f', 'Intel Core i5-12400F', /i5-12400f?\b/i, 6, 12, 2.5, 'LGA1700'),
  cpu('i5-13400f', 'Intel Core i5-13400F', /i5-13400f?\b/i, 10, 16, 2.5, 'LGA1700'),
  cpu('i5-14600kf', 'Intel Core i5-14600KF', /i5-14600kf?\b/i, 14, 20, 3.5, 'LGA1700'),
  cpu('i7-14700kf', 'Intel Core i7-14700KF', /i7-14700kf?\b/i, 20, 28, 3.4, 'LGA1700'),
  cpu('r5-3600', 'AMD Ryzen 5 3600', /ryzen 5 3600\b/i, 6, 12, 3.6, 'AM4'),
  cpu('r5-5600', 'AMD Ryzen 5 5600', /ryzen 5 5600\b/i, 6, 12, 3.5, 'AM4'),
  cpu('r7-5700x3d', 'AMD Ryzen 7 5700X3D', /ryzen 7 5700x3d\b/i, 8, 16, 3.0, 'AM4'),
  cpu('r5-7500f', 'AMD Ryzen 5 7500F', /ryzen 5 7500f\b/i, 6, 12, 3.7, 'AM5'),
  cpu('r7-7800x3d', 'AMD Ryzen 7 7800X3D', /ryzen 7 7800x3d\b/i, 8, 16, 4.2, 'AM5'),
  cpu('r7-9800x3d', 'AMD Ryzen 7 9800X3D', /ryzen 7 9800x3d\b/i, 8, 16, 4.7, 'AM5'),

  gpu('gtx1650', 'GeForce GTX 1650', /gtx ?1650\b(?! super)/i, 4, 1),
  gpu('gtx1660s', 'GeForce GTX 1660 Super', /gtx ?1660 super/i, 6, 2),
  gpu('rtx3050', 'GeForce RTX 3050', /rtx ?3050\b/i, 8, 2),
  gpu('rtx3060', 'GeForce RTX 3060', /rtx ?3060\b(?! ti)/i, 12, 2),
  gpu('rtx4060', 'GeForce RTX 4060', /rtx ?4060\b(?! ti)/i, 8, 2),
  gpu('rtx4060ti', 'GeForce RTX 4060 Ti', /rtx ?4060 ?ti/i, 8, 2),
  gpu('rtx5060', 'GeForce RTX 5060', /rtx ?5060\b(?! ti)/i, 8, 2),
  gpu('rtx4070s', 'GeForce RTX 4070 Super', /rtx ?4070 super/i, 12, 3),
  gpu('rtx5070', 'GeForce RTX 5070', /rtx ?5070\b(?! ti)/i, 12, 3),
  gpu('rtx5070ti', 'GeForce RTX 5070 Ti', /rtx ?5070 ?ti/i, 16, 3),
  gpu('rx580', 'Radeon RX 580', /rx ?580\b/i, 8, 2),
  gpu('rx590', 'Radeon RX 590', /rx ?590\b/i, 8, 2),
  gpu('rx6600', 'Radeon RX 6600', /rx ?6600\b(?! xt)/i, 8, 2),
  gpu('rx7600', 'Radeon RX 7600', /rx ?7600\b(?! xt)/i, 8, 2),
  gpu('rx9060xt', 'Radeon RX 9060 XT', /rx ?9060 ?xt/i, 16, 2),
  gpu('rx7800xt', 'Radeon RX 7800 XT', /rx ?7800 ?xt/i, 16, 3),
  gpu('rx9070xt', 'Radeon RX 9070 XT', /rx ?9070 ?xt/i, 16, 3),
  gpu('arc-b580', 'Intel Arc B580', /arc.*b580/i, 12, 2),

  ram(8, 1, 4, 2666),
  ram(16, 2, 4, 2666),
  ram(16, 2, 4, 3200),
  ram(32, 2, 4, 3200),
  ram(32, 2, 4, 3600),
  ram(64, 4, 4, 3200),
  ram(32, 2, 5, 6000),
  ram(64, 2, 5, 6000),

  { id: 'cooler-box', slot: 'cooler', cooler: 'box' },
  { id: 'ak400', slot: 'cooler', name: 'DeepCool AK400', cooler: 'tower' },
  { id: 'se224', slot: 'cooler', name: 'ID-Cooling SE-224-XTS', cooler: 'tower' },
  { id: 'pa120', slot: 'cooler', name: 'Thermalright Peerless Assassin 120', cooler: 'tower' },
  { id: 'ak620', slot: 'cooler', name: 'DeepCool AK620', cooler: 'tower' },

  board('H310', 'LGA1151', 4),
  board('B460', 'LGA1200', 4),
  board('B560', 'LGA1200', 4),
  board('B660', 'LGA1700', 4),
  board('B760', 'LGA1700', 5),
  board('A520', 'AM4', 4),
  board('B550', 'AM4', 4),
  board('B650', 'AM5', 5),

  disk('hdd', 1000),
  disk('hdd', 2000),
  disk('sata', 256),
  disk('sata', 512),
  disk('sata', 1000),
  disk('m2', 512),
  disk('m2', 1000),
  disk('m2', 2000),

  psu(450),
  psu(550),
  psu(650),
  psu(750),
  psu(850),

  { id: 'case-mid', slot: 'case', name: 'Mid-Tower ATX' }
]

export function options(slot: Slot): Part[] {
  return CATALOG.filter((p) => p.slot === slot)
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

/** Turns what Windows reports into a Build. Parts Windows can't see (cooler, PSU, case) are guessed. */
export function buildFromSystem(sys: SystemInfo): Build {
  const found = (slot: Slot, name: string): Part | undefined => CATALOG.find((p) => p.slot === slot && p.match?.test(name))

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

  const gb = Math.round(sys.ramTotal / 2 ** 30)
  const myRam: Part = {
    id: 'mine-ram',
    slot: 'ram',
    gb: gb > 12 ? Math.round(gb / 4) * 4 : gb,
    sticks: Math.max(1, Math.min(4, sys.ramSticks || 2)),
    ddr: sys.ramType === 34 ? 5 : 4,
    mhz: sys.ramSpeed || undefined,
    mine: true
  }

  const chipset = /\b([ABHXZQ]\d{3})/i.exec(sys.board)?.[1]?.toUpperCase()
  const boardHit = chipset ? CATALOG.find((p) => p.slot === 'mobo' && p.chipset === chipset) : undefined
  const myBoard: Part = { ...boardHit, id: 'mine-mobo', slot: 'mobo', name: sys.board.replace(/\s+/g, ' ').trim() || '—', mine: true }

  const storage: Part[] = sys.disks
    .map((d, i): Part | null => {
      const kind = diskKind(d.media, d.bus)
      if (!kind) return null
      return { id: `mine-disk-${i}`, slot: 'storage', name: d.name, disk: kind, gb: Math.round(d.size / 1e9), mine: true }
    })
    .filter((d): d is Part => d !== null)

  // boxed coolers come with non-K Intel and non-X Ryzen; everything else most likely has a tower
  const boxed = /i[3579]-\d{4,5}F?\b(?!K)/i.test(cpuName) || /ryzen \d \d{4}\b(?!X)/i.test(cpuName)
  const watt = (myGpu.fans ?? 2) >= 3 ? 750 : 550

  return {
    cpu: myCpu,
    cooler: { ...(boxed ? options('cooler')[0] : options('cooler')[1]), id: 'mine-cooler', mine: true, guess: true },
    gpu: myGpu,
    ram: myRam,
    mobo: myBoard,
    storage: storage.length ? storage : [{ ...disk('sata', 256), id: 'mine-disk-0', mine: true, guess: true }],
    psu: { ...psu(watt), id: 'mine-psu', mine: true, guess: true },
    case: { ...options('case')[0], id: 'mine-case', mine: true, guess: true }
  }
}
