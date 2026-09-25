import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  addDays, BOOK_AHEAD_DAYS, CLOSE_HOUR, helsinki, limitError, MAX_PER_DAY, MAX_PER_WEEK,
  OPEN_HOUR, slotError, toUtc, TZ, weekStart,
} from '../shared/rules'

type Status = 'new' | 'pending' | 'approved' | 'rejected' | 'revoked'
type Me = { id: number; email: string; name: string; status: Status; apartment: string | null; isAdmin: boolean }
type Booking = { id: number; slot_start: string; apartment: string | null; maintenance: boolean; mine: boolean }
type Apartment = { id: number; code: string; taken: boolean }
type AdminUser = { id: number; email: string; name: string; status: Status; apartment: string | null }

class ApiError extends Error {}

async function api<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error ?? 'server_error')
  return data as T
}

export function App() {
  const { t } = useTranslation()
  const [me, setMe] = useState<Me | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const loadMe = useCallback(() => api<Me>('/me').then(setMe, () => setMe(null)), [])
  useEffect(() => { loadMe() }, [loadMe])

  const run = useCallback(async (fn: () => Promise<unknown>, after?: () => unknown) => {
    setError(null)
    try { await fn() } catch (e) { setError(e instanceof ApiError ? e.message : 'server_error') }
    await after?.()
  }, [])

  if (me === undefined) return <main><p>{t('loading')}</p></main>

  return (
    <main>
      <header>
        <div>
          <h1>{t('title')}</h1>
          <small>{t('address')}</small>
        </div>
        {me && (
          <div className="who">
            <span>{me.name}{me.status === 'approved' && me.apartment ? ` · ${me.apartment}` : ''}</span>
            <button className="link" onClick={() => run(() => api('/auth/logout', 'POST'), () => setMe(null))}>{t('logout')}</button>
          </div>
        )}
      </header>

      {error && <p className="error" role="alert">{t(`errors.${error}`, { defaultValue: error })}</p>}

      {!me ? (
        <section>
          <p>{t('loginHint')}</p>
          <a className="button" href="/api/auth/google">{t('login')}</a>
        </section>
      ) : (
        <>
          {me.status !== 'approved' && <p className="notice">{t(`status.${me.status}`, { apartment: me.apartment })}</p>}
          {['new', 'rejected', 'revoked'].includes(me.status) && <ApartmentPicker run={run} onDone={loadMe} />}
          <Calendar me={me} run={run} />
          {me.isAdmin && <AdminPanel run={run} onChange={loadMe} />}
        </>
      )}
    </main>
  )
}

type Run = (fn: () => Promise<unknown>, after?: () => unknown) => Promise<void>

function ApartmentPicker({ run, onDone }: { run: Run; onDone: () => void }) {
  const { t } = useTranslation()
  const [list, setList] = useState<Apartment[]>([])
  const [selected, setSelected] = useState('')
  useEffect(() => { api<Apartment[]>('/apartments').then(setList) }, [])

  return (
    <form className="picker" onSubmit={(e) => {
      e.preventDefault()
      run(() => api('/me/apartment', 'POST', { apartment_id: Number(selected) }), onDone)
    }}>
      <label>
        {t('picker.label')}{' '}
        <select value={selected} onChange={(e) => setSelected(e.target.value)} required>
          <option value="">{t('picker.choose')}</option>
          {list.map((a) => (
            <option key={a.id} value={a.id} disabled={a.taken}>{a.code}{a.taken ? ` (${t('picker.taken')})` : ''}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={!selected}>{t('picker.submit')}</button>
    </form>
  )
}

function Calendar({ me, run }: { me: Me; run: Run }) {
  const { t, i18n } = useTranslation()
  const today = helsinki(new Date()).date
  const days = Array.from({ length: BOOK_AHEAD_DAYS + 1 }, (_, i) => addDays(today, i))
  const [day, setDay] = useState(today)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [maintenance, setMaintenance] = useState(false)

  const load = useCallback(() => api<Booking[]>('/bookings').then(setBookings), [])
  useEffect(() => { load() }, [load, me.status])

  const bySlot = new Map(bookings.map((b) => [new Date(b.slot_start).getTime(), b]))
  const mine = bookings.filter((b) => b.mine).map((b) => new Date(b.slot_start))
  const usedDay = mine.filter((d) => helsinki(d).date === day).length
  const usedWeek = mine.filter((d) => weekStart(helsinki(d).date) === weekStart(day)).length
  const canBook = me.status === 'approved' || (me.isAdmin && maintenance)
  const now = new Date()

  const dayLabel = new Intl.DateTimeFormat(i18n.language, { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'numeric' })
  const hours = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i)

  return (
    <section>
      <nav className="days">
        {days.map((d) => (
          <button key={d} className={d === day ? 'active' : ''} aria-pressed={d === day} onClick={() => setDay(d)}>
            {dayLabel.format(toUtc(d, 12))}
          </button>
        ))}
      </nav>

      {me.status === 'approved' && (
        <p className="usage">{t('calendar.usage', { day: usedDay, maxDay: MAX_PER_DAY, week: usedWeek, maxWeek: MAX_PER_WEEK })}</p>
      )}
      {me.isAdmin && (
        <label className="maintenance-toggle">
          <input type="checkbox" checked={maintenance} onChange={(e) => setMaintenance(e.target.checked)} /> {t('calendar.maintenanceMode')}
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
            <li key={h} className={[b ? 'taken' : 'free', b?.mine ? 'mine' : '', past ? 'past' : ''].join(' ')}>
              <span className="time">{pad(h)}:00–{pad(h + 1)}:00</span>
              <span className="who">
                {b ? (b.maintenance ? t('calendar.maintenance') : `${b.apartment}${b.mine ? ` (${t('calendar.yours')})` : ''}`) : t('calendar.free')}
              </span>
              {b && !past && (b.mine || me.isAdmin) && (
                <button onClick={() => confirm(t('calendar.confirmCancel')) && run(() => api(`/bookings/${b.id}`, 'DELETE'), load)}>
                  {t('calendar.cancel')}
                </button>
              )}
              {!b && canBook && !past && (
                <button disabled={!!blocked} title={blocked ? t(`errors.${blocked}`) : undefined}
                  onClick={() => run(() => api('/bookings', 'POST', { slot_start: slot.toISOString(), maintenance }), load)}>
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

function AdminPanel({ run, onChange }: { run: Run; onChange: () => void }) {
  const { t } = useTranslation()
  const [list, setList] = useState<AdminUser[]>([])
  const load = useCallback(() => api<AdminUser[]>('/admin/users').then(setList), [])
  useEffect(() => { load() }, [load])

  const act = (u: AdminUser, action: 'approve' | 'reject' | 'revoke') => {
    if (action === 'revoke' && !confirm(t('admin.confirmRevoke', { name: u.name }))) return
    run(() => api(`/admin/users/${u.id}/${action}`, 'POST'), () => { load(); onChange() })
  }

  return (
    <section>
      <h2>{t('admin.title')}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>{t('admin.name')}</th><th>{t('admin.email')}</th><th>{t('admin.apartment')}</th><th>{t('admin.state')}</th><th /></tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.apartment ?? '–'}</td>
                <td>{t(`states.${u.status}`)}</td>
                <td className="actions">
                  {u.status === 'pending' && <>
                    <button onClick={() => act(u, 'approve')}>{t('admin.approve')}</button>
                    <button onClick={() => act(u, 'reject')}>{t('admin.reject')}</button>
                  </>}
                  {u.status === 'approved' && <button onClick={() => act(u, 'revoke')}>{t('admin.revoke')}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
