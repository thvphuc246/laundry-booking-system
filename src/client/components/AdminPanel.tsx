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
    <section>
      <h2>{t('admin.title')}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t('admin.name')}</th>
              <th>{t('admin.email')}</th>
              <th>{t('admin.apartment')}</th>
              <th>{t('admin.state')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.apartment ?? '–'}</td>
                <td>{t(`states.${u.status}`)}</td>
                <td className="actions">
                  {u.status === 'pending' && (
                    <>
                      <button type="button" onClick={() => act(u, 'approve')}>
                        {t('admin.approve')}
                      </button>
                      <button type="button" onClick={() => act(u, 'reject')}>
                        {t('admin.reject')}
                      </button>
                    </>
                  )}
                  {u.status === 'approved' && (
                    <button type="button" onClick={() => act(u, 'revoke')}>
                      {t('admin.revoke')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
