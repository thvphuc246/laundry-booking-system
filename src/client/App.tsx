import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiClient, ApiError } from './api'
import { AdminPanel } from './components/AdminPanel'
import { ApartmentPicker } from './components/ApartmentPicker'
import { Calendar } from './components/Calendar'
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
      <main>
        <p>{t('loading')}</p>
      </main>
    )

  return (
    <main>
      <header>
        <div>
          <h1>{t('title')}</h1>
          <small>{t('address')}</small>
        </div>
        {me && (
          <div className="who">
            <span>
              {me.name}
              {me.status === 'approved' && me.apartment ? ` · ${me.apartment}` : ''}
            </span>
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
        )}
      </header>

      {error && (
        <p className="error" role="alert">
          {t(`errors.${error}`, { defaultValue: error })}
        </p>
      )}

      {!me ? (
        <section>
          <p>{t('loginHint')}</p>
          <a className="button" href="/api/auth/google">
            {t('login')}
          </a>
        </section>
      ) : (
        <>
          {me.status !== 'approved' && (
            <p className="notice">{t(`status.${me.status}`, { apartment: me.apartment })}</p>
          )}
          {['new', 'rejected', 'revoked'].includes(me.status) && (
            <ApartmentPicker run={run} onDone={loadMe} />
          )}
          <Calendar key={me.status} me={me} run={run} />
          {me.isAdmin && <AdminPanel run={run} onChange={loadMe} />}
        </>
      )}
    </main>
  )
}
