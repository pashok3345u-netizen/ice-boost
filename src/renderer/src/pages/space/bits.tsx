// Small pieces shared by the Disk Space tabs.
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Trash2 } from 'lucide-react'
import { Button, cx } from '../../ui'

export function Chip({
  active, onClick, children, count, icon
}: { active: boolean; onClick: () => void; children: ReactNode; count?: number | string; icon?: ReactNode }): ReactNode {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cx(
        'inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm whitespace-nowrap transition-colors',
        active ? 'border-teal/70 bg-teal/25 text-frost' : 'border-line bg-panel2/70 text-muted hover:border-teal/50 hover:text-text'
      )}
    >
      {icon}
      {children}
      {count !== undefined && <span className={cx('text-xs tabular-nums', active ? 'text-ice' : 'text-muted/70')}>{count}</span>}
    </motion.button>
  )
}

/** Thin progress line with a text, shown while a scan runs. */
export function ScanLine({ text, progress, sub }: { text: string; progress: number; sub?: string }): ReactNode {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="mb-3 rounded-xl border border-teal/30 bg-teal/10 px-4 py-2.5">
        <div className="flex items-center gap-3 text-sm">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-ice opacity-70" />
            <span className="relative inline-flex size-2.5 rounded-full bg-ice" />
          </span>
          <span className="flex-1 truncate">{text}</span>
        </div>
        {sub && <div className="mt-1 truncate pl-5.5 font-mono text-[11px] text-muted/70">{sub}</div>}
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#3a3a43]">
          {progress > 0 ? (
            <motion.div className="accent-gradient h-full rounded-full" animate={{ width: `${Math.min(100, progress * 100)}%` }} transition={{ duration: 0.4 }} />
          ) : (
            <div className="skeleton h-full w-full" />
          )}
        </div>
      </div>
    </motion.div>
  )
}

/** Sticks to the bottom of the page while something is picked. */
export function SelectionBar({
  open, text, clearText, actionText, onClear, onAction, busy
}: {
  open: boolean
  text: string
  clearText: string
  actionText: string
  onClear: () => void
  onAction: () => void
  busy?: boolean
}): ReactNode {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className="sticky bottom-0 z-20 pt-3"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-teal/50 bg-panel/95 px-5 py-3 shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur">
            <span className="font-display flex-1 text-sm font-semibold">{text}</span>
            <Button variant="ghost" size="sm" onClick={onClear}>
              {clearText}
            </Button>
            <Button variant="danger" icon={<Trash2 className="size-4" />} loading={busy} onClick={onAction}>
              {actionText}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
