import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import {
  ChevronRight, CircleCheck, CircuitBoard, Clock, Cpu, Gamepad2, Gpu, HardDrive, MemoryStick, Monitor, Rocket, Sparkles, TriangleAlert
} from 'lucide-react'
import { useStore } from '../store'
import { useHealth } from '../health'
import { Bar, Button, Card, CountUp, Ring, Skeleton, Sparkline } from '../ui'
import { C, scoreColor } from '../theme'
import { fmtBytes, fmtUptime, pct } from '../format'
import { OneClick } from '../OneClick'
import { Mascot } from '../Mascot'
import { useGameTime } from '../actions'

export function cleanCpuName(name: string): string {
  return name.replace(/\(R\)|\(TM\)|CPU|@.*$/g, '').replace(/\s+/g, ' ').trim()
}

function Stat({
  icon, title, value, suffix, sub, data, color, bar, delay
}: {
  icon: ReactNode
  title: string
  value: number | null
  suffix: string
  sub: string
  data?: number[]
  color: string
  bar?: number
  delay: number
}): ReactNode {
  return (
    <Card hover delay={delay} className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="grid size-7 place-items-center rounded-lg" style={{ color, background: `${color}22` }}>
          {icon}
        </span>
        {title}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-3xl font-semibold tabular-nums">
          {value == null ? '—' : <CountUp value={value} duration={600} />}
          {value != null && <span className="ml-0.5 text-lg text-muted">{suffix}</span>}
        </span>
        <span className="truncate text-xs text-muted">{sub}</span>
      </div>
      {data ? <Sparkline data={data} color={color} /> : <div className="flex h-11 items-end"><Bar value={bar ?? 0} color={color} height={8} /></div>}
    </Card>
  )
}

function Row({ icon, label, value, delay }: { icon: ReactNode; label: string; value: string; delay: number }): ReactNode {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-teal/15 text-ice">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted">{label}</div>
        <div className="truncate text-sm" title={value}>
          {value}
        </div>
      </div>
    </motion.div>
  )
}

