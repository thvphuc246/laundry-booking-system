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
      <fieldset>
        <legend>{t('picker.label')}</legend>
        <div className="apartments">
          {list.map((a) => (
            <label key={a.id} className="apartment">
              <input
                type="radio"
                name="apartment"
                value={a.id}
                disabled={a.taken}
                checked={selected === a.id}
                onChange={() => setSelected(a.id)}
              />
              <span>
                {a.code}
                {a.taken && <span className="sr-only"> ({t('picker.taken')})</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="picker-actions">
        <button type="submit" className="btn large" disabled={!selected}>
          {t('picker.submit')}
        </button>
      </div>
    </form>
  )
}
