// FPS estimates. Each game has two numbers: FPS on an RTX 4060 at 1080p High when the video card is
// the limit, and FPS a Core i5-10400F can feed when the processor is the limit. A build's FPS is the
// softer of the two, scaled by its parts' speed (catalog `perf`), resolution and graphics.
// Anchors come from public 1080p tests (e.g. RX 580: CS2 ~135, GTA V ~104; RTX 4060: GTA V ~190,
// Cyberpunk ~75), but tests disagree a lot, so the user can type their real FPS for a game and the
// model fits itself to it (`Measure`). Rough on purpose: no upscaling (DLSS/FSR), no ray tracing.
import type { Build } from './catalog'

export type GameCat = 'shooter' | 'heavy' | 'light'
export type Res = '1080' | '1440' | '2160'
export type Preset = 'low' | 'medium' | 'high' | 'ultra'

export const RESES: Res[] = ['1080', '1440', '2160']
export const PRESETS: Preset[] = ['low', 'medium', 'high', 'ultra']

export interface Game {
  id: string
  name: string
  /** Russian name, when it differs */
  nameRu?: string
  cat: GameCat
  /** finds the game among installed apps */
  match: RegExp
  /** FPS on RTX 4060, 1080p High */
  gpu: number
  /** FPS a Core i5-10400F can feed */
  cpu: number
  /** GB of video memory at 1080p High */
  vram: number
  /** GB of RAM it wants */
  ram: number
  /** the game's own FPS limit */
  cap?: number
  /** e-sports / simple graphics: settings change FPS less */
  light?: boolean
  /** how much the video card's speed matters, 1 = new games. Old games run relatively well on old
   *  cards: an RX 590 is ~48% of an RTX 4060 in new games but ~60% in GTA V (0.48 ** 0.72) */
  spread?: number
  /** the game has a tip (stand.fps.hint.<id>) */
  hint?: boolean
}

export const GAMES: Game[] = [
  { id: 'cs2', name: 'Counter-Strike 2', cat: 'shooter', match: /counter-strike/i, gpu: 290, cpu: 240, vram: 3, ram: 8, light: true, spread: 0.9 },
  { id: 'valorant', name: 'Valorant', cat: 'shooter', match: /valorant/i, gpu: 450, cpu: 330, vram: 2, ram: 8, light: true, spread: 0.75 },
  { id: 'fortnite', name: 'Fortnite', cat: 'shooter', match: /fortnite/i, gpu: 115, cpu: 160, vram: 5, ram: 16, spread: 0.95, hint: true },
  { id: 'apex', name: 'Apex Legends', cat: 'shooter', match: /apex legends/i, gpu: 160, cpu: 170, vram: 5, ram: 8, cap: 300, spread: 0.8 },
  { id: 'pubg', name: 'PUBG: Battlegrounds', cat: 'shooter', match: /pubg|battlegrounds/i, gpu: 150, cpu: 140, vram: 5, ram: 16, spread: 0.85 },
  { id: 'warzone', name: 'Call of Duty: Warzone', cat: 'shooter', match: /warzone|call of duty/i, gpu: 100, cpu: 130, vram: 7, ram: 16, spread: 0.95 },
  { id: 'cyberpunk', name: 'Cyberpunk 2077', cat: 'heavy', match: /cyberpunk/i, gpu: 75, cpu: 90, vram: 7, ram: 16 },
  { id: 'rdr2', name: 'Red Dead Redemption 2', cat: 'heavy', match: /red dead/i, gpu: 75, cpu: 100, vram: 6, ram: 16, spread: 0.75 },
  { id: 'gta5', name: 'GTA V', cat: 'heavy', match: /grand theft auto v|gta ?v\b/i, gpu: 190, cpu: 140, vram: 4, ram: 8, cap: 185, spread: 0.72 },
  { id: 'elden', name: 'Elden Ring', cat: 'heavy', match: /elden ring/i, gpu: 90, cpu: 80, vram: 6, ram: 16, cap: 60, spread: 0.8 },
  { id: 'stalker2', name: 'S.T.A.L.K.E.R. 2', cat: 'heavy', match: /s\.?t\.?a\.?l\.?k\.?e\.?r\.? 2/i, gpu: 45, cpu: 55, vram: 8, ram: 16 },
  { id: 'roblox', name: 'Roblox', cat: 'light', match: /roblox/i, gpu: 260, cpu: 150, vram: 2, ram: 8, cap: 240, light: true, spread: 0.7, hint: true },
  { id: 'minecraft', name: 'Minecraft', cat: 'light', match: /minecraft/i, gpu: 300, cpu: 160, vram: 2, ram: 8, light: true, spread: 0.7 },
  { id: 'dota2', name: 'Dota 2', cat: 'light', match: /dota/i, gpu: 200, cpu: 160, vram: 3, ram: 8, light: true, spread: 0.8 },
  { id: 'wot', name: 'World of Tanks', nameRu: 'Мир танков', cat: 'light', match: /world of tanks|мир танков|tanki/i, gpu: 180, cpu: 140, vram: 4, ram: 8, spread: 0.8 }
]

const RES_K: Record<Res, number> = { '1080': 1, '1440': 0.7, '2160': 0.4 }
const PRESET_K: Record<Preset, number> = { low: 1.9, medium: 1.4, high: 1, ultra: 0.78 }
const VRAM_RES: Record<Res, number> = { '1080': 1, '1440': 1.15, '2160': 1.4 }
const VRAM_PRESET: Record<Preset, number> = { low: 0.7, medium: 0.85, high: 1, ultra: 1.2 }

// ---- the user's own measurements

/** real FPS the user saw in a game on their own PC, with the settings they play at */
export interface Measure {
  fps: number
  res: Res
  preset: Preset
  /** which PC it was measured on (processor + video card); after a real upgrade old numbers are dropped */
  pc: string
}

