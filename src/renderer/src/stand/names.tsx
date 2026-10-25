// How parts look in text: icons, names made from specs, spec lines, prices, compatibility lines.
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { CircuitBoard, Cpu, Fan, Gpu as GpuIcon, HardDrive, MemoryStick, OctagonAlert, PcCase, Plug, TriangleAlert } from 'lucide-react'
import { cx } from '../ui'
import type { Part, Slot } from './catalog'
import type { Issue } from './check'

export const ICON: Record<Slot, ReactNode> = {
  cpu: <Cpu className="size-[18px]" />,
  cooler: <Fan className="size-[18px]" />,
  gpu: <GpuIcon className="size-[18px]" />,
  ram: <MemoryStick className="size-[18px]" />,
  mobo: <CircuitBoard className="size-[18px]" />,
  storage: <HardDrive className="size-[18px]" />,
  psu: <Plug className="size-[18px]" />,
  case: <PcCase className="size-[18px]" />
}

function size(gb: number, t: TFunction): string {
  return gb >= 1000 ? t('stand.tb', { v: +(gb / 1000).toFixed(1) }) : t('stand.gb', { v: gb })
}

export function rub(v: number, lang: string): string {
  return `${Math.round(v).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US')} ₽`
}

export function partName(p: Part, t: TFunction): string {
  if (p.name) return p.name
  switch (p.slot) {
    case 'cooler':
      return t('stand.name.box')
    case 'ram':
      return t('stand.name.ram', { ddr: p.ddr ?? 4, gb: p.gb ?? 0 })
    case 'psu':
      return t('stand.name.psu', { w: p.watt ?? 0 })
    case 'storage':
      return t(`stand.name.${p.disk ?? 'sata'}`, { size: size(p.gb ?? 0, t) })
    default:
      return '—'
  }
}

export function partSpec(p: Part, t: TFunction): string {
  const bits: string[] = []
  switch (p.slot) {
    case 'cpu':
      if (p.cores) bits.push(t('stand.spec.cores', { count: p.cores }), t('stand.spec.threads', { count: p.threads ?? p.cores }))
      if (p.ghz) bits.push(t('stand.spec.ghz', { v: p.ghz }))
      if (p.socket) bits.push(p.socket)
      break
    case 'gpu':
      if (p.vram) bits.push(t('stand.spec.vram', { v: p.vram }))
      bits.push(t('stand.spec.fans', { count: p.fans ?? 2 }))
      break
    case 'ram':
      bits.push(t('stand.spec.sticks', { n: p.sticks ?? 2, per: Math.round((p.gb ?? 0) / (p.sticks || 1)), ddr: p.ddr ?? 4 }))
      if (p.mhz) bits.push(t('stand.spec.mhz', { v: p.mhz }))
      break
    case 'cooler':
      bits.push(t(`stand.spec.${p.cooler ?? 'tower'}`))
      if (p.cool) bits.push(t('stand.spec.cool', { v: p.cool }))
      break
    case 'mobo':
      if (p.chipset) bits.push(t('stand.spec.chipset', { v: p.chipset }))
      if (p.socket) bits.push(t('stand.spec.socket', { v: p.socket }))
      if (p.ddr) bits.push(`DDR${p.ddr}`)
      break
    case 'storage':
      bits.push(t(`stand.kind.${p.disk ?? 'sata'}`))
      if (p.name) bits.push(size(p.gb ?? 0, t))
      break
    case 'psu':
      if (p.name) bits.push(t('stand.spec.watt', { v: p.watt }))
      break
    case 'case':
      bits.push(t('stand.spec.case'))
      break
  }
  return bits.join(' · ')
}

export function IssueLine({ issue, onClick }: { issue: Issue; onClick?: () => void }): ReactNode {
  const { t } = useTranslation()
  const bad = issue.level === 'bad'
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cx(
        'flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left text-xs leading-relaxed transition-colors',
        bad ? 'border-bad/40 bg-bad/10 text-bad' : 'border-warn/40 bg-warn/10 text-warn',
        onClick && (bad ? 'hover:bg-bad/20' : 'hover:bg-warn/20')
      )}
    >
      {bad ? <OctagonAlert className="mt-px size-3.5 shrink-0" /> : <TriangleAlert className="mt-px size-3.5 shrink-0" />}
      <span>{t(`stand.issue.${issue.id}`, issue.vars)}</span>
    </button>
  )
}
