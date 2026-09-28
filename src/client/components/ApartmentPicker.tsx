import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiClient } from '../api'
import type { Apartment, Run } from '../types'

const api = ApiClient.getInstance()

export function ApartmentPicker({ run, onDone }: { run: Run; onDone: () => void }) {
  const { t } = useTranslation()
  const [list, setList] = useState<Apartment[]>([])
  const [selected, setSelected] = useState('')
  useEffect(() => {
    api.request<Apartment[]>('/apartments').then(setList)
  }, [])

  return (
    <form
      className="picker"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => api.request('/me/apartment', 'POST', { apartment_id: selected }), onDone)
      }}
    >
      <label>
        {t('picker.label')}{' '}
        <select value={selected} onChange={(e) => setSelected(e.target.value)} required>
          <option value="">{t('picker.choose')}</option>
          {list.map((a) => (
            <option key={a.id} value={a.id} disabled={a.taken}>
              {a.code}
              {a.taken ? ` (${t('picker.taken')})` : ''}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={!selected}>
        {t('picker.submit')}
      </button>
    </form>
  )
}