export function pcKey(b: Build): string {
  return `${b.cpu.name ?? ''}|${b.gpu.name ?? ''}`
}

/** measurements taken on this PC as it is now */
export function calibrationFor(mine: Build, all: Record<string, Measure>): Calibration {
  const pc = pcKey(mine)
  return { mine, measures: Object.fromEntries(Object.entries(all).filter(([, m]) => m.pc === pc)) }
}

/** A measured value that looks like an FPS limit or V-Sync rather than the PC's real speed: the
 *  monitor's refresh rate, or the common 30/60 locks. Not 120/144: people round to those too. */
export function looksCapped(fps: number, refresh: number): boolean {
  return fps === 30 || fps === 60 || (refresh > 0 && Math.abs(fps - refresh) <= 1)
}

export interface Calibration {
  /** the user's PC as it is (measurements were taken on it) */
  mine: Build
  measures: Record<string, Measure>
}

const KEY = 'iceboost.stand.fps'

export function loadMeasures(): Record<string, Measure> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Measure>
  } catch {
    return {}
  }
}

export function saveMeasures(m: Record<string, Measure>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m))
  } catch {
    // ignore
  }
}

// ---- the model

interface Limits {
  /** FPS the video card can draw */
  gpu: number
  /** FPS the processor can feed */
  cpu: number
  vramShort: boolean
  ramShort: boolean
}

function limits(b: Build, g: Game, res: Res, preset: Preset): Limits | null {
  const gi = b.gpu.perf
  const ci = b.cpu.perf
  if (!gi || !ci) return null
  const pk = g.light ? Math.sqrt(PRESET_K[preset]) : PRESET_K[preset]
  // strong cards lose less at high resolutions, weak ones more
  const resK = RES_K[res] * (res === '1080' ? 1 : (gi / 100) ** (res === '1440' ? 0.1 : 0.2))
  let gpu = g.gpu * (gi / 100) ** (g.spread ?? 1) * resK * pk
  // one memory stick = single channel, the processor gets slower in games
  let cpu = (g.cpu * ci * (preset === 'low' ? 1.08 : 1) * ((b.ram.sticks ?? 2) === 1 ? 0.85 : 1)) / 100
  const vramShort = (b.gpu.vram ?? 8) < g.vram * VRAM_RES[res] * VRAM_PRESET[preset]
  if (vramShort) gpu *= 0.7
  const ramShort = (b.ram.gb ?? 16) < g.ram
  if (ramShort) cpu *= 0.8
  return { gpu, cpu, vramShort, ramShort }
}

/** the slower part sets the pace, with a soft edge (near the middle both matter) */
function combine(gpu: number, cpu: number): number {
  return (gpu ** -4 + cpu ** -4) ** -0.25
}

/** How much to scale this game's FPS so the model gives exactly what the user measured on their PC.
 *  Both limits get the same factor: one number can't tell whether the video card or the processor
 *  was misjudged (fitting just one once "proved" a new video card gives +2% in GTA V). So a swap is
 *  predicted as "your real FPS × the model's change". Clamped, so a typo can't break everything. */
export function fitFactor(g: Game, cal?: Calibration | null): number {
  const m = cal?.measures[g.id]
  const L = m && cal ? limits(cal.mine, g, m.res, m.preset) : null
  if (!m || !L) return 1
  return Math.min(3, Math.max(0.33, m.fps / combine(L.gpu, L.cpu)))
}

export interface Fps {
  fps: number
  /** what holds the FPS back */
  limit: 'gpu' | 'cpu' | 'cap'
  /** the game wants more video memory than the card has — stutters */
  vramShort: boolean
  ramShort: boolean
  /** fitted to the user's own measurement */
  measured: boolean
}

/** null = no speed data for this video card or processor */
export function estimate(b: Build, g: Game, res: Res, preset: Preset, cal?: Calibration | null): Fps | null {
  const L = limits(b, g, res, preset)
  if (!L) return null
  const k = fitFactor(g, cal)
  const gpu = L.gpu * k
  const cpu = L.cpu * k
  let fps = combine(gpu, cpu)
  let limit: Fps['limit'] = gpu <= cpu ? 'gpu' : 'cpu'
  if (g.cap && fps > g.cap) {
    fps = g.cap
    limit = 'cap'
  }
  return { fps: Math.round(fps), limit, vramShort: L.vramShort, ramShort: L.ramShort, measured: !!cal?.measures[g.id] }
}

/** average FPS change from build a to build b over all games, 0.25 = +25% */
export function gain(a: Build, b: Build, res: Res, preset: Preset, cal?: Calibration | null): number | null {
  let sum = 0
  for (const g of GAMES) {
    const x = estimate(a, g, res, preset, cal)
    const y = estimate(b, g, res, preset, cal)
    if (!x || !y) return null
    sum += Math.log(y.fps / x.fps)
  }
  return Math.exp(sum / GAMES.length) - 1
}

/** which part holds the PC back more often in these settings */
export function bottleneck(b: Build, res: Res, preset: Preset, cal?: Calibration | null): 'gpu' | 'cpu' | 'balanced' | null {
  let gpu = 0
  let cpu = 0
  for (const g of GAMES) {
    const f = estimate(b, g, res, preset, cal)
    if (!f) return null
    if (f.limit === 'gpu') gpu++
    else if (f.limit === 'cpu') cpu++
  }
  if (gpu >= cpu * 2) return 'gpu'
  if (cpu >= gpu * 2) return 'cpu'
  return 'balanced'
}

export function resFromScreen(resolution: string): Res {
  const h = Number(resolution.split('x')[1] ?? 1080)
  return h >= 2000 ? '2160' : h >= 1400 ? '1440' : '1080'
}
