// Colors for charts/SVG (CSS classes use the same values from styles.css)
export const C = {
  bg: '#25252B',
  deep: '#1D1D22',
  panel: '#2C2C33',
  line: '#3D3D47',
  teal: '#528A9A',
  ice: '#7DB4C2',
  frost: '#D9E7E8',
  good: '#86C9A8',
  warn: '#E5BD7A',
  bad: '#E88C8C',
  muted: '#96A2A6'
}

export function scoreColor(v: number): string {
  if (v >= 90) return C.good
  if (v >= 75) return C.ice
  if (v >= 55) return C.warn
  return C.bad
}

/** Animations can be turned off in Settings (snow, bursts). */
export function fxEnabled(): boolean {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    return localStorage.getItem('fx') !== 'off'
  } catch {
    return true
  }
}
