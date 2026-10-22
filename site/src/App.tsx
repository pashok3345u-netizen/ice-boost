import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Activity,
  Ban,
  ChevronDown,
  Download,
  Gamepad2,
  Lock,
  Package,
  Power,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  WifiOff,
  Zap,
  type LucideIcon
} from 'lucide-react'
import { BASE, DOWNLOAD_URL, PORTABLE_URL, RELEASES_URL, VERSION, asset } from './config'
import { BurstLayer, Snow, burst } from './Fx'
import { LangContext, TEXTS, initialLang, saveLang, useLang, type Lang } from './i18n'
import { Face, Mascot, type Mood } from './Mascot'

const SHOT_TABS = ['dashboard', 'boost', 'cleaner', 'achievements'] as const
type ShotTab = (typeof SHOT_TABS)[number]

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }
}

function DownloadButton({ big = false }: { big?: boolean }): ReactNode {
  const { t } = useLang()
  return (
    <motion.a
      href={DOWNLOAD_URL}
      onClick={(e) => burst({ x: e.clientX, y: e.clientY })}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={`shine pulse accent-gradient inline-flex items-center justify-center gap-2.5 rounded-2xl font-semibold text-deep shadow-[0_14px_40px_-12px_rgba(82,138,154,0.9)] ${
        big ? 'px-7 py-4 text-lg' : 'px-6 py-3.5 text-base'
      }`}
    >
      <Download className={big ? 'size-5' : 'size-[18px]'} strokeWidth={2.4} />
      {t.hero.cta}
    </motion.a>
  )
}

function LangSwitch(): ReactNode {
  const { lang, setLang } = useLang()
  return (
    <div className="flex rounded-xl border border-line bg-deep/60 p-1 text-xs font-semibold" role="group" aria-label="Language">
      {(['ru', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`relative cursor-pointer rounded-lg px-2.5 py-1.5 uppercase transition-colors ${lang === l ? 'text-deep' : 'text-muted hover:text-frost'}`}
        >
          {lang === l && <motion.span layoutId="lang-pill" className="absolute inset-0 rounded-lg bg-frost" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
          <span className="relative">{l}</span>
        </button>
      ))}
    </div>
  )
}

