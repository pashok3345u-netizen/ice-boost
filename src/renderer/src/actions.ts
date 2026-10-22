import { useTranslation } from 'react-i18next'
import { useStore } from './store'
import { useProgress } from './progress'
import { CLOSEABLE } from './catalog'
import { burst } from './Fx'
import { errText } from './format'

/** "I'm going to play": closes the apps that are safe to close (the ones checked by default). */
export function useGameTime(): (e?: { clientX: number; clientY: number }) => Promise<void> {
  const { t } = useTranslation()
  const { toast } = useStore()
  const { track } = useProgress()
  return async (e) => {
    try {
      const running = await window.api.getProcesses()
      const hits = CLOSEABLE.filter((c) => c.def && running.some((p) => p.name.toLowerCase() === c.proc.toLowerCase()))
      if (hits.length === 0) {
        toast(t('dash.gameTimeNothing'), 'info')
        return
      }
      await window.api.closeApps(hits.map((c) => c.proc))
      toast(t('dash.gameTimeDone', { n: new Set(hits.map((c) => c.label)).size }))
      track({ type: 'appsClosed' })
      burst(e ? { x: e.clientX, y: e.clientY } : {})
    } catch (err) {
      toast(errText(err, t('common.uacDenied')), 'err')
    }
  }
}
