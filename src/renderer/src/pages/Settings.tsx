import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Info, Languages, Lock, Settings as SettingsIcon, ShieldCheck, Snowflake } from 'lucide-react'
import { setLang } from '../i18n'
import { useStore } from '../store'
import { Card, Logo, PageHeader, Toggle, cx } from '../ui'
import { fxEnabled } from '../theme'
import { burst, notifyFxChanged } from '../Fx'

export function Settings(): ReactNode {
  const { t, i18n } = useTranslation()
  const { sys } = useStore()
  const [fx, setFx] = useState(fxEnabled)

  return (
    <div className="max-w-3xl">
      <PageHeader icon={<SettingsIcon className="size-5" />} title={t('settings.title')} />
      <div className="space-y-5">
        <Card hover>
          <h2 className="font-display mb-3 flex items-center gap-2 text-sm font-semibold">
            <Languages className="size-4 text-ice" />
            {t('settings.language')}
          </h2>
          <div className="flex gap-2">
            {(['ru', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cx(
                  'rounded-xl border px-5 py-2.5 text-sm transition',
                  i18n.language === l ? 'border-teal bg-teal/25 text-frost' : 'border-line bg-panel2 hover:border-teal/60'
                )}
              >
                {l === 'ru' ? 'Русский' : 'English'}
              </button>
            ))}
          </div>
        </Card>

        <Card hover delay={0.04} className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display mb-1 flex items-center gap-2 text-sm font-semibold">
              <Snowflake className="size-4 text-ice" />
              {t('settings.fx')}
            </h2>
            <p className="text-sm text-muted">{t('settings.fxText')}</p>
          </div>
          <Toggle
            checked={fx}
            onChange={(v, e) => {
              try {
                localStorage.setItem('fx', v ? 'on' : 'off')
              } catch {
                // ignore
              }
              setFx(v)
              notifyFxChanged()
              if (v) burst({ x: e.clientX, y: e.clientY })
            }}
          />
        </Card>

        <Card hover delay={0.08}>
          <h2 className="font-display mb-3 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-good" />
            {t('settings.backups')}
          </h2>
          <p className="text-sm text-muted">{t('settings.backupsText')}</p>
          <p className="mt-3 flex items-start gap-2 text-sm text-muted">
            <Lock className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="text-text">{sys?.isAdmin ? t('common.adminOn') : t('common.adminOff')}.</span> {t('settings.adminText')}
            </span>
          </p>
        </Card>

        <Card hover delay={0.12}>
          <h2 className="font-display mb-3 flex items-center gap-2 text-sm font-semibold">
            <Info className="size-4 text-ice" />
            {t('settings.about')}
          </h2>
          <div className="flex items-start gap-4">
            <div className="float">
              <Logo size={56} />
            </div>
            <div className="space-y-2 text-sm text-muted">
              <div className="font-display text-base font-semibold text-text">
                IceBoost <span className="text-xs font-normal text-muted">v0.2.0</span>
              </div>
              <p>{t('settings.aboutText')}</p>
              <p>{t('settings.honest')}</p>
              <p>{t('settings.author')}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
