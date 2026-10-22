import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronRight, CircleCheck, CircuitBoard, Clock, Cpu, Gpu, HardDrive, MemoryStick, Monitor, Rocket, Sparkles, TriangleAlert
} from 'lucide-react'
import { TWEAKS } from '../../../shared/tweaks'
import { useStore, type Page } from '../store'
import { Bar, Button, Card, Ring, scoreColor, Sparkline } from '../ui'
import { fmtBytes, fmtUptime, pct } from '../format'
import { startupHint } from '../catalog'
import { OneClick } from '../OneClick'

interface Issue {
  key: string
  text: string
  penalty: number
  page: Page
}

function useHealth(): { score: number; issues: Issue[]; ready: boolean } {
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

function Stat({
  icon, title, value, sub, data, color, bar
}: { icon: ReactNode; title: string; value: string; sub: string; data?: number[]; color: string; bar?: number }): ReactNode {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span style={{ color }}>{icon}</span>
        {title}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-3xl font-semibold tabular-nums">{value}</span>
        <span className="truncate text-xs text-muted">{sub}</span>
      </div>
      {data ? <Sparkline data={data} color={color} /> : <div className="flex h-11 items-end"><Bar value={bar ?? 0} color={color} /></div>}
    </Card>
  )
}

function Row({ icon, label, value }: { icon: ReactNode; label: string; value: string }): ReactNode {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted">{label}</div>
        <div className="truncate text-sm">{value}</div>
      </div>
    </div>
  )
}

export function Dashboard(): ReactNode {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { sys, live, history, go } = useStore()
  const { score, issues, ready } = useHealth()
  const [running, setRunning] = useState(false)

  const grade = score >= 90 ? 'great' : score >= 75 ? 'good' : score >= 55 ? 'ok' : 'bad'
  const ramP = live ? pct(live.ramUsed, live.ramTotal) : 0
  const diskUsedP = live ? 100 - pct(live.diskFree, live.diskTotal) : 0

  return (
    <div className="fade-up space-y-5">
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-5">
        <Card className="relative flex flex-col items-center overflow-hidden py-7">
          <div className="pointer-events-none absolute -top-24 size-72 rounded-full opacity-25 blur-3xl" style={{ background: scoreColor(score) }} />
          <Ring value={ready ? score : 0} size={190}>
            <div className="text-center">
              <div className="text-5xl font-bold tabular-nums">{ready ? score : '…'}</div>
              <div className="mt-1 text-xs uppercase tracking-widest text-muted">{t('dash.score')}</div>
            </div>
          </Ring>
          <div className="mt-4 text-lg font-semibold" style={{ color: ready ? scoreColor(score) : undefined }}>
            {ready ? t(`dash.grade.${grade}`) : t('common.loading')}
          </div>
          <Button variant="primary" size="lg" className="pulse mt-5" icon={<Rocket className="size-5" />} disabled={!ready} onClick={() => setRunning(true)}>
            {t('dash.oneClick')}
          </Button>
          <p className="mt-3 max-w-xs text-center text-xs text-muted">{t('dash.oneClickHint')}</p>
        </Card>

        <Card className="flex flex-col">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-ice" />
            {t('dash.issues')}
          </h2>
          {!ready ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-panel2" />
              ))}
            </div>
          ) : issues.length === 0 ? (
            <div className="grid flex-1 place-items-center text-center text-muted">
              <div>
                <CircleCheck className="mx-auto mb-3 size-10 text-good" />
                {t('dash.noIssues')}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {issues.map((i) => (
                <button
                  key={i.key}
                  onClick={() => go(i.page)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-line bg-panel2/60 px-4 py-3 text-left transition hover:border-ice/40"
                >
                  <TriangleAlert className={i.penalty >= 12 ? 'size-5 shrink-0 text-warn' : 'size-5 shrink-0 text-muted'} />
                  <span className="flex-1 text-sm">{i.text}</span>
                  <span className="text-xs text-muted">−{i.penalty}</span>
                  <span className="flex items-center text-xs text-ice opacity-70 group-hover:opacity-100">
                    {t('dash.fix')}
                    <ChevronRight className="size-4" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-4 gap-5">
        <Stat icon={<Cpu className="size-4" />} title={t('dash.cpu')} value={live ? `${Math.round(live.cpu)}%` : '—'} sub={sys ? `${sys.cores} ${lang === 'ru' ? 'ядер' : 'cores'}` : ''} data={history.cpu} color="#38bdf8" />
        <Stat
          icon={<MemoryStick className="size-4" />}
          title={t('dash.ram')}
          value={live ? `${ramP}%` : '—'}
          sub={live ? t('dash.of', { a: fmtBytes(live.ramUsed, lang), b: fmtBytes(live.ramTotal, lang) }) : ''}
          data={history.ram}
          color="#a78bfa"
        />
        <Stat
          icon={<Gpu className="size-4" />}
          title={t('dash.gpu')}
          value={live?.gpu != null ? `${Math.round(live.gpu)}%` : '—'}
          sub={live?.vramUsed != null && sys ? t('dash.of', { a: fmtBytes(live.vramUsed, lang), b: fmtBytes(sys.vram, lang) }) : ''}
          data={history.gpu}
          color="#22d3ee"
        />
        <Stat
          icon={<HardDrive className="size-4" />}
          title={t('dash.disk', { drive: 'C:' })}
          value={live ? `${diskUsedP}%` : '—'}
          sub={live ? t('dash.free', { v: fmtBytes(live.diskFree, lang) }) : ''}
          bar={diskUsedP}
          color={diskUsedP > 90 ? '#f87171' : diskUsedP > 80 ? '#fbbf24' : '#34d399'}
        />
      </div>

      <Card>
        <h2 className="mb-1 font-semibold">{t('dash.yourPc')}</h2>
        {!sys ? (
          <div className="h-28 animate-pulse rounded-xl bg-panel2" />
        ) : (
          <div className="grid grid-cols-3 gap-x-8 divide-line">
            <Row icon={<Cpu className="size-4" />} label={t('dash.cpu')} value={`${sys.cpu} · ${sys.cores}/${sys.threads}`} />
            <Row icon={<Gpu className="size-4" />} label={t('dash.gpu')} value={`${sys.gpu} · ${t('dash.vram', { v: fmtBytes(sys.vram, lang) })}`} />
            <Row
              icon={<MemoryStick className="size-4" />}
              label={t('dash.ram')}
              value={`${fmtBytes(sys.ramTotal, lang)} · ${t('dash.sticks', { n: sys.ramSticks, speed: sys.ramSpeed })}`}
            />
            <Row icon={<CircuitBoard className="size-4" />} label={t('dash.board')} value={sys.board || '—'} />
            <Row icon={<Monitor className="size-4" />} label={t('dash.monitor')} value={sys.resolution ? `${sys.resolution} · ${sys.refresh} Hz` : '—'} />
            <Row icon={<Clock className="size-4" />} label={t('dash.uptime')} value={live ? fmtUptime(live.uptime, lang) : '—'} />
            <Row
              icon={<HardDrive className="size-4" />}
              label={t('dash.disks')}
              value={sys.disks.map((d) => `${d.name} (${d.media === 'Unspecified' ? d.bus : d.media}, ${fmtBytes(d.size, lang)})`).join(' · ')}
            />
            <Row icon={<Monitor className="size-4" />} label={t('dash.windows')} value={`${sys.os} · ${sys.build}`} />
          </div>
        )}
      </Card>

      <OneClick open={running} onClose={() => setRunning(false)} />
    </div>
  )
}
