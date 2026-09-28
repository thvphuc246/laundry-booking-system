import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  addDays,
  BOOK_AHEAD_DAYS,
  CLOSE_HOUR,
  helsinki,
  limitError,
  MAX_PER_DAY,
  MAX_PER_WEEK,
  OPEN_HOUR,
  slotError,
  TZ,
  toUtc,
  weekStart,
} from '../../shared/rules'
import { ApiClient } from '../api'
import type { Booking, Me, Run } from '../types'

const api = ApiClient.getInstance()

export function Calendar({ me, run }: { me: Me; run: Run }) {
  const { t, i18n } = useTranslation()
  const today = helsinki(new Date()).date
  const days = Array.from({ length: BOOK_AHEAD_DAYS + 1 }, (_, i) => addDays(today, i))
  const [day, setDay] = useState(today)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [maintenance, setMaintenance] = useState(false)

  const load = useCallback(() => api.request<Booking[]>('/bookings').then(setBookings), [])
  useEffect(() => {
    load()
  }, [load])

  const bySlot = new Map(bookings.map((b) => [new Date(b.slot_start).getTime(), b]))
  const mine = bookings.filter((b) => b.mine).map((b) => new Date(b.slot_start))
  const usedDay = mine.filter((d) => helsinki(d).date === day).length
  const usedWeek = mine.filter((d) => weekStart(helsinki(d).date) === weekStart(day)).length
  const canBook = me.status === 'approved' || (me.isAdmin && maintenance)
  const now = new Date()

  const dayLabel = new Intl.DateTimeFormat(i18n.language, {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  })
  const hours = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i)

  return (
    <section>
      <nav className="days">
        {days.map((d) => (
          <button
            type="button"
            key={d}
            className={d === day ? 'active' : ''}
            aria-pressed={d === day}
            onClick={() => setDay(d)}
          >
            {dayLabel.format(toUtc(d, 12))}
          </button>
        ))}
      </nav>

      {me.status === 'approved' && (
        <p className="usage">
          {t('calendar.usage', {
            day: usedDay,
            maxDay: MAX_PER_DAY,
            week: usedWeek,
            maxWeek: MAX_PER_WEEK,
          })}
        </p>
      )}
      {me.isAdmin && (
        <label className="maintenance-toggle">
          <input
            type="checkbox"
            checked={maintenance}
            onChange={(e) => setMaintenance(e.target.checked)}
          />{' '}
          {t('calendar.maintenanceMode')}
        </label>
      )}

      <ul className="slots">
        {hours.map((h) => {
          const slot = toUtc(day, h)
          const b = bySlot.get(slot.getTime())
          const past = slot <= now
          const blocked = slotError(slot, now) ?? (maintenance ? null : limitError(mine, slot))
          const pad = (n: number) => String(n).padStart(2, '0')
          return (
            <li
              key={h}
              className={[b ? 'taken' : 'free', b?.mine ? 'mine' : '', past ? 'past' : ''].join(
                ' ',
              )}
            >
              <span className="time">
                {pad(h)}:00–{pad(h + 1)}:00
              </span>
              <span className="who">
                {b
                  ? b.maintenance
                    ? t('calendar.maintenance')
                    : `${b.apartment}${b.mine ? ` (${t('calendar.yours')})` : ''}`
                  : t('calendar.free')}
              </span>
              {b && !past && (b.mine || me.isAdmin) && (
                <button
                  type="button"
                  onClick={() =>
                    confirm(t('calendar.confirmCancel')) &&
                    run(() => api.request(`/bookings/${b.id}`, 'DELETE'), load)
                  }
                >
                  {t('calendar.cancel')}
                </button>
              )}
              {!b && canBook && !past && (
                <button
                  type="button"
                  disabled={!!blocked}
                  title={blocked ? t(`errors.${blocked}`) : undefined}
                  onClick={() =>
                    run(
                      () =>
                        api.request('/bookings', 'POST', {
                          slot_start: slot.toISOString(),
                          maintenance,
                        }),
                      load,
                    )
                  }
                >
                  {t('calendar.book')}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
