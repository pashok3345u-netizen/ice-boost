// When the video card is "fine", "hot" or "dangerous". Used by the GPU page, the health score
// and the main process (Windows notifications), so all of them agree.
import type { GpuSensors } from './types'

export type GpuLevel = 'ok' | 'warm' | 'hot' | 'danger'
export type GpuAlertId = 'temp' | 'hotspot' | 'volt' | 'fan'

export interface GpuAlert {
  id: GpuAlertId
  level: 'hot' | 'danger'
}

/** Temperature zones, built from the driver's own limit (90 °C if the card doesn't say). */
export function tempZones(maxTemp: number | null): { warm: number; hot: number; danger: number; max: number } {
  const max = maxTemp && maxTemp >= 70 && maxTemp <= 110 ? maxTemp : 90
  return { warm: max - 20, hot: max - 10, danger: max - 3, max }
}

/** The hottest point of the chip may run much hotter than the main sensor. */
export const HOTSPOT = { hot: 95, danger: 105 }

/** Cards raise the voltage by themselves up to ~1.15 V in games; above 1.2 V is manual overclocking. */
export const VOLT = { high: 1.2, danger: 1.25 }

/** A fan showing 0 while the card is this hot is probably stuck. */
export const FAN_STOPPED_AT = 75

const rank: Record<GpuLevel, number> = { ok: 0, warm: 1, hot: 2, danger: 3 }

export function checkGpu(s: GpuSensors): { level: GpuLevel; alerts: GpuAlert[] } {
  const alerts: GpuAlert[] = []
  const z = tempZones(s.maxTemp)
  let level: GpuLevel = 'ok'

  if (s.temp != null) {
    if (s.temp >= z.danger) alerts.push({ id: 'temp', level: 'danger' })
    else if (s.temp >= z.hot) alerts.push({ id: 'temp', level: 'hot' })
    else if (s.temp >= z.warm) level = 'warm'
  }
  if (s.hotspot != null) {
    if (s.hotspot >= HOTSPOT.danger) alerts.push({ id: 'hotspot', level: 'danger' })
    else if (s.hotspot >= HOTSPOT.hot) alerts.push({ id: 'hotspot', level: 'hot' })
  }
  if (s.voltage != null) {
    if (s.voltage > VOLT.danger) alerts.push({ id: 'volt', level: 'danger' })
    else if (s.voltage > VOLT.high) alerts.push({ id: 'volt', level: 'hot' })
  }
  const fan = s.fanRpm ?? s.fanPct
  if (fan === 0 && s.temp != null && s.temp >= FAN_STOPPED_AT) alerts.push({ id: 'fan', level: 'hot' })

  for (const a of alerts) if (rank[a.level] > rank[level]) level = a.level
  return { level, alerts }
}

export function tempLevel(temp: number, maxTemp: number | null): GpuLevel {
  const z = tempZones(maxTemp)
  return temp >= z.danger ? 'danger' : temp >= z.hot ? 'hot' : temp >= z.warm ? 'warm' : 'ok'
}

export function voltLevel(v: number): GpuLevel {
  return v > VOLT.danger ? 'danger' : v > VOLT.high ? 'hot' : 'ok'
}
