import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { motion } from 'motion/react'
import {
  Activity, BellRing, Cpu, Fan, Flame, Gpu as GpuIcon, MemoryStick, Plug, RotateCcw, ShieldCheck, Thermometer, TriangleAlert, Zap
} from 'lucide-react'
import type { GpuSensors } from '../../../shared/types'
import { checkGpu, tempLevel, tempZones, voltLevel, VOLT, type GpuAlert, type GpuLevel } from '../../../shared/gpu'
import { useStore } from '../store'
import { Badge, Button, Card, CountUp, PageHeader, Skeleton, Sparkline } from '../ui'
import { C } from '../theme'

export const LEVEL_COLOR: Record<GpuLevel, string> = { ok: C.good, warm: C.ice, hot: C.warn, danger: C.bad }

/** 0.762 → "0,762" in Russian */
export function num(v: number, digits: number, lang: string): string {
  const s = v.toFixed(digits)
  return lang === 'ru' ? s.replace('.', ',') : s
}

export function gpuAlertText(t: TFunction, a: GpuAlert, s: GpuSensors, lang: string): string {
  const v = a.id === 'volt' ? num(s.voltage ?? 0, 3, lang) : String(Math.round((a.id === 'hotspot' ? s.hotspot : s.temp) ?? 0))
  return t(`gpu.alert.${a.id}`, { v })
}

// ---- round gauge with colored zones

const START = 135 // degrees from "3 o'clock", clockwise: the arc starts bottom-left
const SWEEP = 270

function polar(c: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [c + r * Math.cos(a), c + r * Math.sin(a)]
}

