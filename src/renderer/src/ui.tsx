import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Check, LoaderCircle } from 'lucide-react'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function Card({ className, children }: { className?: string; children: ReactNode }): ReactNode {
  return <div className={cx('rounded-2xl border border-line bg-panel/80 p-5', className)}>{children}</div>
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'soft' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'soft', size = 'md', loading, icon, className, children, disabled, ...rest }: ButtonProps): ReactNode {
  const v = {
    primary: 'ice-gradient text-slate-950 font-semibold shadow-lg shadow-sky-500/20 hover:brightness-110',
    soft: 'bg-panel2 text-text border border-line hover:border-ice/50 hover:bg-[#15213b]',
    ghost: 'text-muted hover:text-text hover:bg-panel2',
    danger: 'bg-bad/10 text-bad border border-bad/30 hover:bg-bad/20'
  }[variant]
  const s = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2.5' }[size]
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-50',
        v,
        s,
        className
      )}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

export function Toggle({
  checked,
  onChange,
  disabled,
  busy
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  busy?: boolean
}): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60',
        checked ? 'ice-gradient' : 'bg-[#1e2a45]'
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 grid size-5 place-items-center rounded-full bg-white shadow transition-all',
          checked ? 'left-[22px]' : 'left-0.5'
        )}
      >
        {busy && <LoaderCircle className="size-3.5 animate-spin text-sky-600" />}
      </span>
    </button>
  )
}

export function Checkbox({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }): ReactNode {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'grid size-5 shrink-0 place-items-center rounded-md border transition disabled:opacity-40',
        checked ? 'border-transparent ice-gradient text-slate-950' : 'border-[#2a3958] bg-panel2'
      )}
    >
      {checked && <Check className="size-3.5" strokeWidth={3} />}
    </button>
  )
}

type Tone = 'ice' | 'good' | 'warn' | 'bad' | 'muted' | 'violet'
export function Badge({ tone = 'muted', children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }): ReactNode {
  const t = {
    ice: 'bg-ice/10 text-ice border-ice/25',
    good: 'bg-good/10 text-good border-good/25',
    warn: 'bg-warn/10 text-warn border-warn/25',
    bad: 'bg-bad/10 text-bad border-bad/25',
    muted: 'bg-white/5 text-muted border-white/10',
    violet: 'bg-violet/10 text-[#a78bfa] border-violet/30'
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

export function scoreColor(v: number): string {
  if (v >= 90) return '#34d399'
  if (v >= 75) return '#38bdf8'
  if (v >= 55) return '#fbbf24'
  return '#f87171'
}

export function Ring({ value, size = 180, stroke = 14, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }): ReactNode {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = scoreColor(value)
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#18233b" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s', filter: `drop-shadow(0 0 10px ${color}55)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

export function Sparkline({ data, color, max = 100, height = 44 }: { data: number[]; color: string; max?: number; height?: number }): ReactNode {
  const w = 200
  const n = 60
  const pts = data.slice(-n)
  if (pts.length < 2) return <div style={{ height }} />
  const step = w / (n - 1)
  const off = (n - pts.length) * step
  const y = (v: number): number => height - 2 - (Math.min(max, Math.max(0, v)) / max) * (height - 4)
  const line = pts.map((v, i) => `${(off + i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const id = `g${color.replace('#', '')}`
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${off},${height} ${line} ${w},${height}`} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

export function Bar({ value, color = '#38bdf8' }: { value: number; color?: string }): ReactNode {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#18233b]">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  )
}

export function Modal({ open, onClose, children }: { open: boolean; onClose?: () => void; children: ReactNode }): ReactNode {
  useEffect(() => {
    if (!open || !onClose) return
    const h = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="fade-up w-[460px] max-w-[92vw] rounded-2xl border border-line bg-panel p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }): ReactNode {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-[420px] flex-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Logo({ size = 28 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.45" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#logo-g)" />
      <path d="M36 9 L18 36 H30 L26 55 L46 26 H33 Z" fill="#06101f" />
    </svg>
  )
}
