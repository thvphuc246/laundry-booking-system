import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { dayLabel, relativeTime, timeLabel } from '../../shared/format'
import {
  canCancel,
  helsinki,
  hoursLeft,
  LAST_MINUTE_HOURS,
  MAX_PER_DAY,
  MAX_PER_WEEK,
  weekStart,
} from '../../shared/rules'
import { mergeRuns } from '../../shared/runs'
import { ApiClient } from '../api'
import { downloadIcs } from '../ics'
import type { Booking, Me, Notice, Run } from '../types'
import { useNow } from '../useNow'
import { useConfirm } from './ConfirmDialog'
import { UsageCard } from './UsageCard'

const api = ApiClient.getInstance()

export function MyLaundry({ me, run }: { me: Me; run: Run }) {
  const { t, i18n } = useTranslation()
  const ask = useConfirm()
  const now = useNow()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [notices, setNotices] = useState<Notice[]>([])

  const load = useCallback(
    () =>
      Promise.all([
        api.request<Booking[]>('/bookings').then(setBookings),
        api.request<Notice[]>('/notices').then(setNotices),
      ]),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  const runs = useMemo(() => mergeRuns(bookings.filter((b) => b.mine)), [bookings])
  const mineDates = runs.flatMap((r) => r.bookings.map((b) => new Date(b.slot_start)))
  const today = helsinki(now).date
  const left = hoursLeft(mineDates, today)
  const week = weekStart(today)
  const usedSoFar = mineDates.filter((d) => d <= now && weekStart(helsinki(d).date) === week).length
  const next = runs.find((r) => r.end > now)

  const cancelRun = async (bookings: Booking[]) => {
    const first = new Date(bookings[0].slot_start)
    const when = `${dayLabel(helsinki(first).date, i18n.language)}, ${timeLabel(helsinki(first).hour, bookings.length)}`
    if (await ask(t('calendar.confirmCancel', { when }), t('calendar.cancelBooking')))
      run(() => Promise.all(bookings.map((b) => api.request(`/bookings/${b.id}`, 'DELETE'))), load)
  }

  return (
    <section className="mine-view">
      {notices.map((notice) => {
        const slot = new Date(notice.slot_start)
        const when = `${dayLabel(helsinki(slot).date, i18n.language)} ${timeLabel(helsinki(slot).hour)}`
        return (
          <p key={notice.id} className="notice pending" role="status">
            <span>{t('mine.cancelNotice', { when })}</span>
            <button
              type="button"
              className="link"
              onClick={() => run(() => api.request(`/notices/${notice.id}/dismiss`, 'POST'), load)}
            >
              {t('mine.dismiss')}
            </button>
          </p>
        )
      })}

      <section className="mine-summary">
        <div className="usage">
          <UsageCard label={t('calendar.thisWeek')} left={left.week} max={MAX_PER_WEEK} />
          <UsageCard label={t('mine.today')} left={left.day} max={MAX_PER_DAY} />
        </div>
        {usedSoFar > 0 && <p className="hint">{t('mine.usedSoFar', { count: usedSoFar })}</p>}
        {(left.day === 0 || left.week === 0) && (
          <p className="hint">{t('mine.lastMinute', { hours: LAST_MINUTE_HOURS })}</p>
        )}
      </section>

      <section className="card runs-card">
        <div className="runs-head">
          <h2>{t('mine.upcoming')}</h2>
          <a className="btn" href="#/calendar/next">
            {t('mine.bookSlot')}
          </a>
        </div>
        {runs.length === 0 ? (
          <p className="empty">{t('mine.empty')}</p>
        ) : (
          <ol className="runs">
            {runs.map((bookingRun) => {
              const first = bookingRun.start
              const date = helsinki(first).date
              const hour = helsinki(first).hour
              const future = bookingRun.bookings.filter((b) =>
                canCancel(new Date(b.slot_start), true, me.isAdmin, now),
              )
              const isNext = next === bookingRun
              const past = bookingRun.end <= now
              return (
                <li key={bookingRun.bookings[0].id} className={past ? 'run past' : 'run'}>
                  <div>
                    <div className="run-when">
                      {dayLabel(date, i18n.language)}, {timeLabel(hour, bookingRun.bookings.length)}
                    </div>
                    {isNext && (
                      <span className="run-badge">
                        {bookingRun.start <= now
                          ? t('mine.now')
                          : relativeTime(bookingRun.start, now, i18n.language)}
                      </span>
                    )}
                  </div>
                  {!past && (
                    <div className="actions">
                      {future.length > 0 && (
                        <button
                          type="button"
                          className="btn danger"
                          onClick={() => cancelRun(future)}
                        >
                          {t('calendar.cancelBooking')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() =>
                          downloadIcs(
                            bookingRun.bookings,
                            t('title'),
                            t('address'),
                            t('calendar.exportFile'),
                            now,
                          )
                        }
                      >
                        {t('calendar.export')}
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </section>
  )
}
