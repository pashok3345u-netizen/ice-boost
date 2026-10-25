import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react'
import { Check, LoaderCircle } from 'lucide-react'
import { C, scoreColor } from './theme'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/** Smoothly counts a number from its previous value to the new one. */
export function useCountUp(target: number, duration = 900, startFrom?: number): number {
  const [value, setValue] = useState(startFrom ?? target)
  const current = useRef(startFrom ?? target)
  useEffect(() => {
    const from = current.current
    if (from === target) return
    const t0 = performance.now()
    let raf = 0
    const step = (t: number): void => {
      const p = Math.min(1, (t - t0) / duration)
      const v = from + (target - from) * (1 - Math.pow(1 - p, 3))
      current.current = v
      setValue(v)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

export function CountUp({ value, format, duration }: { value: number; format?: (v: number) => string; duration?: number }): ReactNode {
  const v = useCountUp(value, duration, 0)
  return <>{format ? format(v) : Math.round(v)}</>
}

export function Card({
  className,
  children,
  hover,
  delay = 0
}: {
  className?: string
  children: ReactNode
  hover?: boolean
  delay?: number
}): ReactNode {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cx('card rounded-2xl border border-line p-5', hover && 'card-hover', className)}
    >
      {children}
    </motion.div>
  )
}

type ButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: 'primary' | 'soft' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  children?: ReactNode
}

export function Button({ variant = 'soft', size = 'md', loading, icon, className, children, disabled, ...rest }: ButtonProps): ReactNode {
  const v = {
    primary: 'accent-gradient shine text-[#1a1a1f] font-semibold shadow-lg shadow-teal/30 hover:brightness-110',
    soft: 'bg-panel2 text-text border border-line hover:border-ice/50 hover:bg-[#3a3a43]',
    ghost: 'text-muted hover:text-text hover:bg-panel2',
    danger: 'bg-bad/10 text-bad border border-bad/30 hover:bg-bad/20'
  }[variant]
  const s = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2.5' }[size]
  const off = disabled || loading
  return (
    <motion.button
      whileHover={off ? undefined : { y: -1 }}
      whileTap={off ? undefined : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      {...rest}
      disabled={off}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        v,
        s,
        className
      )}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : icon}
      {children}
    </motion.button>
  )
}

export function Toggle({
  checked,
  onChange,
  disabled,
  busy
}: {
  checked: boolean
  onChange: (v: boolean, e: React.MouseEvent) => void
  disabled?: boolean
  busy?: boolean
}): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled || busy}
      onClick={(e) => onChange(!checked, e)}
      className={cx(
        'relative flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-300 disabled:opacity-60',
        checked ? 'justify-end bg-teal shadow-[0_0_16px_-2px_rgba(82,138,154,0.8)]' : 'justify-start bg-[#45454f]'
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 700, damping: 32 }}
        className="grid size-6 place-items-center rounded-full bg-frost shadow"
      >
        {busy ? (
          <LoaderCircle className="size-3.5 animate-spin text-teal" />
        ) : (
          checked && <Check className="size-3.5 text-teal" strokeWidth={3} />
        )}
      </motion.span>
    </button>
  )
}

export function Checkbox({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }): ReactNode {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      whileTap={{ scale: 0.85 }}
      onClick={() => onChange(!checked)}
      className={cx(
        'grid size-5 shrink-0 place-items-center rounded-md border transition-colors disabled:opacity-40',
        checked ? 'border-transparent bg-teal text-frost' : 'border-[#4a4a55] bg-panel2'
      )}
    >
      <AnimatePresence>
        {checked && (
          <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
            <Check className="size-3.5" strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

type Tone = 'ice' | 'good' | 'warn' | 'bad' | 'muted' | 'frost'
export function Badge({ tone = 'muted', children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }): ReactNode {
  const t = {
    ice: 'bg-teal/15 text-ice border-teal/40',
    good: 'bg-good/10 text-good border-good/30',
    warn: 'bg-warn/10 text-warn border-warn/30',
    bad: 'bg-bad/10 text-bad border-bad/30',
    muted: 'bg-white/5 text-muted border-white/10',
    frost: 'bg-frost/10 text-frost border-frost/25'
  }[tone]
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap', t)}>
      {icon}
      {children}
    </span>
  )
}

export function Spinner({ className }: { className?: string }): ReactNode {
  return <LoaderCircle className={cx('size-5 animate-spin text-ice', className)} />
}

export function Ring({ value, size = 180, stroke = 14, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }): ReactNode {
  const r = (size - stroke) / 2
  const color = scoreColor(value)
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* slowly rotating dashed outer ring */}
      <svg width={size} height={size} className="spin-slow absolute inset-0 opacity-40">
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 1.5} fill="none" stroke={C.ice} strokeWidth="1" strokeDasharray="2 9" />
      </svg>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r - 6} fill="none" stroke="#33333b" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r - 6}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * (r - 6)}
          initial={{ strokeDashoffset: 2 * Math.PI * (r - 6) }}
          animate={{ strokeDashoffset: 2 * Math.PI * (r - 6) * (1 - v / 100), stroke: color }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 12px ${color}88)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

export function Sparkline({
  data, color, min = 0, max = 100, height = 44, points = 60
}: { data: number[]; color: string; min?: number; max?: number; height?: number; points?: number }): ReactNode {
  const w = 200
  const n = points
  const pts = data.slice(-n)
  if (pts.length < 2) return <div style={{ height }} />
  const step = w / (n - 1)
  const off = (n - pts.length) * step
  const y = (v: number): number => height - 3 - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * (height - 6)
  const line = pts.map((v, i) => `${(off + i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  const id = `g${color.replace('#', '')}`
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full overflow-visible" style={{ height }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${off},${height} ${line} ${w},${height}`} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={w} cy={y(last)} r="3" fill={color} vectorEffect="non-scaling-stroke">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

export function Bar({ value, color = C.ice, height = 6 }: { value: number; color?: string; height?: number }): ReactNode {
  return (
    <div className="w-full overflow-hidden rounded-full bg-[#3a3a43]" style={{ height }}>
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: `linear-gradient(90deg, ${color}aa, ${color})` }}
      />
    </div>
  )
}

export function Modal({ open, onClose, children, wide, xl }: { open: boolean; onClose?: () => void; children: ReactNode; wide?: boolean; xl?: boolean }): ReactNode {
  useEffect(() => {
    if (!open || !onClose) return
    const h = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/55 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className={cx('card max-w-[92vw] rounded-2xl border border-line bg-panel p-6 shadow-2xl', xl ? 'w-[820px]' : wide ? 'w-[560px]' : 'w-[460px]')}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle?: string; actions?: ReactNode; icon?: ReactNode }): ReactNode {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <motion.div
        className="min-w-[420px] flex-1"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="font-display flex items-center gap-3 text-2xl font-semibold tracking-tight">
          {icon && <span className="grid size-9 place-items-center rounded-xl bg-teal/20 text-ice">{icon}</span>}
          <span className="frost-text">{title}</span>
        </h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </motion.div>
      {actions && (
        <motion.div
          className="flex shrink-0 flex-wrap items-center gap-2"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
        >
          {actions}
        </motion.div>
      )}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }): ReactNode {
  return <div className={cx('skeleton rounded-xl', className)} />
}

export function Logo({ size = 28 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A9D0D8" />
          <stop offset="0.5" stopColor="#7DB4C2" />
          <stop offset="1" stopColor="#3F6F7C" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#logo-g)" />
      <path d="M36 9 L18 36 H30 L26 55 L46 26 H33 Z" fill="#25252B" />
    </svg>
  )
}
