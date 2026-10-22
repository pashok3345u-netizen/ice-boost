import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Info, Languages, Lock, ShieldCheck } from 'lucide-react'
import { setLang } from '../i18n'
import { useStore } from '../store'
import { Card, Logo, PageHeader, cx } from '../ui'

export function Settings(): ReactNode {
  const { t, i18n } = useTranslation()
  const { sys } = useStore()
  return (
    <div className="fade-up max-w-3xl space-y-5">
      <PageHeader title={t('settings.title')} />
      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
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
                i18n.language === l ? 'border-ice/60 bg-ice/10 text-ice' : 'border-line bg-panel2 hover:border-ice/40'
              )}
            >
              {l === 'ru' ? 'Русский' : 'English'}
            </button>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-4 text-good" />
          {t('settings.backups')}
        </h2>
        <p className="text-sm text-muted">{t('settings.backupsText')}</p>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Lock className="size-4" />
          <span>
            <span className="text-text">{sys?.isAdmin ? t('common.adminOn') : t('common.adminOff')}.</span> {t('settings.adminText')}
          </span>
        </p>
      </Card>
      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Info className="size-4 text-ice" />
          {t('settings.about')}
        </h2>
        <div className="flex items-start gap-4">
          <Logo size={52} />
          <div className="space-y-2 text-sm text-muted">
            <div className="text-base font-semibold text-text">
              IceBoost <span className="text-xs font-normal text-muted">v0.1.0</span>
            </div>
            <p>{t('settings.aboutText')}</p>
            <p>{t('settings.honest')}</p>
            <p>{t('settings.author')}</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