function Header(): ReactNode {
  const { t } = useLang()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = (): void => setScrolled(window.scrollY > 12)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  const links: [string, string][] = [
    ['#features', t.nav.features],
    ['#shots', t.nav.shots],
    ['#safety', t.nav.safety],
    ['#faq', t.nav.faq]
  ]
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${scrolled ? 'border-b border-line/70 bg-bg/80 backdrop-blur-xl' : 'border-b border-transparent'}`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5">
          <img src={asset('icon.png')} alt="" width={32} height={32} className="size-8 rounded-lg" />
          <span className="font-display text-lg font-semibold tracking-tight text-frost">IceBoost</span>
        </a>
        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-panel hover:text-frost">
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2.5">
          <LangSwitch />
          <a
            href={DOWNLOAD_URL}
            className="accent-gradient hidden items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-deep transition-transform hover:scale-[1.03] sm:inline-flex"
          >
            <Download className="size-4" strokeWidth={2.4} />
            {t.nav.download}
          </a>
          <a href={DOWNLOAD_URL} aria-label={t.nav.download} className="accent-gradient inline-flex size-9 items-center justify-center rounded-xl text-deep sm:hidden">
            <Download className="size-4" strokeWidth={2.4} />
          </a>
        </div>
      </div>
    </header>
  )
}

function Hero(): ReactNode {
  const { t, lang } = useLang()
  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-16 sm:pt-36 lg:pb-24">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1fr_1.12fr]">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <span className="inline-flex items-center gap-2 rounded-full border border-teal/40 bg-teal/10 px-3.5 py-1.5 text-xs font-medium text-ice">
            <span className="size-1.5 rounded-full bg-good" />
            {t.hero.badge}
          </span>
          <h1 className="mt-6 font-display text-[2.15rem] leading-[1.12] font-semibold tracking-tight text-frost sm:text-5xl lg:text-[3.4rem]">
            {t.hero.title1} <span className="frost-text">{t.hero.title2}</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">{t.hero.text}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <DownloadButton big />
            <a href="#shots" className="rounded-2xl border border-line bg-panel/70 px-6 py-4 text-base font-medium text-frost transition-colors hover:border-teal/60">
              {t.hero.look}
            </a>
          </div>
          <p className="mt-4 text-sm text-muted">{t.hero.note}</p>
          <p className="mt-3 text-sm text-warn sm:hidden">📱 {t.hero.pcOnly}</p>
          <a href={PORTABLE_URL} className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-ice underline-offset-4 hover:underline">
            <Package className="size-3.5" />
            {t.hero.portable}
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40, rotate: 1.5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <div className="absolute -inset-6 rounded-[2rem] bg-teal/20 blur-3xl" aria-hidden />
          <div className="relative overflow-hidden rounded-2xl border border-line shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)]">
            <img src={`${BASE}shots/${lang}/dashboard.webp`} alt={t.shots.tabs.dashboard.t} width={1240} height={820} className="block aspect-[1240/820] w-full" />
          </div>
          <div className="absolute -bottom-10 -left-4 sm:-left-10">
            <Mascot mood="good" size={110} id="hero" bubbleLeft />
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function Stats(): ReactNode {
  const { t } = useLang()
  return (
    <section className="relative px-4 sm:px-6">
      <motion.div {...reveal} className="card mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-3xl border border-line bg-line/60 lg:grid-cols-4">
        {t.stats.map((s) => (
          <div key={s.t} className="bg-panel/90 px-5 py-6 sm:px-7">
            <div className="frost-text font-display text-3xl font-semibold sm:text-4xl">{s.n}</div>
            <div className="mt-1.5 text-sm text-muted">{s.t}</div>
          </div>
        ))}
      </motion.div>
    </section>
  )
}

function SectionHead({ title, text }: { title: string; text?: string }): ReactNode {
  return (
    <motion.div {...reveal} className="mx-auto max-w-2xl text-center">
      <h2 className="font-display text-3xl font-semibold tracking-tight text-frost sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-base text-muted sm:text-lg">{text}</p>}
    </motion.div>
  )
}

const FEATURE_ICONS: Record<keyof (typeof TEXTS)['ru']['features']['list'], LucideIcon> = {
  oneClick: Rocket,
  boost: Zap,
  cleaner: Sparkles,
  gameTime: Gamepad2,
  startup: Power,
  live: Activity
}

function Features(): ReactNode {
  const { t } = useLang()
  const items = Object.entries(t.features.list) as [keyof typeof FEATURE_ICONS, { t: string; d: string }][]
  return (
    <section id="features" className="relative px-4 py-24 sm:px-6 sm:py-28">
      <SectionHead title={t.features.title} text={t.features.text} />
      <div className="mx-auto mt-14 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([key, f], i) => {
          const Icon = FEATURE_ICONS[key]
          return (
            <motion.div key={key} {...reveal} transition={{ ...reveal.transition, delay: (i % 3) * 0.08 }} className="card card-hover rounded-3xl border border-line p-6">
              <div className={`flex size-12 items-center justify-center rounded-2xl ${i === 0 ? 'accent-gradient text-deep' : 'bg-teal/15 text-ice'}`}>
                <Icon className="size-6" />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-frost">{f.t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.d}</p>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}

function Showcase(): ReactNode {
  const { t, lang } = useLang()
  const [tab, setTab] = useState<ShotTab>('dashboard')
  // preload the other tabs so switching is instant
  useEffect(() => {
    for (const k of SHOT_TABS) new Image().src = `${BASE}shots/${lang}/${k}.webp`
  }, [lang])
  return (
    <section id="shots" className="relative px-4 py-20 sm:px-6 sm:py-24">
      <SectionHead title={t.shots.title} text={t.shots.text} />
      <motion.div {...reveal} className="mx-auto mt-12 max-w-5xl">
        <div className="mx-auto flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-2xl border border-line bg-deep/60 p-1.5">
          {SHOT_TABS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`relative cursor-pointer rounded-xl px-3.5 py-2 text-sm font-medium transition-colors sm:px-4 ${tab === k ? 'text-frost' : 'text-muted hover:text-frost'}`}
            >
              {tab === k && <motion.span layoutId="shot-pill" className="absolute inset-0 rounded-xl border border-teal/50 bg-teal/20" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <span className="relative">{t.shots.tabs[k].t}</span>
            </button>
          ))}
        </div>
        <div className="relative mt-8">
          <div className="absolute -inset-8 rounded-[2.5rem] bg-teal/15 blur-3xl" aria-hidden />
          <div className="relative aspect-[1240/820] overflow-hidden rounded-2xl border border-line bg-deep shadow-[0_40px_90px_-30px_rgba(0,0,0,0.85)]">
            <AnimatePresence initial={false}>
              <motion.img
                key={`${lang}-${tab}`}
                src={`${BASE}shots/${lang}/${tab}.webp`}
                alt={t.shots.tabs[tab].t}
                width={1240}
                height={820}
                loading="lazy"
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 h-full w-full"
              />
            </AnimatePresence>
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={`${lang}-${tab}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="mt-6 text-center text-base text-muted"
          >
            {t.shots.tabs[tab].d}
          </motion.p>
        </AnimatePresence>
      </motion.div>
    </section>
  )
}

