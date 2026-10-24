import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { GoogleIcon, LogoIcon } from './icons'
import { LanguageSwitch } from './LanguageSwitch'
import { ThemeSwitch } from './ThemeSwitch'

const HOW_STEPS = ['google', 'apartment', 'approval'] as const

export function SignIn() {
  const { t } = useTranslation()
  const howId = useId()

  return (
    <main className="signin">
      <section className="signin-brand">
        <span className="logo large">
          <LogoIcon size={30} />
        </span>
        <div className="signin-title">
          <h1>{t('title')}</h1>
          <span className="address">{t('address')}</span>
        </div>
      </section>

      <section className="signin-main">
        <div className="prefs">
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
        <div className="signin-card">
          <div className="signin-intro">
            <h2>{t('signIn.title')}</h2>
            <p className="lead">{t('loginHint')}</p>
          </div>
          <a className="google" href="/api/auth/google">
            <GoogleIcon />
            {t('login')}
          </a>
          <p className="first-time">{t('signIn.firstTime')}</p>
        </div>
      </section>

      <section className="signin-how" aria-labelledby={howId}>
        <h2 id={howId}>{t('signIn.howTitle')}</h2>
        <ol>
          {HOW_STEPS.map((key, i) => (
            <li key={key}>
              <span className="how-mark">{i + 1}</span>
              <span className="how-text">
                <strong>{t(`signIn.steps.${key}.title`)}</strong>
                <span className="how-desc">{t(`signIn.steps.${key}.text`)}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="limits">{t('signIn.limits')}</p>
      </section>
    </main>
  )
}
