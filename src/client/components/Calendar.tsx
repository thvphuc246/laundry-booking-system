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
import { WrenchIcon } from './icons'
import { UsageCard } from './UsageCard'

const api = ApiClient.getInstance()
const pad = (n: number) => String(n).padStart(2, '0')
const dayMonthLabel = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`

function slotKind(b: Booking | undefined) {
  if (!b) return 'free'
  if (b.maintenance) return 'maint'
  return b.mine ? 'mine' : 'taken'
}

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

  const approved = me.status === 'approved'
  const bySlot = new Map(bookings.map((b) => [new Date(b.slot_start).getTime(), b]))
  const mine = bookings.filter((b) => b.mine).map((b) => new Date(b.slot_start))
  const usedDay = mine.filter((d) => helsinki(d).date === day).length
  const usedWeek = mine.filter((d) => weekStart(helsinki(d).date) === weekStart(day)).length
  const canBook = approved || (me.isAdmin && maintenance)
  const now = new Date()

  const weekday = new Intl.DateTimeFormat(i18n.language, { timeZone: TZ, weekday: 'short' })
  const hours = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i)

  return (
    <section className="calendar">
      <nav className="days" aria-label={t('calendar.days')}>
        {days.map((d) => (
          <button
            type="button"
            key={d}
            className="day"
            aria-pressed={d === day}
            onClick={() => setDay(d)}
          >
            <span className="day-dow">{weekday.format(toUtc(d, 12))}</span>
            <span className="day-date">{dayMonthLabel(d)}</span>
          </button>
        ))}
      </nav>

      {approved && (
        <div className="usage">
          <UsageCard label={t('calendar.thisDay')} used={usedDay} max={MAX_PER_DAY} />
          <UsageCard label={t('calendar.thisWeek')} used={usedWeek} max={MAX_PER_WEEK} />
        </div>
      )}

      {me.isAdmin && (
        <label className="card toggle-card">
          <span className="toggle-label">
            <WrenchIcon />
            {t('calendar.maintenanceMode')}
          </span>
          <input
            type="checkbox"
            checked={maintenance}
            onChange={(e) => setMaintenance(e.target.checked)}
          />
        </label>
      )}

      <ul className="card slots">
        {hours.map((h) => {
          const slot = toUtc(day, h)
          const b = bySlot.get(slot.getTime())
          const kind = slotKind(b)
          const past = slot <= now
          const blocked = slotError(slot, now) ?? (maintenance ? null : limitError(mine, slot))
          const label = {
            free: t('calendar.free'),
            maint: t('calendar.maintenance'),
            mine: `${b?.apartment} (${t('calendar.yours')})`,
            taken: b?.apartment,
          }[kind]
          return (
            <li key={h} className={past ? `${kind} past` : kind}>
              <span className="time">
                {pad(h)}:00–{pad(h + 1)}:00
              </span>
              <span className="who">
                <span className="dot" />
                <span className="who-text">{label}</span>
              </span>
              <span className="slot-action">
                {b && !past && (b.mine || me.isAdmin) && (
                  <button
                    type="button"
                    className="btn secondary"
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
                    className="btn"
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
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
