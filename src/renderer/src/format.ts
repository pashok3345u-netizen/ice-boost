export function fmtBytes(n: number | null | undefined, lang: string): string {
  if (n == null) return '—'
  const units = lang === 'ru' ? ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'] : ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  const s = i === 0 || v >= 100 ? String(Math.round(v)) : v.toFixed(1)
  return `${lang === 'ru' ? s.replace('.', ',') : s} ${units[i]}`
}

export function fmtUptime(sec: number, lang: string): string {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const [dd, hh, mm] = lang === 'ru' ? ['дн', 'ч', 'мин'] : ['d', 'h', 'min']
  if (d > 0) return `${d} ${dd} ${h} ${hh}`
  if (h > 0) return `${h} ${hh} ${m} ${mm}`
  return `${m} ${mm}`
}

export function pct(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 100) : 0
}

/** Turns an IPC error into plain text; "UAC_DENIED" gets a friendly message. */
export function errText(e: unknown, uacText: string): string {
  const raw = e instanceof Error ? e.message : String(e)
  const msg = raw.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '')
  return msg.includes('UAC_DENIED') ? uacText : msg
}
