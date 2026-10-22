// Falling snow behind the page, snow/confetti bursts and the secret blizzard — same as in the app.
// Drawn on <canvas> at ~30 fps, pauses when the tab is hidden, off for "reduce motion" users.
import { useEffect, useRef, type ReactNode } from 'react'

const FROST = '#D9E7E8'
const BURST_COLORS = ['#528A9A', '#7DB4C2', '#D9E7E8', '#86C9A8', '#E5BD7A']

export function burst(opts: { x?: number; y?: number; big?: boolean } = {}): void {
  window.dispatchEvent(new CustomEvent('ice-burst', { detail: opts }))
}

export function blizzard(): void {
  window.dispatchEvent(new CustomEvent('ice-blizzard'))
}

const calm = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function useCanvasLoop(draw: (ctx: CanvasRenderingContext2D, w: number, h: number, dt: number) => void): React.RefObject<HTMLCanvasElement | null> {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let last = performance.now()
    let acc = 0
    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const loop = (t: number): void => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(100, t - last)
      last = t
      acc += dt
      if (acc < 33 || document.hidden) return
      drawRef.current(ctx, canvas.clientWidth, canvas.clientHeight, acc / 16.7)
      acc = 0
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])
  return ref
}

const rand = (a: number, b: number): number => a + Math.random() * (b - a)

interface Flake {
  x: number
  y: number
  r: number
  vy: number
  vx: number
  phase: number
  alpha: number
}

function makeFlake(w: number, h: number, top = false, storm = false): Flake {
  return {
    x: rand(0, w),
    y: top ? rand(-40, -5) : rand(0, h),
    r: storm ? rand(1, 3.4) : rand(0.6, 2.2),
    vy: storm ? rand(2.2, 5) : rand(0.25, 0.8),
    vx: storm ? rand(2, 5) : rand(-0.15, 0.15),
    phase: rand(0, Math.PI * 2),
    alpha: rand(0.12, storm ? 0.9 : 0.45)
  }
}

/** Gentle snow over the whole window (fixed, behind content). */
export function Snow(): ReactNode {
  const flakes = useRef<Flake[]>([])
  const storm = useRef(0)

  useEffect(() => {
    const onStorm = (): void => {
      storm.current = 6000
    }
    window.addEventListener('ice-blizzard', onStorm)
    return () => window.removeEventListener('ice-blizzard', onStorm)
  }, [])

  const ref = useCanvasLoop((ctx, w, h, dt) => {
    ctx.clearRect(0, 0, w, h)
    if (calm() && storm.current <= 0) {
      flakes.current = []
      return
    }
    const base = w < 640 ? 26 : 50
    const target = storm.current > 0 ? 340 : base
    while (flakes.current.length < target) flakes.current.push(makeFlake(w, h, flakes.current.length > base, storm.current > 0))
    if (storm.current > 0) storm.current -= dt * 16.7
    ctx.fillStyle = FROST
    const next: Flake[] = []
    for (const f of flakes.current) {
      f.phase += 0.02 * dt
      f.y += f.vy * dt
      f.x += (f.vx + Math.sin(f.phase) * 0.25) * dt
      if (f.y > h + 5 || f.x > w + 20) {
        if (next.length < target) next.push(makeFlake(w, h, true, storm.current > 0))
        continue
      }
      next.push(f)
      ctx.globalAlpha = f.alpha
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    flakes.current = next
  })
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0 h-full w-full" />
}

interface Bit {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  size: number
  color: string
  life: number
  snow: boolean
}

/** Full-window layer for confetti bursts (on top of everything, ignores clicks). */
export function BurstLayer(): ReactNode {
  const bits = useRef<Bit[]>([])

  useEffect(() => {
    const onBurst = (e: Event): void => {
      if (calm()) return
      const d = (e as CustomEvent<{ x?: number; y?: number; big?: boolean }>).detail ?? {}
      const x = d.x ?? window.innerWidth / 2
      const y = d.y ?? window.innerHeight / 2.6
      const n = d.big ? 140 : 36
      const power = d.big ? 13 : 7
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2)
        const s = rand(power * 0.3, power)
        bits.current.push({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - (d.big ? 5 : 3),
          rot: rand(0, Math.PI),
          vr: rand(-0.3, 0.3),
          size: rand(4, d.big ? 9 : 7),
          color: BURST_COLORS[i % BURST_COLORS.length],
          life: 1,
          snow: Math.random() < 0.3
        })
      }
    }
    window.addEventListener('ice-burst', onBurst)
    return () => window.removeEventListener('ice-burst', onBurst)
  }, [])

  const ref = useCanvasLoop((ctx, w, h, dt) => {
    ctx.clearRect(0, 0, w, h)
    if (bits.current.length === 0) return
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    bits.current = bits.current.filter((b) => {
      b.vy += 0.35 * dt
      b.vx *= 0.985
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.rot += b.vr * dt
      b.life -= 0.012 * dt
      if (b.life <= 0 || b.y > h + 20) return false
      ctx.save()
      ctx.globalAlpha = Math.min(1, b.life * 1.5)
      ctx.translate(b.x, b.y)
      ctx.rotate(b.rot)
      if (b.snow) {
        ctx.fillStyle = FROST
        ctx.font = `${b.size * 2.2}px "Segoe UI Symbol", sans-serif`
        ctx.fillText('❄', 0, 0)
      } else {
        ctx.fillStyle = b.color
        ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2)
      }
      ctx.restore()
      return true
    })
  })
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[80] h-full w-full" />
}
