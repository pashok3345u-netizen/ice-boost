// Disk map picture: every folder/file is a tile, its area = the space it takes ("squarified" treemap).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Lock } from 'lucide-react'
import { cx } from '../../ui'

export interface Tile {
  key: string
  size: number
  label: string
  sub: string
  color: string
  /** light tile → dark text */
  light?: boolean
  striped?: boolean
  locked?: boolean
  clickable?: boolean
}

interface Placed extends Tile {
  x: number
  y: number
  w: number
  h: number
}

/** Bruls' squarified layout: rows of tiles along the shorter side, keeping them as square as possible. */
function squarify(tiles: Tile[], width: number, height: number): Placed[] {
  const items = tiles.filter((t) => t.size > 0).sort((a, b) => b.size - a.size)
  const total = items.reduce((s, t) => s + t.size, 0)
  if (total <= 0 || width <= 0 || height <= 0) return []
  const scale = (width * height) / total
  const out: Placed[] = []
  let x = 0
  let y = 0
  let w = width
  let h = height
  let row: { t: Tile; area: number }[] = []

  const worst = (r: { area: number }[], side: number): number => {
    const sum = r.reduce((s, i) => s + i.area, 0)
    let max = 0
    let min = Infinity
    for (const i of r) {
      max = Math.max(max, i.area)
      min = Math.min(min, i.area)
    }
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min))
  }

  const flush = (): void => {
    const sum = row.reduce((s, i) => s + i.area, 0)
    if (w >= h) {
      const rw = sum / h
      let yy = y
      for (const i of row) {
        const rh = i.area / rw
        out.push({ ...i.t, x, y: yy, w: rw, h: rh })
        yy += rh
      }
      x += rw
      w -= rw
    } else {
      const rh = sum / w
      let xx = x
      for (const i of row) {
        const rw = i.area / rh
        out.push({ ...i.t, x: xx, y, w: rw, h: rh })
        xx += rw
      }
      y += rh
      h -= rh
    }
    row = []
  }

  for (const t of items) {
    const next = { t, area: t.size * scale }
    const side = Math.min(w, h)
    if (row.length === 0 || worst([...row, next], side) <= worst(row, side)) row.push(next)
    else {
      flush()
      row.push(next)
    }
  }
  if (row.length) flush()
  return out
}

export function Treemap({
  tiles,
  height,
  levelKey,
  active,
  onPick,
  onHover
}: {
  tiles: Tile[]
  height: number
  /** changes when you go into another folder — the tiles animate in again */
  levelKey: string
  active: string | null
  onPick: (key: string) => void
  onHover: (key: string | null) => void
}): ReactNode {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const placed = useMemo(() => squarify(tiles, width, height), [tiles, width, height])

  return (
    <div ref={ref} className="relative overflow-hidden rounded-xl" style={{ height }} onMouseLeave={() => onHover(null)}>
      {placed.map((p, i) => (
        <motion.button
          key={`${levelKey}|${p.key}`}
          type="button"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: Math.min(i, 24) * 0.012, ease: [0.22, 1, 0.36, 1] }}
          style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
          className={cx('absolute p-[2px] text-left', p.clickable ? 'cursor-pointer' : 'cursor-default')}
          onClick={() => p.clickable && onPick(p.key)}
          onMouseEnter={() => onHover(p.key)}
        >
          <div
            className={cx(
              'relative h-full w-full overflow-hidden rounded-[7px] px-2 py-1.5 transition-[filter,box-shadow] duration-150',
              p.striped && 'stripes',
              active === p.key ? 'brightness-125 shadow-[inset_0_0_0_2px_rgba(217,231,232,0.85)]' : 'hover:brightness-115',
              p.light ? 'text-[#1d1d22]' : 'text-frost'
            )}
            style={{ background: p.color }}
          >
            {p.w > 74 && p.h > 36 && (
              <>
                <div className="truncate text-xs font-semibold">{p.label}</div>
                <div className="truncate text-[11px] opacity-75 tabular-nums">{p.sub}</div>
              </>
            )}
            {p.locked && p.w > 30 && p.h > 24 && <Lock className="absolute right-1.5 bottom-1.5 size-3 opacity-55" />}
          </div>
        </motion.button>
      ))}
    </div>
  )
}
