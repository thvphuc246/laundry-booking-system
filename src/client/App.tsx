import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiClient, ApiError } from './api'
import { AccessCard } from './components/AccessCard'
import { AdminPanel } from './components/AdminPanel'
import { Calendar } from './components/Calendar'
import { InfoIcon, LogoIcon } from './components/icons'
import { SignIn } from './components/SignIn'
import { ThemeSwitch } from './components/ThemeSwitch'
import type { Me } from './types'

const api = ApiClient.getInstance()

export function App() {
  const { t } = useTranslation()
  const [me, setMe] = useState<Me | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const loadMe = useCallback(() => api.request<Me>('/me').then(setMe, () => setMe(null)), [])
  useEffect(() => {
    loadMe()
  }, [loadMe])

  const run = useCallback(async (fn: () => Promise<unknown>, after?: () => unknown) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'server_error')
    }
    await after?.()
  }, [])

  if (me === undefined)
    return (
      <main className="app">
        <p>{t('loading')}</p>
      </main>
    )

  if (!me) return <SignIn />

  const approved = me.status === 'approved'

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
          <ThemeSwitch />
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

      {!approved && <AccessCard me={me} run={run} onDone={loadMe} />}
      <Calendar key={me.status} me={me} run={run} />
      {me.isAdmin && <AdminPanel run={run} onChange={loadMe} />}
    </main>
  )
}
