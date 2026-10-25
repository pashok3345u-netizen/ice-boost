// The "new version" bar under the title bar. Asks for updates a few seconds after start and then
// every 6 hours; the button downloads the installer, IceBoost closes, updates and opens again.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { Download, LoaderCircle, Sparkles, TriangleAlert, X } from 'lucide-react'
import type { UpdateInfo, UpdateStatus } from '../../shared/types'
import { Button } from './ui'

const FIRST_CHECK = 5_000
const EVERY = 6 * 60 * 60 * 1000

export function UpdateBanner(): ReactNode {
  const { t } = useTranslation()
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [hidden, setHidden] = useState(false)
  const [st, setSt] = useState<UpdateStatus | null>(null)
  const poll = useRef(0)

  useEffect(() => {
    const check = (): void => {
      window.api.checkUpdate().then((u) => u && setInfo(u)).catch(() => {})
    }
    const first = window.setTimeout(check, FIRST_CHECK)
    const every = window.setInterval(check, EVERY)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(every)
      window.clearInterval(poll.current)
    }
  }, [])

  const start = async (): Promise<void> => {
    if (!info) return
    await window.api.installUpdate()
    if (info.portable || !info.setupUrl) return
    window.clearInterval(poll.current)
    poll.current = window.setInterval(() => {
      window.api
        .updateStatus()
        .then((s) => {
          setSt(s)
          if (s.state === 'error' || s.state === 'idle') window.clearInterval(poll.current)
        })
        .catch(() => {})
    }, 300)
  }

  const busy = st?.state === 'downloading' || st?.state === 'installing'
  const pct = st && st.total ? Math.min(100, Math.round((st.got / st.total) * 100)) : 0

  return (
    <AnimatePresence>
      {info && !hidden && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="shrink-0 overflow-hidden bg-deep"
        >
          <div className="mx-3 mb-2 flex items-center gap-3 rounded-xl border border-teal/50 bg-gradient-to-r from-teal/25 via-teal/10 to-transparent px-4 py-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-teal/30 text-frost">
              {st?.state === 'error' ? <TriangleAlert className="size-4 text-warn" /> : <Sparkles className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-frost">
                {st?.state === 'downloading'
                  ? t('update.downloading', { p: pct })
                  : st?.state === 'installing'
                    ? t('update.installing')
                    : st?.state === 'error'
                      ? t('update.error')
                      : t('update.title', { v: info.version })}
              </div>
              {st?.state === 'downloading' ? (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#3a3a43]">
                  <motion.div className="accent-gradient h-full rounded-full" animate={{ width: `${pct}%` }} transition={{ duration: 0.25 }} />
                </div>
              ) : (
                <div className="truncate text-xs text-muted">
                  {st?.state === 'error' ? st.error : st?.state === 'installing' ? t('update.installingHint') : t('update.text')}
                  {!busy && (
                    <>
                      {' '}
                      <a href={info.url} target="_blank" rel="noreferrer" className="text-ice hover:text-frost hover:underline">
                        {st?.state === 'error' ? t('update.manual') : t('update.whatsNew')}
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>
            {!busy && st?.state !== 'error' && (
              <Button size="sm" variant="primary" icon={<Download className="size-3.5" />} onClick={() => void start()}>
                {info.portable ? t('update.download') : t('update.now')}
              </Button>
            )}
            {busy && <LoaderCircle className="size-4 shrink-0 animate-spin text-ice" />}
            {!busy && (
              <button onClick={() => setHidden(true)} title={t('update.later')} className="rounded-md p-1 text-muted transition-colors hover:bg-white/5 hover:text-text">
                <X className="size-4" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