const MOODS: Mood[] = ['bad', 'ok', 'good', 'great']
const MOOD_SCORE: Record<Mood, string> = { bad: '< 55', ok: '55–74', good: '75–89', great: '90+' }

function MascotSection(): ReactNode {
  const { t } = useLang()
  const [mood, setMood] = useState<Mood>('great')
  return (
    <section className="relative px-4 py-20 sm:px-6 sm:py-24">
      <motion.div {...reveal} className="card glow-bg mx-auto grid max-w-6xl items-center gap-10 overflow-hidden rounded-[2rem] border border-line p-6 sm:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:p-14">
        <div className="flex flex-col items-center">
          <div className="pt-16">
            <Mascot mood={mood} size={190} id="section" />
          </div>
          <p className="mt-4 text-sm text-muted">{t.mascot.click}</p>
          <div className="mt-6 grid w-full max-w-sm grid-cols-4 gap-2">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMood(m)}
                aria-pressed={mood === m}
                className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 transition-colors ${
                  mood === m ? 'border-teal/70 bg-teal/15' : 'border-line bg-deep/40 hover:border-teal/40'
                }`}
              >
                <span className="size-9">
                  <Face mood={m} id={`chip-${m}`} />
                </span>
                <span className="text-xs font-medium text-frost">{t.mascot.moods[m]}</span>
                <span className="text-[11px] text-muted">{MOOD_SCORE[m]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="order-first lg:order-none">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-frost sm:text-4xl">{t.mascot.title}</h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">{t.mascot.text}</p>
          <h3 className="mt-8 text-xs font-semibold tracking-[0.18em] text-ice uppercase">{t.mascot.ranksTitle}</h3>
          <ol className="mt-3 flex flex-wrap items-center gap-2">
            {t.mascot.ranks.map((r, i) => (
              <li key={r} className="flex items-center gap-2">
                <span
                  className={`rounded-xl border px-3 py-1.5 text-sm ${
                    i === t.mascot.ranks.length - 1 ? 'accent-gradient border-transparent font-semibold text-deep' : 'border-line bg-deep/50 text-frost'
                  }`}
                >
                  {r}
                </span>
                {i < t.mascot.ranks.length - 1 && <span className="text-muted">→</span>}
              </li>
            ))}
          </ol>
          <p className="mt-8 rounded-2xl border border-dashed border-teal/40 bg-teal/5 px-4 py-3 text-sm text-ice">❄️ {t.mascot.secretHint}</p>
        </div>
      </motion.div>
    </section>
  )
}

const SAFETY_ICONS: LucideIcon[] = [RotateCcw, ShieldCheck, Ban, Lock, WifiOff]

function Safety(): ReactNode {
  const { t } = useLang()
  return (
    <section id="safety" className="relative px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <motion.div {...reveal} className="lg:sticky lg:top-28 lg:self-start">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-good/15 text-good">
            <ShieldCheck className="size-7" />
          </div>
          <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight text-frost sm:text-4xl">{t.safety.title}</h2>
          <p className="mt-4 text-base text-muted sm:text-lg">{t.safety.text}</p>
        </motion.div>
        <div className="grid gap-3">
          {t.safety.list.map((s, i) => {
            const Icon = SAFETY_ICONS[i]
            return (
              <motion.div key={s.t} {...reveal} transition={{ ...reveal.transition, delay: i * 0.05 }} className="card flex gap-4 rounded-2xl border border-line p-5">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal/15 text-ice">
                  <Icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-frost">{s.t}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-muted">{s.d}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Faq(): ReactNode {
  const { t } = useLang()
  const [open, setOpen] = useState<number | null>(1)
  return (
    <section id="faq" className="relative px-4 py-20 sm:px-6 sm:py-24">
      <SectionHead title={t.faq.title} />
      <div className="mx-auto mt-12 grid max-w-3xl gap-3">
        {t.faq.list.map((f, i) => {
          const isOpen = open === i
          return (
            <motion.div key={f.q} {...reveal} className={`card overflow-hidden rounded-2xl border transition-colors ${isOpen ? 'border-teal/50' : 'border-line'}`}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left font-semibold text-frost"
              >
                <span className="flex-1">{f.q}</span>
                <ChevronDown className={`size-5 shrink-0 text-ice transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
                    <p className="px-5 pb-5 text-[15px] leading-relaxed text-muted">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}

