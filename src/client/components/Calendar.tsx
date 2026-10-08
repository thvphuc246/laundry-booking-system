import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
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
  type RuleError,
  slotError,
  TZ,
  toUtc,
  weekStart,
} from '../../shared/rules'
import { ApiClient } from '../api'
import type { Booking, Me, Run } from '../types'
import { useConfirm } from './ConfirmDialog'
import { ClockIcon, WrenchIcon } from './icons'
import { UsageCard } from './UsageCard'

const api = ApiClient.getInstance()
const pad = (n: number) => String(n).padStart(2, '0')
const dayMonthLabel = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`
// Word joiner keeps the range on one line.
const timeLabel = (h: number) => `${pad(h)}:00–\u2060${pad(h + 1)}:00`
const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), max)
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

type Kind = 'free' | 'maint' | 'mine' | 'taken'
type Cell = {
  slot: Date
  booking: Booking | undefined
  kind: Kind
  past: boolean
  blocked: RuleError | null
  action: 'book' | 'cancel' | null
}
type Pos = [day: number, hour: number]

function slotKind(b: Booking | undefined): Kind {
  if (!b) return 'free'
  if (b.maintenance) return 'maint'
  return b.mine ? 'mine' : 'taken'
}

export function Calendar({ me, run }: { me: Me; run: Run }) {
  const { t, i18n } = useTranslation()
  const ask = useConfirm()
  const table = useRef<HTMLTableElement>(null)
  const [now, setNow] = useState(() => new Date())
  const [bookings, setBookings] = useState<Booking[]>([])
  const [maintenance, setMaintenance] = useState(false)
  const [active, setActive] = useState<Pos | null>(null)
  const [flash, setFlash] = useState<number | null>(null)

  const load = useCallback(() => api.request<Booking[]>('/bookings').then(setBookings), [])
  useEffect(() => {
    load()
  }, [load])
  // Keep "past" up to date while the page stays open.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const today = helsinki(now).date
  const days = Array.from({ length: BOOK_AHEAD_DAYS + 1 }, (_, i) => addDays(today, i))
  const hours = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i)
  const weeks = [...new Set(days.map(weekStart))]

  const approved = me.status === 'approved'
  const canBook = approved || (me.isAdmin && maintenance)
  const bySlot = new Map(bookings.map((b) => [new Date(b.slot_start).getTime(), b]))
  const mine = bookings.filter((b) => b.mine).map((b) => new Date(b.slot_start))
  const mineDays = mine.map((d) => helsinki(d).date)

  const grid: Cell[][] = days.map((d) =>
    hours.map((h) => {
      const slot = toUtc(d, h)
      const booking = bySlot.get(slot.getTime())
      const past = slot <= now
      const blocked = slotError(slot, now) ?? (maintenance ? null : limitError(mine, slot))
      let action: Cell['action'] = null
      if (booking && !past && (booking.mine || me.isAdmin)) action = 'cancel'
      if (!booking && canBook && !blocked) action = 'book'
      return { slot, booking, kind: slotKind(booking), past, blocked, action }
    }),
  )

  // Earliest slot this user could book right now (or, if they can't book, the earliest free one).
  let earliest: Pos | null = null
  for (let di = 0; di < days.length && !earliest; di++)
    for (let hi = 0; hi < hours.length && !earliest; hi++) {
      const c = grid[di][hi]
      if (canBook ? c.action === 'book' : c.kind === 'free' && !c.past) earliest = [di, hi]
    }

  const [focusDay, focusHour] = active ?? earliest ?? [0, 0]

  const weekday = new Intl.DateTimeFormat(i18n.language, { timeZone: TZ, weekday: 'short' })
  const dayLabel = (d: string) => `${weekday.format(toUtc(d, 12))} ${dayMonthLabel(d)}`

  const cellAt = (di: number, hi: number) =>
    table.current?.querySelector<HTMLButtonElement>(`[data-pos="${di}-${hi}"]`)

  const focusCell = (di: number, hi: number) => {
    setActive([di, hi])
    cellAt(di, hi)?.focus()
  }

  const jumpToEarliest = () => {
    if (!earliest) return
    const [di, hi] = earliest
    const el = cellAt(di, hi)
    setActive(earliest)
    setFlash(grid[di][hi].slot.getTime())
    el?.scrollIntoView({
      behavior: reducedMotion() ? 'auto' : 'smooth',
      block: 'center',
      inline: 'center',
    })
    el?.focus({ preventScroll: true })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTableSectionElement>) => {
    const moves: Record<string, Pos> = {
      ArrowLeft: [focusDay - 1, focusHour],
      ArrowRight: [focusDay + 1, focusHour],
      ArrowUp: [focusDay, focusHour - 1],
      ArrowDown: [focusDay, focusHour + 1],
      Home: [0, focusHour],
      End: [days.length - 1, focusHour],
    }
    const next = moves[e.key]
    if (!next) return
    e.preventDefault()
    focusCell(clamp(next[0], days.length - 1), clamp(next[1], hours.length - 1))
  }

  const act = async (c: Cell, d: string, h: number) => {
    const when = `${dayLabel(d)}, ${timeLabel(h)}`
    const b = c.booking
    if (c.action === 'cancel' && b) {
      if (await ask(t('calendar.confirmCancel', { when }), t('calendar.cancelBooking')))
        run(() => api.request(`/bookings/${b.id}`, 'DELETE'), load)
    }
    if (c.action === 'book') {
      const message = t(maintenance ? 'calendar.confirmMaintenance' : 'calendar.confirmBook', {
        when,
      })
      if (await ask(message, t('calendar.book'), 'primary'))
        run(
          () => api.request('/bookings', 'POST', { slot_start: c.slot.toISOString(), maintenance }),
          load,
        )
    }
  }

  const status = (c: Cell) => {
    const b = c.booking
    const who = {
      free: t('calendar.free'),
      maint: t('calendar.maintenance'),
      mine: `${b?.apartment} (${t('calendar.yours')})`,
      taken: b?.apartment ?? t('calendar.taken'),
    }[c.kind]
    return c.past ? `${who} – ${t('calendar.past')}` : who
  }

  const hint = (c: Cell) => {
    if (c.past) return t('calendar.pastHint')
    if (c.action === 'book') return t('calendar.clickToBook')
    if (c.action === 'cancel') return t('calendar.clickToCancel')
    if (c.kind === 'free' && canBook && c.blocked) return t(`errors.${c.blocked}`)
    return undefined
  }

  const weekLabel = (w: string, i: number) =>
    [t('calendar.thisWeek'), t('calendar.nextWeek')][i] ??
    t('calendar.weekOf', { date: dayMonthLabel(w) })

  const earliestCell = earliest && grid[earliest[0]][earliest[1]]

  return (
    <section className="calendar">
      {approved && (
        <div className="usage">
          {weeks.map((w, i) => (
            <UsageCard
              key={w}
              label={weekLabel(w, i)}
              used={mineDays.filter((d) => weekStart(d) === w).length}
              max={MAX_PER_WEEK}
            />
          ))}
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

      <div className="grid-toolbar">
        <ul className="legend" aria-label={t('calendar.legend')}>
          {(['free', 'mine', 'taken', 'maint', 'past'] as const).map((k) => (
            <li key={k}>
              <span className={`swatch ${k === 'past' ? 'free past' : k}`} />
              {t(`calendar.legendItems.${k}`)}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn secondary jump"
          disabled={!earliestCell}
          onClick={jumpToEarliest}
        >
          <ClockIcon />
          {earliest && earliestCell ? (
            <span>
              {t('calendar.earliest')}{' '}
              <span className="jump-when">
                {dayLabel(days[earliest[0]])} · {pad(hours[earliest[1]])}:00
              </span>
            </span>
          ) : (
            t('calendar.noneAvailable')
          )}
        </button>
      </div>

      <div className="card grid-card">
        <table ref={table} className="grid">
          <caption className="sr-only">{t('calendar.caption')}</caption>
          <thead>
            <tr>
              <th scope="col" className="corner">
                <span className="sr-only">{t('calendar.time')}</span>
              </th>
              {days.map((d, di) => {
                const used = mineDays.filter((x) => x === d).length
                const classes = [
                  d === today && 'today',
                  di > 0 && d === weekStart(d) && 'week-start',
                ].filter(Boolean)
                return (
                  <th key={d} scope="col" className={classes.join(' ') || undefined}>
                    <span className="col-dow">{weekday.format(toUtc(d, 12))}</span>
                    <span className="col-date">{dayMonthLabel(d)}</span>
                    {approved && (
                      <span
                        className="pips"
                        title={t('calendar.hours', { used, max: MAX_PER_DAY })}
                        role="img"
                        aria-label={t('calendar.dayUsage', { used, max: MAX_PER_DAY })}
                      >
                        {Array.from({ length: MAX_PER_DAY }, (_, i) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decoration
                          <span key={i} className={i < used ? 'pip on' : 'pip'} />
                        ))}
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody onKeyDown={onKeyDown}>
            {hours.map((h, hi) => (
              <tr key={h}>
                <th scope="row">{pad(h)}:00</th>
                {days.map((d, di) => {
                  const c = grid[di][hi]
                  const key = c.slot.getTime()
                  const classes = [
                    'cell',
                    c.kind,
                    c.past && 'past',
                    c.kind === 'free' && !c.past && !c.action && 'blocked',
                    c.action === 'book' && 'bookable',
                    flash === key && 'flash',
                  ].filter(Boolean)
                  const tip = hint(c)
                  return (
                    <td key={d} className={di > 0 && d === weekStart(d) ? 'week-start' : undefined}>
                      <button
                        type="button"
                        data-pos={`${di}-${hi}`}
                        className={classes.join(' ')}
                        tabIndex={di === focusDay && hi === focusHour ? 0 : -1}
                        aria-disabled={!c.action}
                        aria-label={`${dayLabel(d)}, ${timeLabel(h)}: ${status(c)}${tip ? `. ${tip}` : ''}`}
                        title={tip}
                        onFocus={() => setActive([di, hi])}
                        onClick={() => act(c, d, h)}
                        onAnimationEnd={() => setFlash(null)}
                      >
                        {c.kind === 'maint' ? (
                          <WrenchIcon size={14} />
                        ) : (
                          <span className="cell-text">{c.booking?.apartment}</span>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
