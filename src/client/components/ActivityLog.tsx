import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENTS_PAGE } from '../../shared/events'
import { helsinki } from '../../shared/rules'
import { ApiClient } from '../api'
import { activityKey, dateTimeLabel, dayLabel, timeLabel } from '../format'
import type { ActivityEvent, Run } from '../types'

const api = ApiClient.getInstance()

export function ActivityLog({ run }: { run: Run }) {
  const { t, i18n } = useTranslation()
  const [list, setList] = useState<ActivityEvent[]>([])
  const [more, setMore] = useState(false)

  const load = (offset: number) =>
    run(() =>
      api.request<ActivityEvent[]>(`/admin/events?offset=${offset}`).then((rows) => {
        setList(offset ? [...list, ...rows] : rows)
        setMore(rows.length === EVENTS_PAGE)
      }),
    )

  const when = (e: ActivityEvent) => {
    if (!e.slot_start) return ''
    const s = helsinki(new Date(e.slot_start))
    return `${dayLabel(s.date, i18n.language)} ${timeLabel(s.hour)}`
  }

  return (
    <details className="activity" onToggle={(ev) => ev.currentTarget.open && load(0)}>
      <summary>
        <h2 className="activity-title">{t('activity.title')}</h2>
      </summary>
      {list.length === 0 ? (
        <p className="empty">{t('activity.empty')}</p>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('activity.when')}</th>
                <th>{t('activity.who')}</th>
                <th>{t('activity.what')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id}>
                  <td>{dateTimeLabel(new Date(e.created_at), i18n.language)}</td>
                  <td>{e.actor}</td>
                  <td>
                    {t(activityKey(e), {
                      subject: e.subject,
                      apartment: e.apartment,
                      when: when(e),
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {more && (
        <button type="button" className="btn secondary" onClick={() => load(list.length)}>
          {t('activity.more')}
        </button>
      )}
    </details>
  )
}
