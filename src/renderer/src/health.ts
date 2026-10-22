// PC health score (0–100) and the list of problems that lower it.
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { TWEAKS } from '../../shared/tweaks'
import { useStore, type Page } from './store'
import { fmtBytes, pct } from './format'
import { startupHint } from './catalog'

export interface Issue {
  key: string
  text: string
  penalty: number
  page: Page
}

export function useHealth(): { score: number; issues: Issue[]; ready: boolean } {
  const { live, junk, startup, tweaks } = useStore()
  const { t, i18n } = useTranslation()
  return useMemo(() => {
    const lang = i18n.language
    const issues: Issue[] = []
    const drive = 'C:'
    if (live && live.diskTotal > 0) {
      const ratio = live.diskFree / live.diskTotal
      const text = t('dash.issue.diskLow', { drive, free: fmtBytes(live.diskFree, lang) })
      if (ratio < 0.1) issues.push({ key: 'disk', text, penalty: 25, page: 'cleaner' })
      else if (ratio < 0.2) issues.push({ key: 'disk', text, penalty: 12, page: 'cleaner' })
    }
    if (junk) {
      const total = junk.filter((j) => j.defaultOn).reduce((s, j) => s + (j.size ?? 0), 0)
      const penalty = total > 2 * 1024 ** 3 ? 15 : total > 500 * 1024 ** 2 ? 8 : total > 100 * 1024 ** 2 ? 3 : 0
      if (penalty) issues.push({ key: 'junk', text: t('dash.issue.junk', { size: fmtBytes(total, lang) }), penalty, page: 'cleaner' })
    }
    if (startup) {
      const n = startup.filter((s) => s.enabled && startupHint(s).hint === 'disable').length
      const penalty = n > 4 ? 15 : n > 1 ? 8 : n === 1 ? 3 : 0
      if (penalty) issues.push({ key: 'startup', text: t('dash.issue.startup', { n }), penalty, page: 'startup' })
    }
    if (tweaks) {
      const n = TWEAKS.filter((tw) => tw.recommended && !tweaks.find((s) => s.id === tw.id)?.applied).length
      if (n) issues.push({ key: 'tweaks', text: t('dash.issue.tweaks', { n }), penalty: Math.min(30, n * 3), page: 'boost' })
    }
    if (live) {
      const p = pct(live.ramUsed, live.ramTotal)
      if (p > 85) issues.push({ key: 'ram', text: t('dash.issue.ram', { p }), penalty: 5, page: 'processes' })
      const days = Math.floor(live.uptime / 86400)
      if (days >= 3) issues.push({ key: 'uptime', text: t('dash.issue.uptime', { d: days }), penalty: 5, page: 'processes' })
    }
    const score = Math.max(5, 100 - issues.reduce((s, i) => s + i.penalty, 0))
    return { score, issues: issues.sort((a, b) => b.penalty - a.penalty), ready: !!(live && junk && startup && tweaks) }
  }, [live, junk, startup, tweaks, t, i18n.language])
}

export type Mood = 'bad' | 'ok' | 'good' | 'great'
export function moodOf(score: number): Mood {
  return score >= 90 ? 'great' : score >= 75 ? 'good' : score >= 55 ? 'ok' : 'bad'
}