function FinalCta(): ReactNode {
  const { t } = useLang()
  return (
    <section className="relative px-4 pt-10 pb-24 sm:px-6">
      <motion.div {...reveal} className="card glow-bg mx-auto flex max-w-4xl flex-col items-center rounded-[2rem] border border-teal/30 px-6 py-14 text-center">
        <div className="size-24">
          <Face mood="great" id="final" />
        </div>
        <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight text-frost sm:text-4xl">{t.final.title}</h2>
        <p className="mt-3 text-base text-muted sm:text-lg">{t.final.text}</p>
        <div className="mt-8">
          <DownloadButton big />
        </div>
        <p className="mt-4 text-sm text-muted">{t.hero.note}</p>
      </motion.div>
    </section>
  )
}

function Footer(): ReactNode {
  const { t } = useLang()
  return (
    <footer className="relative border-t border-line/70 px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted sm:flex-row">
        <div className="flex items-center gap-2.5">
          <img src={asset('icon.png')} alt="" width={24} height={24} className="size-6 rounded-md" />
          <span>
            IceBoost v{VERSION} · {t.footer.made} · {new Date().getFullYear()}
          </span>
        </div>
        <a href={RELEASES_URL} className="text-ice underline-offset-4 hover:underline">
          {t.footer.all}
        </a>
      </div>
    </footer>
  )
}

const TITLES: Record<Lang, string> = {
  ru: 'IceBoost — оптимизатор ПК для геймеров',
  en: 'IceBoost — PC optimizer for gamers'
}

export function App(): ReactNode {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const setLang = (l: Lang): void => {
    setLangState(l)
    saveLang(l)
  }
  useEffect(() => {
    document.documentElement.lang = lang
    document.title = TITLES[lang]
  }, [lang])

  return (
    <LangContext.Provider value={{ lang, t: TEXTS[lang], setLang }}>
      <div className="glow-bg pointer-events-none fixed inset-0 z-0" aria-hidden />
      <Snow />
      <BurstLayer />
      <Header />
      <main className="relative z-10">
        <Hero />
        <Stats />
        <Features />
        <Showcase />
        <MascotSection />
        <Safety />
        <Faq />
        <FinalCta />
      </main>
      <div className="relative z-10">
        <Footer />
      </div>
    </LangContext.Provider>
  )
}
