import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiClient, ApiError } from './api'
import { AccessCard } from './components/AccessCard'
import { ActivityLog } from './components/ActivityLog'
import { AdminPanel } from './components/AdminPanel'
import { Calendar } from './components/Calendar'
import { InfoIcon, LogoIcon } from './components/icons'
import { LanguageSwitch } from './components/LanguageSwitch'
import { MyLaundry } from './components/MyLaundry'
import { SignIn } from './components/SignIn'
import { ThemeSwitch } from './components/ThemeSwitch'
import type { Me } from './types'

const api = ApiClient.getInstance()

export function App() {
  const { t, i18n } = useTranslation()
  const [me, setMe] = useState<Me | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [hash, setHash] = useState(() => location.hash)

  const loadMe = useCallback(() => api.request<Me>('/me').then(setMe, () => setMe(null)), [])
  useEffect(() => {
    loadMe()
  }, [loadMe])

  useEffect(() => {
    const language = i18n.resolvedLanguage
    if (!me || !language || me.language === language) return
    api.request('/me/language', 'POST', { language }).then(
      () => setMe({ ...me, language: language as Me['language'] }),
      () => undefined,
    )
  }, [me, i18n.resolvedLanguage])

  useEffect(() => {
    const onHashChange = () => setHash(location.hash)
    addEventListener('hashchange', onHashChange)
    return () => removeEventListener('hashchange', onHashChange)
  }, [])

  const run = useCallback(async (fn: () => Promise<unknown>, after?: () => unknown) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'server_error')
    }
    await after?.()
  }, [])
  const clearJump = useCallback(() => {
    history.replaceState(null, '', '#/calendar')
    setHash('#/calendar')
  }, [])

  if (me === undefined)
    return (
      <main className="app">
        <p>{t('loading')}</p>
      </main>
    )

  if (!me) return <SignIn />

  const approved = me.status === 'approved'
  const showCalendar = approved || me.isAdmin
  const view = approved && !hash.startsWith('#/calendar') ? 'mine' : 'calendar'

  return (
    <main className="app">
      <header className="top">
        <div className="brand">
          <span className="logo">
            <LogoIcon />
          </span>
          <div>
            <h1>{t('title')}</h1>
            <span className="address">{t('address')}</span>
          </div>
        </div>
        <div className="header-actions">
          <div className="prefs">
            <LanguageSwitch />
            <ThemeSwitch />
          </div>
          <div className="user">
            <span className="user-name">{me.name}</span>
            {approved && me.apartment && <span className="chip approved">{me.apartment}</span>}
            {!approved && <span className={`chip ${me.status}`}>{t(`states.${me.status}`)}</span>}
            {me.isAdmin && <span className="chip admin">{t('admin.badge')}</span>}
            <button
              type="button"
              className="link"
              onClick={() =>
                run(
                  () => api.request('/auth/logout', 'POST'),
                  () => setMe(null),
                )
              }
            >
              {t('logout')}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <p className="alert" role="alert">
          <InfoIcon />
          {t(`errors.${error}`, { defaultValue: error })}
        </p>
      )}

      {approved && (
        <nav className="tabs" aria-label={t('nav.label')}>
          <a href="#/" aria-current={view === 'mine' ? 'page' : undefined}>
            {t('nav.mine')}
          </a>
          <a href="#/calendar" aria-current={view === 'calendar' ? 'page' : undefined}>
            {t('nav.calendar')}
          </a>
        </nav>
      )}

      {view === 'mine' ? (
        <MyLaundry me={me} run={run} />
      ) : (
        <>
          {!approved && <AccessCard me={me} run={run} onDone={loadMe} />}
          {showCalendar && (
            <Calendar
              key={me.status}
              me={me}
              run={run}
              jumpOnLoad={hash === '#/calendar/next'}
              onJumped={clearJump}
            />
          )}
          {me.isAdmin && <AdminPanel run={run} onChange={loadMe} />}
          {me.isAdmin && <ActivityLog run={run} />}
        </>
      )}
    </main>
  )
}