export function Dashboard(): ReactNode {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { sys, live, history, gpu, go } = useStore()
  const { score, issues, ready } = useHealth()
  const [running, setRunning] = useState(false)
  const [gaming, setGaming] = useState(false)
  const gameTime = useGameTime()

  const grade = score >= 90 ? 'great' : score >= 75 ? 'good' : score >= 55 ? 'ok' : 'bad'
  const ramP = live ? pct(live.ramUsed, live.ramTotal) : null
  const diskUsedP = live ? 100 - pct(live.diskFree, live.diskTotal) : null

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-5">
        <Card className="relative overflow-hidden py-6">
          <motion.div
            className="pointer-events-none absolute -top-28 left-1/4 size-80 rounded-full blur-3xl"
            animate={{ background: scoreColor(ready ? score : 60), opacity: [0.18, 0.3, 0.18] }}
            transition={{ opacity: { duration: 4, repeat: Infinity }, background: { duration: 1 } }}
          />
          <div className="relative flex items-center justify-center gap-4">
            <Ring value={ready ? score : 0} size={196}>
              <div className="text-center">
                <div className="font-display text-5xl font-bold tabular-nums" style={{ color: ready ? scoreColor(score) : C.muted }}>
                  {ready ? <CountUp value={score} duration={1300} /> : '…'}
                </div>
                <div className="mt-1 text-[10px] tracking-[0.2em] text-muted uppercase">{t('dash.score')}</div>
              </div>
            </Ring>
            <Mascot score={ready ? score : 60} size={118} />
          </div>
          <div className="relative mt-3 text-center">
            <div className="font-display text-lg font-semibold" style={{ color: ready ? scoreColor(score) : undefined }}>
              {ready ? t(`dash.grade.${grade}`) : t('common.loading')}
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2 px-4">
              <Button variant="primary" size="lg" className="pulse" icon={<Rocket className="size-5" />} disabled={!ready} onClick={() => setRunning(true)}>
                {t('dash.oneClick')}
              </Button>
              <Button
                size="lg"
                icon={<Gamepad2 className="size-5 text-ice" />}
                loading={gaming}
                onClick={async (e) => {
                  setGaming(true)
                  await gameTime(e)
                  setGaming(false)
                }}
              >
                {t('dash.gameTime')}
              </Button>
            </div>
            <p className="mx-auto mt-3 max-w-sm text-xs text-muted">{t('dash.oneClickHint')}</p>
          </div>
        </Card>

        <Card delay={0.05} className="flex flex-col">
          <h2 className="font-display mb-3 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-ice" />
            {t('dash.issues')}
          </h2>
          {!ready ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : issues.length === 0 ? (
            <div className="grid flex-1 place-items-center text-center text-muted">
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <CircleCheck className="mx-auto mb-3 size-12 text-good" />
                {t('dash.noIssues')}
              </motion.div>
            </div>
          ) : (
            <div className="space-y-2">
              {issues.map((i, k) => (
                <motion.button
                  key={i.key}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 * k }}
                  whileHover={{ x: 4 }}
                  onClick={() => go(i.page)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-line bg-panel2/70 px-4 py-3 text-left transition-colors hover:border-teal/60"
                >
                  <span className={i.penalty >= 12 ? 'text-warn' : 'text-muted'}>
                    <TriangleAlert className="size-5 shrink-0" />
                  </span>
                  <span className="flex-1 text-sm">{i.text}</span>
                  <span className="font-display text-xs text-bad/80">−{i.penalty}</span>
                  <span className="flex items-center text-xs text-ice opacity-70 transition group-hover:opacity-100">
                    {t('dash.fix')}
                    <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
                  </span>
                </motion.button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-4 gap-5">
        <Stat delay={0.1} icon={<Cpu className="size-4" />} title={t('dash.cpu')} value={live ? Math.round(live.cpu) : null} suffix="%" sub={sys ? `${sys.cores} ${lang === 'ru' ? 'ядер' : 'cores'}` : ''} data={history.cpu} color={C.ice} />
        <Stat
          delay={0.15}
          icon={<MemoryStick className="size-4" />}
          title={t('dash.ram')}
          value={ramP}
          suffix="%"
          sub={live ? t('dash.of', { a: fmtBytes(live.ramUsed, lang), b: fmtBytes(live.ramTotal, lang) }) : ''}
          data={history.ram}
          color={C.frost}
        />
        <Stat
          delay={0.2}
          icon={<Gpu className="size-4" />}
          title={t('dash.gpu')}
          value={live?.gpu != null ? Math.round(live.gpu) : null}
          suffix="%"
          sub={[
            gpu?.now?.temp != null ? `${Math.round(gpu.now.temp)}°C` : '',
            live?.vramUsed != null && sys ? t('dash.of', { a: fmtBytes(live.vramUsed, lang), b: fmtBytes(sys.vram, lang) }) : ''
          ]
            .filter(Boolean)
            .join(' · ')}
          data={history.gpu}
          color={C.good}
        />
        <Stat
          delay={0.25}
          icon={<HardDrive className="size-4" />}
          title={t('dash.disk', { drive: 'C:' })}
          value={diskUsedP}
          suffix="%"
          sub={live ? t('dash.free', { v: fmtBytes(live.diskFree, lang) }) : ''}
          bar={diskUsedP ?? 0}
          color={(diskUsedP ?? 0) > 90 ? C.bad : (diskUsedP ?? 0) > 80 ? C.warn : C.good}
        />
      </div>

      <Card delay={0.3}>
        <h2 className="font-display mb-1 text-sm font-semibold">{t('dash.yourPc')}</h2>
        {!sys ? (
          <Skeleton className="h-28" />
        ) : (
          <div className="grid grid-cols-3 gap-x-8">
            <Row delay={0.35} icon={<Cpu className="size-4" />} label={t('dash.cpu')} value={`${cleanCpuName(sys.cpu)} · ${sys.cores}/${sys.threads}`} />
            <Row delay={0.38} icon={<Gpu className="size-4" />} label={t('dash.gpu')} value={`${sys.gpu} · ${t('dash.vram', { v: fmtBytes(sys.vram, lang) })}`} />
            <Row
              delay={0.41}
              icon={<MemoryStick className="size-4" />}
              label={t('dash.ram')}
              value={`${fmtBytes(sys.ramTotal, lang)} · ${t('dash.sticks', { n: sys.ramSticks, speed: sys.ramSpeed })}`}
            />
            <Row delay={0.44} icon={<CircuitBoard className="size-4" />} label={t('dash.board')} value={sys.board || '—'} />
            <Row delay={0.47} icon={<Monitor className="size-4" />} label={t('dash.monitor')} value={sys.resolution ? `${sys.resolution} · ${sys.refresh} Hz` : '—'} />
            <Row delay={0.5} icon={<Clock className="size-4" />} label={t('dash.uptime')} value={live ? fmtUptime(live.uptime, lang) : '—'} />
            <Row
              delay={0.53}
              icon={<HardDrive className="size-4" />}
              label={t('dash.disks')}
              value={sys.disks.map((d) => `${d.name} (${d.media === 'Unspecified' ? d.bus : d.media}, ${fmtBytes(d.size, lang)})`).join(' · ')}
            />
            <Row delay={0.56} icon={<Monitor className="size-4" />} label={t('dash.windows')} value={`${sys.os} · ${sys.build}`} />
          </div>
        )}
      </Card>

      <OneClick open={running} onClose={() => setRunning(false)} />
    </div>
  )
}
