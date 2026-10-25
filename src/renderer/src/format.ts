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

export function daysSince(ms: number): number {
  return Math.max(0, Math.floor((Date.now() - ms) / 86400000))
}

/** How long: "5 дн." / "3 мес." / "2 года" — "5 days" / "3 months" / "2 years" */
export function fmtSpan(ms: number, lang: string): string {
  const d = Math.max(1, daysSince(ms))
  const m = Math.floor(d / 30.44)
  const y = Math.floor(d / 365.25)
  if (lang === 'ru') {
    if (m < 1) return `${d} дн.`
    if (y < 1) return `${m} мес.`
    const last = y % 10
    const word = y % 100 >= 11 && y % 100 <= 14 ? 'лет' : last === 1 ? 'год' : last >= 2 && last <= 4 ? 'года' : 'лет'
    return `${y} ${word}`
  }
  if (m < 1) return d === 1 ? '1 day' : `${d} days`
  if (y < 1) return m === 1 ? '1 month' : `${m} months`
  return y === 1 ? '1 year' : `${y} years`
}

/** "сегодня" / "вчера" / "3 мес. назад" */
export function fmtAgo(ms: number, lang: string): string {
  const d = daysSince(ms)
  if (d === 0) return lang === 'ru' ? 'сегодня' : 'today'
  if (d === 1) return lang === 'ru' ? 'вчера' : 'yesterday'
  return lang === 'ru' ? `${fmtSpan(ms, lang)} назад` : `${fmtSpan(ms, lang)} ago`
}

export function fmtDate(ms: number, lang: string): string {
  return new Date(ms).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}
