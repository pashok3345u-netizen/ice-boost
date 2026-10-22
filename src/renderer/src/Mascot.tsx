// "Айсик" — an ice cube mascot. Sad and melting when the PC is in bad shape,
// wears sunglasses when it's perfect. Click him for jokes; click a lot for a surprise.
import { useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { moodOf, type Mood } from './health'
import { blizzard, burst } from './Fx'
import { useProgress } from './progress'

const MOUTH: Record<Mood, string> = {
  great: 'M47 80 Q60 95 73 80',
  good: 'M48 81 Q60 91 72 81',
  ok: 'M50 85 Q60 87 70 85',
  bad: 'M50 89 Q60 80 70 89'
}

function Face({ mood }: { mood: Mood }): ReactNode {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible">
      <defs>
        <linearGradient id="ice-body" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#F2F8F8" />
          <stop offset="0.45" stopColor="#B9D8DE" />
          <stop offset="1" stopColor="#528A9A" />
        </linearGradient>
      </defs>
      {/* puddle when melting */}
      {mood === 'bad' && <ellipse cx="60" cy="108" rx="36" ry="5" fill="#7DB4C2" opacity="0.35" />}
      <rect x="22" y="30" width="76" height="72" rx="20" fill="url(#ice-body)" stroke="#D9E7E8" strokeOpacity="0.6" strokeWidth="1.5" />
      <rect x="31" y="37" width="30" height="9" rx="4.5" fill="#fff" opacity="0.55" />
      <rect x="66" y="37" width="8" height="9" rx="4" fill="#fff" opacity="0.35" />
      <path d="M92 18 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" fill="#D9E7E8" opacity="0.9">
        <animateTransform attributeName="transform" type="rotate" from="0 92 26.5" to="360 92 26.5" dur="6s" repeatCount="indefinite" />
      </path>

      {mood === 'bad' && (
        <>
          {/* worried brows: inner ends raised */}
          <path d="M39 56 Q45 55 51 51" fill="none" stroke="#25252B" strokeWidth="3" strokeLinecap="round" />
          <path d="M81 56 Q75 55 69 51" fill="none" stroke="#25252B" strokeWidth="3" strokeLinecap="round" />
          {/* melting drop */}
          <path d="M96 58 q4 7 0 10 q-4 -3 0 -10z" fill="#7DB4C2">
            <animateTransform attributeName="transform" type="translate" values="0 0; 0 34" dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;1;0" dur="2.2s" repeatCount="indefinite" />
          </path>
        </>
      )}

      {mood === 'great' ? (
        <g>
          <rect x="33" y="57" width="24" height="15" rx="6" fill="#25252B" />
          <rect x="63" y="57" width="24" height="15" rx="6" fill="#25252B" />
          <path d="M57 62 h6" stroke="#25252B" strokeWidth="3" />
          <path d="M37 61 l7 0" stroke="#7DB4C2" strokeWidth="2" strokeLinecap="round" />
          <path d="M67 61 l7 0" stroke="#7DB4C2" strokeWidth="2" strokeLinecap="round" />
        </g>
      ) : (
        <g className="blink">
          <ellipse cx="46" cy="65" rx="5.5" ry="7" fill="#25252B" />
          <ellipse cx="74" cy="65" rx="5.5" ry="7" fill="#25252B" />
          <circle cx="48" cy="62" r="1.8" fill="#fff" />
          <circle cx="76" cy="62" r="1.8" fill="#fff" />
        </g>
      )}

      {(mood === 'good' || mood === 'great') && (
        <>
          <circle cx="36" cy="80" r="5" fill="#E88C8C" opacity="0.45" />
          <circle cx="84" cy="80" r="5" fill="#E88C8C" opacity="0.45" />
        </>
      )}
      <path d={MOUTH[mood]} fill="none" stroke="#25252B" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  )
}

export function Mascot({ score, size = 120 }: { score: number; size?: number }): ReactNode {
  const { t } = useTranslation()
  const { track } = useProgress()
  const mood = moodOf(score)
  const controls = useAnimationControls()
  const [say, setSay] = useState<string | null>(null)
  const clicks = useRef<number[]>([])
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const speak = (text: string): void => {
    setSay(text)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setSay(null), 3500)
  }

  const onClick = (e: React.MouseEvent): void => {
    void controls.start({ y: [0, -26, 0], rotate: [0, -8, 8, 0], transition: { duration: 0.55 } })
    const now = Date.now()
    clicks.current = [...clicks.current.filter((x) => now - x < 3000), now]
    if (clicks.current.length >= 7) {
      clicks.current = []
      blizzard()
      burst({ x: e.clientX, y: e.clientY, big: true })
      track({ type: 'secret' })
      speak(t('mascot.secret'))
      return
    }
    const list = [...(t(`mascot.${mood}`, { returnObjects: true }) as string[]), ...(t('mascot.any', { returnObjects: true }) as string[])]
    speak(list[Math.floor(Math.random() * list.length)])
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <AnimatePresence>
        {say && (
          <motion.div
            key={say}
            initial={{ opacity: 0, y: 8, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            className="absolute bottom-[92%] left-1/2 z-10 w-52 -translate-x-1/2 rounded-2xl border border-teal/50 bg-panel2 px-3.5 py-2.5 text-center text-xs leading-snug text-frost shadow-xl"
          >
            {say}
            <span className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 border-r border-b border-teal/50 bg-panel2" />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="float h-full w-full">
        <motion.button
          type="button"
          animate={controls}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.92 }}
          onClick={onClick}
          className="block h-full w-full cursor-pointer"
          title={t('mascot.name')}
        >
          <Face mood={mood} />
        </motion.button>
      </div>
    </div>
  )
}

/** Small static face for the sidebar profile. */
export function MascotMini({ score }: { score: number }): ReactNode {
  return (
    <div className="size-10 shrink-0">
      <Face mood={moodOf(score)} />
    </div>
  )
}
