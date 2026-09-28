import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiClient } from '../api'
import type { AdminUser, Run } from '../types'

const api = ApiClient.getInstance()

export function AdminPanel({ run, onChange }: { run: Run; onChange: () => void }) {
  const { t } = useTranslation()
  const [list, setList] = useState<AdminUser[]>([])
  const load = useCallback(() => api.request<AdminUser[]>('/admin/users').then(setList), [])
  useEffect(() => {
    load()
  }, [load])

  const act = (u: AdminUser, action: 'approve' | 'reject' | 'revoke') => {
    if (action === 'revoke' && !confirm(t('admin.confirmRevoke', { name: u.name }))) return
    run(
      () => api.request(`/admin/users/${u.id}/${action}`, 'POST'),
      () => {
        load()
        onChange()
      },
    )
  }

  return (
    <section className="residents">
      <h2>{t('admin.title')}</h2>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t('admin.name')}</th>
              <th>{t('admin.apartment')}</th>
              <th>{t('admin.state')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="resident-name">{u.name}</div>
                  <div className="resident-email">{u.email}</div>
                </td>
                <td className="apartment-code">{u.apartment ?? '–'}</td>
                <td>
                  <span className={`chip ${u.status}`}>{t(`states.${u.status}`)}</span>
                </td>
                <td>
                  <div className="actions">
                    {u.status === 'pending' && (
                      <>
                        <button type="button" className="btn" onClick={() => act(u, 'approve')}>
                          {t('admin.approve')}
                        </button>
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => act(u, 'reject')}
                        >
                          {t('admin.reject')}
                        </button>
                      </>
                    )}
                    {u.status === 'approved' && (
                      <button type="button" className="btn danger" onClick={() => act(u, 'revoke')}>
                        {t('admin.revoke')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