function arc(c: number, r: number, from: number, to: number): string {
  const [x0, y0] = polar(c, r, from)
  const [x1, y1] = polar(c, r, to)
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

function Gauge({
  value, min, max, zones, color, labels, children, size = 220
}: {
  value: number | null
  min: number
  max: number
  zones: { from: number; to: number; color: string }[]
  color: string
  labels: [string, string]
  children: ReactNode
  size?: number
}): ReactNode {
  const c = size / 2
  const r = c - 20
  const clamp = (v: number): number => Math.max(min, Math.min(max, v))
  const ang = (v: number): number => START + ((clamp(v) - min) / (max - min)) * SWEEP
  const frac = value == null ? 0 : (clamp(value) - min) / (max - min)
  const [lx, ly] = polar(c, r, START)
  const [rx, ry] = polar(c, r, START + SWEEP)
  const track = arc(c, r, START, START + SWEEP)
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 overflow-visible">
        {zones.map((z) => (
          <path key={z.from} d={arc(c, r + 13, ang(z.from), ang(z.to))} stroke={z.color} strokeOpacity={0.6} strokeWidth={3} fill="none" />
        ))}
        <path d={track} stroke="#33333b" strokeWidth={14} strokeLinecap="round" fill="none" />
        <motion.path
          d={track}
          stroke={color}
          strokeWidth={14}
          strokeLinecap="round"
          fill="none"
          pathLength={1}
          strokeDasharray="1 1"
          initial={{ strokeDashoffset: 1 }}
          animate={{ strokeDashoffset: 1 - frac, stroke: color, opacity: frac > 0.005 ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 70, damping: 18 }}
          style={{ filter: `drop-shadow(0 0 10px ${color}88)` }}
        />
        <text x={lx} y={ly + 26} textAnchor="middle" className="fill-muted text-[11px]">
          {labels[0]}
        </text>
        <text x={rx} y={ry + 26} textAnchor="middle" className="fill-muted text-[11px]">
          {labels[1]}
        </text>
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

function Mini({
  icon, label, value, unit, sub, color = C.ice, delay
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  unit?: string
  sub?: string
  color?: string
  delay: number
}): ReactNode {
  return (
    <Card hover delay={delay} className="flex min-w-0 flex-col gap-2 p-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="grid size-6 place-items-center rounded-md" style={{ color, background: `${color}22` }}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className="font-display truncate text-xl font-semibold tabular-nums" style={{ color: color === C.ice ? undefined : color }}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted">{unit}</span>}
      </div>
      {sub && (
        <div className="line-clamp-2 text-[11px] leading-snug text-muted" title={sub}>
          {sub}
        </div>
      )}
    </Card>
  )
}

export function Gpu(): ReactNode {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { gpu, live, resetGpuMax } = useStore()
  const s = gpu?.now ?? null

  const header = <PageHeader icon={<GpuIcon className="size-5" />} title={t('gpu.title')} subtitle={t('gpu.subtitle')} />

  if (gpu && !gpu.supported) {
    return (
      <div>
        {header}
        <Card className="grid place-items-center py-14 text-center">
          <GpuIcon className="mb-4 size-12 text-muted" />
          <div className="font-display text-lg font-semibold">{t('gpu.unsupported')}</div>
          <p className="mt-2 max-w-md text-sm text-muted">{t('gpu.unsupportedText')}</p>
        </Card>
      </div>
    )
  }

  if (!s) {
    return (
      <div>
        {header}
        <Skeleton className="mb-5 h-28" />
        <div className="grid grid-cols-2 gap-5">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
        <p className="mt-4 text-center text-sm text-muted">{t('gpu.waiting')}</p>
      </div>
    )
  }

  const { level, alerts } = checkGpu(s)
  const color = LEVEL_COLOR[level]
  const z = tempZones(s.maxTemp)
  const tColor = s.temp == null ? C.muted : LEVEL_COLOR[tempLevel(s.temp, s.maxTemp)]
  const vColor = s.voltage == null ? C.muted : LEVEL_COLOR[voltLevel(s.voltage)]
  const statusIcon = { ok: <ShieldCheck className="size-8" />, warm: <Thermometer className="size-8" />, hot: <Flame className="size-8" />, danger: <TriangleAlert className="size-8" /> }[level]
  const fan = s.fanRpm ?? s.fanPct
  const fanStuck = alerts.some((a) => a.id === 'fan')
  const max = gpu!.max
  // the chart fills the whole width and grows up to 5 minutes as readings come in
  const chartPoints = Math.min(150, Math.max(10, gpu!.history.temp.length))

  return (
    <div className="space-y-5">
      {header}

      <Card className="relative overflow-hidden">
        <motion.div
          className="pointer-events-none absolute -top-24 -left-10 size-72 rounded-full blur-3xl"
          animate={{ background: color, opacity: level === 'danger' ? [0.2, 0.45, 0.2] : 0.18 }}
          transition={{ opacity: { duration: 1.2, repeat: Infinity }, background: { duration: 0.8 } }}
        />
        <div className="relative flex items-center gap-5">
          <motion.span
            className="grid size-16 shrink-0 place-items-center rounded-2xl"
            style={{ color, background: `${color}22` }}
            animate={level === 'danger' ? { scale: [1, 1.1, 1] } : { scale: 1 }}
            transition={{ duration: 0.9, repeat: level === 'danger' ? Infinity : 0 }}
          >
            {statusIcon}
          </motion.span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-2xl font-semibold" style={{ color }}>
              {t(`gpu.status.${level}`)}
            </div>
            <p className="mt-1 text-sm text-muted">{t(`gpu.statusText.${level}`, { hot: z.hot })}</p>
            {alerts.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {alerts.map((a) => (
                  <Badge key={a.id} tone={a.level === 'danger' ? 'bad' : 'warn'} icon={<TriangleAlert className="size-3" />}>
                    {gpuAlertText(t, a, s, lang)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm">{s.name}</div>
            <div className="mt-1">
              <Badge tone="ice">{s.vendor === 'amd' ? 'AMD Radeon' : 'NVIDIA GeForce'}</Badge>
            </div>
          </div>
        </div>
        {(level === 'hot' || level === 'danger') && (
          <div className="relative mt-4 rounded-xl border border-line bg-panel2/60 p-4">
            <div className="mb-2 text-xs font-medium tracking-wider text-muted uppercase">{t('gpu.tips')}</div>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {(t('gpu.tipList', { returnObjects: true }) as string[]).map((x) => (
                <li key={x} className="flex gap-2">
                  <span style={{ color }}>•</span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-5">
        <Card delay={0.05} className="flex flex-col items-center">
          <h2 className="font-display mb-2 flex items-center gap-2 self-start text-sm font-semibold">
            <Thermometer className="size-4 text-ice" />
            {t('gpu.temp')}
          </h2>
          <Gauge
            value={s.temp}
            min={20}
            max={z.max + 10}
            color={tColor}
            labels={['20°', `${z.max + 10}°`]}
            zones={[
              { from: 20, to: z.warm, color: C.good },
              { from: z.warm, to: z.hot, color: C.ice },
              { from: z.hot, to: z.danger, color: C.warn },
              { from: z.danger, to: z.max + 10, color: C.bad }
            ]}
          >
            <div className="text-center">
              <div className="font-display text-5xl font-bold tabular-nums" style={{ color: tColor }}>
                {s.temp == null ? '—' : <CountUp value={Math.round(s.temp)} duration={600} />}
                <span className="text-2xl">°C</span>
              </div>
              <div className="mt-1 text-[11px] text-muted">{t('gpu.limit', { v: z.max })}</div>
              {s.hotspot != null && <div className="text-[11px] text-muted">{t('gpu.hotspotNow', { v: Math.round(s.hotspot) })}</div>}
            </div>
          </Gauge>
          <div className="mt-1 w-full">
            <Sparkline data={gpu!.history.temp} color={tColor} min={20} max={z.max + 10} points={chartPoints} />
          </div>
        </Card>

        <Card delay={0.1} className="flex flex-col items-center">
          <h2 className="font-display mb-2 flex items-center gap-2 self-start text-sm font-semibold">
            <Zap className="size-4 text-ice" />
            {t('gpu.voltage')}
          </h2>
          <Gauge
            value={s.voltage}
            min={0.6}
            max={1.4}
            color={vColor}
            labels={[`${num(0.6, 1, lang)} ${t('gpu.volt')}`, `${num(1.4, 1, lang)} ${t('gpu.volt')}`]}
            zones={[
              { from: 0.6, to: VOLT.high, color: C.good },
              { from: VOLT.high, to: VOLT.danger, color: C.warn },
              { from: VOLT.danger, to: 1.4, color: C.bad }
            ]}
          >
            {s.voltage == null ? (
              <p className="max-w-[150px] text-center text-xs text-muted">{t('gpu.noVolt')}</p>
            ) : (
              <div className="text-center">
                <div className="font-display text-4xl font-bold tabular-nums" style={{ color: vColor }}>
                  <CountUp value={s.voltage} duration={600} format={(v) => num(v, 3, lang)} />
                  <span className="ml-1 text-xl">{t('gpu.volt')}</span>
                </div>
                <div className="mt-1 text-[11px] text-muted">{t('gpu.voltNote', { v: num(VOLT.high, 2, lang) })}</div>
              </div>
            )}
          </Gauge>
          <div className="mt-1 w-full">
            <Sparkline data={gpu!.history.voltage} color={vColor} min={0.6} max={1.4} points={chartPoints} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Mini delay={0.15} icon={<Activity className="size-3.5" />} label={t('gpu.load')} value={live?.gpu != null ? Math.round(live.gpu) : '—'} unit={live?.gpu != null ? '%' : undefined} />
        <Mini delay={0.18} icon={<Cpu className="size-3.5" />} label={t('gpu.core')} value={s.core != null ? Math.round(s.core) : '—'} unit={s.core != null ? t('gpu.mhz') : undefined} />
        <Mini delay={0.21} icon={<MemoryStick className="size-3.5" />} label={t('gpu.mem')} value={s.mem != null ? Math.round(s.mem) : '—'} unit={s.mem != null ? t('gpu.mhz') : undefined} />
        {fan == null ? (
          <Mini delay={0.24} icon={<Fan className="size-3.5" />} label={t('gpu.fan')} value="—" />
        ) : fan === 0 ? (
          <Mini
            delay={0.24}
            icon={<Fan className="size-3.5" />}
            label={t('gpu.fan')}
            value={fanStuck ? t('gpu.fanStuck') : t('gpu.fanRest')}
            sub={fanStuck ? undefined : t('gpu.fanRestHint')}
            color={fanStuck ? C.bad : C.ice}
          />
        ) : (
          <Mini
            delay={0.24}
            icon={<Fan className="size-3.5 animate-spin [animation-duration:1.4s]" />}
            label={t('gpu.fan')}
            value={s.fanRpm ?? s.fanPct}
            unit={s.fanRpm != null ? t('gpu.rpm') : '%'}
            sub={s.fanRpm != null && s.fanPct != null ? `${s.fanPct}%` : undefined}
          />
        )}
        <Mini delay={0.27} icon={<Plug className="size-3.5" />} label={t('gpu.power')} value={s.power != null ? Math.round(s.power) : '—'} unit={s.power != null ? t('gpu.watt') : undefined} />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Card delay={0.3}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display flex items-center gap-2 text-sm font-semibold">
              <Flame className="size-4 text-ice" />
              {t('gpu.peaks')}
            </h2>
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => void resetGpuMax()}>
              {t('gpu.reset')}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('gpu.temp'), text: max.temp != null ? `${Math.round(max.temp)}°C` : '—', color: max.temp != null ? LEVEL_COLOR[tempLevel(max.temp, s.maxTemp)] : C.muted },
              { label: t('gpu.voltage'), text: max.voltage != null ? `${num(max.voltage, 3, lang)} ${t('gpu.volt')}` : '—', color: max.voltage != null ? LEVEL_COLOR[voltLevel(max.voltage)] : C.muted },
              { label: t('gpu.power'), text: max.power != null ? `${Math.round(max.power)} ${t('gpu.watt')}` : '—', color: C.frost }
            ].map((x) => (
              <div key={x.label} className="rounded-xl border border-line bg-panel2/60 px-3 py-3">
                <div className="text-[11px] text-muted">{x.label}</div>
                <div className="font-display mt-1 text-lg font-semibold tabular-nums" style={{ color: x.color }}>
                  {x.text}
                </div>
              </div>
            ))}
          </div>
          {max.hotspot != null && <p className="mt-2 text-xs text-muted">{t('gpu.hotspotNow', { v: Math.round(max.hotspot) })}</p>}
          <p className="mt-3 text-xs text-muted">{t('gpu.peaksHint')}</p>
          <div className="mt-4 flex gap-2.5 rounded-xl border border-teal/30 bg-teal/10 p-3 text-xs leading-relaxed">
            <BellRing className="mt-0.5 size-4 shrink-0 text-ice" />
            <span>
              <span className="font-semibold text-frost">{t('gpu.notify')}. </span>
              {t('gpu.notifyText')}
            </span>
          </div>
        </Card>

        <Card delay={0.35}>
          <h2 className="font-display mb-3 flex items-center gap-2 text-sm font-semibold">
            <Thermometer className="size-4 text-ice" />
            {t('gpu.scale')}
          </h2>
          <ul className="space-y-1.5 text-sm">
            {(t('gpu.scaleTemp', { returnObjects: true, warm: z.warm, hot: z.hot, danger: z.danger }) as string[]).map((x, i) => (
              <li key={x} className="flex items-center gap-2.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: [C.good, C.ice, C.warn, C.bad][i] }} />
                {x}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-muted">{t('gpu.scaleVolt', { v: num(VOLT.high, 1, lang) })}</p>
        </Card>
      </div>
    </div>
  )
}
