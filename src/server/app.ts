import { googleAuth } from '@hono/oauth-providers/google'
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, ne } from 'drizzle-orm'
import { alias } from 'drizzle-orm/mysql-core'
import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { csrf } from 'hono/csrf'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { sign, verify } from 'hono/jwt'
import { validator } from 'hono/validator'
import { EVENTS_PAGE } from '../shared/events.js'
import {
  addDays,
  BOOK_AHEAD_DAYS,
  canCancel,
  digestWindow,
  helsinki,
  MAX_RUN_HOURS,
  remindsNow,
  runLimitError,
  slotError,
  slotRun,
  toUtc,
  weekStart,
} from '../shared/rules.js'
import { ADMINS, BUILDING_ID, db, isDuplicate } from './db.js'
import { bookingEvent, recordEvents } from './events.js'
import { remindBookings } from './reminders.js'
import {
  activeBooking,
  apartments,
  bookings,
  events,
  type NewEvent,
  USER_LANGUAGES,
  type User,
  users,
} from './schema.js'

const SECRET = process.env.SESSION_SECRET
if (!SECRET) throw new Error('SESSION_SECRET is not set')
const SESSION_SECONDS = 60 * 60 * 24

const sessionUserId = async (token: string | undefined) => {
  if (!token) return null
  const payload = await verify(token, SECRET, 'HS256').catch(() => null)
  return typeof payload?.sub === 'string' ? payload.sub : null
}

type Env = { Variables: { user: User; isAdmin: boolean } }

const residentApartmentId = (u: User) => (u.status === 'approved' ? u.apartment_id : null)

const apartmentBody = validator('json', (v, c) =>
  typeof v?.apartment_id === 'string'
    ? { apartmentId: v.apartment_id as string }
    : c.json({ error: 'invalid_apartment' }, 400),
)

const adminActionBody = validator('json', (v) => ({
  apartment: typeof v?.apartment === 'string' ? (v.apartment as string) : undefined,
}))

const slotBody = validator('json', (v, c) => {
  const slot = new Date(v?.slot_start)
  const hours = v?.hours ?? 1
  if (
    typeof v?.slot_start !== 'string' ||
    Number.isNaN(slot.getTime()) ||
    !Number.isInteger(hours) ||
    hours < 1 ||
    hours > MAX_RUN_HOURS
  )
    return c.json({ error: 'invalid_slot' }, 400)
  return { slots: slotRun(slot, hours), maintenance: v.maintenance === true }
})

export const app = new Hono<Env>().basePath('/api')

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse()
  console.error(err)
  return c.json({ error: 'server_error' }, 500)
})

app.use('*', csrf())

app.get('/auth/google', googleAuth({ scope: ['openid', 'email', 'profile'] }), async (c) => {
  const g = c.get('user-google')
  if (!g?.email || !g.verified_email) return c.text('Google account email is not verified', 403)
  const email = g.email.toLowerCase()
  const name = g.name || email
  await db.insert(users).values({ email, name }).onDuplicateKeyUpdate({ set: { name } })
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS
  setCookie(c, 'sid', await sign({ sub: u.id, exp }, SECRET, 'HS256'), {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: SESSION_SECONDS,
    secure: new URL(c.req.url).protocol === 'https:',
  })
  return c.redirect('/')
})

app.post('/auth/logout', (c) => {
  deleteCookie(c, 'sid', { path: '/' })
  return c.json({ ok: true })
})

app.get(
  '/cron/reminders',
  bearerAuth({ token: process.env.CRON_SECRET || crypto.randomUUID() }),
  async (c) => {
    const now = new Date()
    const { from, to } = digestWindow(now)
    const sent = await remindBookings(
      and(
        eq(bookings.building_id, BUILDING_ID),
        gte(bookings.slot_start, from),
        lt(bookings.slot_start, to),
      ),
      now,
    )
    return c.json({ sent })
  },
)

const auth = createMiddleware<Env>(async (c, next) => {
  const id = await sessionUserId(getCookie(c, 'sid'))
  const [u] = id ? await db.select().from(users).where(eq(users.id, id)) : []
  if (!u) return c.json({ error: 'unauthorized' }, 401)
  c.set('user', u)
  c.set('isAdmin', ADMINS.includes(u.email))
  await next()
})

const admin = createMiddleware<Env>(async (c, next) => {
  if (!c.get('isAdmin')) return c.json({ error: 'forbidden' }, 403)
  await next()
})

app.use('*', auth).use('/admin/*', admin)

app.get('/me', async (c) => {
  const u = c.get('user')
  const [apt] = u.apartment_id
    ? await db.select().from(apartments).where(eq(apartments.id, u.apartment_id))
    : []
  return c.json({
    id: u.id,
    email: u.email,
    name: u.name,
    status: u.status,
    apartment: apt?.code ?? null,
    isAdmin: c.get('isAdmin'),
    language: u.language,
  })
})

const languageBody = validator('json', (v, c) =>
  USER_LANGUAGES.includes(v?.language)
    ? { language: v.language as (typeof USER_LANGUAGES)[number] }
    : c.json({ error: 'invalid_language' }, 400),
)

app.post('/me/language', languageBody, async (c) => {
  const u = c.get('user')
  const { language } = c.req.valid('json')
  await db.update(users).set({ language }).where(eq(users.id, u.id))
  return c.json({ ok: true })
})

app.get('/apartments', async (c) => {
  const list = await db
    .select({ id: apartments.id, code: apartments.code })
    .from(apartments)
    .where(eq(apartments.building_id, BUILDING_ID))
  list.sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }))
  const taken = new Set(
    (await db.select({ a: users.approved_apartment_id }).from(users)).map((r) => r.a),
  )
  return c.json(list.map((a) => ({ ...a, taken: taken.has(a.id) })))
})

app.post('/me/apartment', apartmentBody, async (c) => {
  const u = c.get('user')
  if (u.status === 'approved') return c.json({ error: 'already_approved' }, 409)
  const { apartmentId } = c.req.valid('json')
  const [apt] = await db.select().from(apartments).where(eq(apartments.id, apartmentId))
  if (!apt) return c.json({ error: 'invalid_apartment' }, 400)
  const [holder] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.approved_apartment_id, apt.id))
  if (holder) return c.json({ error: 'apartment_taken' }, 409)
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ apartment_id: apt.id, status: 'pending' })
      .where(eq(users.id, u.id))
    await recordEvents(tx, [
      {
        type: 'apartment_requested',
        actor_user_id: u.id,
        subject_user_id: u.id,
        apartment_id: apt.id,
      },
    ])
  })
  return c.json({ ok: true })
})

app.get('/bookings', async (c) => {
  const u = c.get('user')
  if (u.status !== 'approved' && !c.get('isAdmin')) return c.json({ error: 'not_approved' }, 403)
  const today = helsinki(new Date()).date
  const from = toUtc(weekStart(today))
  const to = toUtc(addDays(weekStart(addDays(today, BOOK_AHEAD_DAYS)), 7))
  const rows = await db
    .select({
      id: bookings.id,
      slot_start: bookings.slot_start,
      apartment_id: bookings.apartment_id,
      apartment: apartments.code,
      maintenance: bookings.is_maintenance,
    })
    .from(bookings)
    .leftJoin(apartments, eq(apartments.id, bookings.apartment_id))
    .where(
      and(
        eq(bookings.building_id, BUILDING_ID),
        gte(bookings.slot_start, from),
        lt(bookings.slot_start, to),
        activeBooking,
      ),
    )
  const mine = residentApartmentId(u)
  return c.json(
    rows.map(({ apartment_id, apartment, ...r }) => ({
      ...r,
      apartment,
      mine: mine != null && apartment_id === mine,
    })),
  )
})

app.post('/bookings', slotBody, async (c) => {
  const u = c.get('user')
  const { slots, maintenance } = c.req.valid('json')
  const now = new Date()
  const err = slots.map((s) => slotError(s, now)).find(Boolean)
  if (err) return c.json({ error: err }, 400)

  try {
    if (maintenance) {
      if (!c.get('isAdmin')) return c.json({ error: 'forbidden' }, 403)
      const rows = slots.map((slot_start) => ({
        id: crypto.randomUUID(),
        building_id: BUILDING_ID,
        booked_by_user_id: u.id,
        slot_start,
        is_maintenance: true,
      }))
      await db.transaction(async (tx) => {
        await tx.insert(bookings).values(rows)
        await recordEvents(tx, rows.map(bookingEvent('booking_created', u.id)))
      })
      return c.json({ ok: true })
    }
    const aptId = residentApartmentId(u)
    if (aptId == null) return c.json({ error: 'not_approved' }, 403)

    const limit = await db.transaction(async (tx) => {
      const [apt] = await tx.select().from(apartments).where(eq(apartments.id, aptId)).for('update')
      const week = weekStart(helsinki(slots[0]).date)
      const existing = await tx
        .select({ s: bookings.slot_start })
        .from(bookings)
        .where(
          and(
            eq(bookings.apartment_id, aptId),
            gte(bookings.slot_start, toUtc(week)),
            lt(bookings.slot_start, toUtc(addDays(week, 7))),
            activeBooking,
          ),
        )
      const e = runLimitError(
        existing.map((r) => r.s),
        slots,
        now,
      )
      if (e) return e
      const rows = slots.map((slot_start) => ({
        id: crypto.randomUUID(),
        building_id: apt.building_id,
        apartment_id: aptId,
        booked_by_user_id: u.id,
        slot_start,
      }))
      await tx.insert(bookings).values(rows)
      await recordEvents(tx, rows.map(bookingEvent('booking_created', u.id)))
      return null
    })
    if (limit) return c.json({ error: limit }, 409)
    if (remindsNow(slots[0], now))
      await remindBookings(
        and(eq(bookings.apartment_id, aptId), inArray(bookings.slot_start, slots)),
        now,
      )
    return c.json({ ok: true })
  } catch (e) {
    if (isDuplicate(e)) return c.json({ error: 'slot_taken' }, 409)
    throw e
  }
})

app.delete('/bookings/:id', async (c) => {
  const u = c.get('user')
  const [b] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, c.req.param('id')), activeBooking))
  if (!b) return c.json({ error: 'not_found' }, 404)
  const mine = b.apartment_id != null && b.apartment_id === residentApartmentId(u)
  if (!canCancel(b.slot_start, mine, c.get('isAdmin'), new Date()))
    return c.json({ error: 'forbidden' }, 403)
  await db.transaction(async (tx) => {
    const [result] = await tx
      .update(bookings)
      .set({ deleted_at: new Date(), deleted_by_user_id: u.id })
      .where(and(eq(bookings.id, b.id), activeBooking))
    if (result.affectedRows === 1)
      await recordEvents(tx, [bookingEvent('booking_cancelled', u.id)(b)])
  })
  return c.json({ ok: true })
})

app.get('/notices', async (c) => {
  const u = c.get('user')
  const from = toUtc(weekStart(helsinki(new Date()).date))
  const rows = await db
    .select({ id: bookings.id, slot_start: bookings.slot_start })
    .from(bookings)
    .where(
      and(
        eq(bookings.booked_by_user_id, u.id),
        isNotNull(bookings.deleted_at),
        ne(bookings.deleted_by_user_id, u.id),
        isNull(bookings.notice_dismissed_at),
        gte(bookings.slot_start, from),
      ),
    )
    .orderBy(asc(bookings.slot_start))
  return c.json(rows)
})

app.post('/notices/:id/dismiss', async (c) => {
  const u = c.get('user')
  const [result] = await db
    .update(bookings)
    .set({ notice_dismissed_at: new Date() })
    .where(
      and(
        eq(bookings.id, c.req.param('id')),
        eq(bookings.booked_by_user_id, u.id),
        isNotNull(bookings.deleted_at),
        isNull(bookings.notice_dismissed_at),
      ),
    )
  if (((result as { affectedRows?: number }).affectedRows ?? 0) === 0)
    return c.json({ error: 'not_found' }, 404)
  return c.json({ ok: true })
})

app.get('/admin/users', async (c) => {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      status: users.status,
      apartment: apartments.code,
    })
    .from(users)
    .leftJoin(apartments, eq(apartments.id, users.apartment_id))
    .orderBy(asc(users.status), asc(users.created_at))
  return c.json(rows)
})

app.get('/admin/events', async (c) => {
  const actor = alias(users, 'actor')
  const subject = alias(users, 'subject')
  const offset = Math.max(0, Number(c.req.query('offset')) || 0)
  const rows = await db
    .select({
      id: events.id,
      type: events.type,
      created_at: events.created_at,
      slot_start: events.slot_start,
      actor: actor.name,
      subject: subject.name,
      apartment: apartments.code,
    })
    .from(events)
    .innerJoin(actor, eq(actor.id, events.actor_user_id))
    .leftJoin(subject, eq(subject.id, events.subject_user_id))
    .leftJoin(apartments, eq(apartments.id, events.apartment_id))
    .orderBy(desc(events.created_at), desc(events.slot_start), desc(events.id))
    .limit(EVENTS_PAGE)
    .offset(offset)
  return c.json(rows)
})

app.post('/admin/users/:id/:action{approve|reject|revoke}', adminActionBody, async (c) => {
  const [t] = await db
    .select()
    .from(users)
    .where(eq(users.id, c.req.param('id')))
  if (!t) return c.json({ error: 'not_found' }, 404)
  const action = c.req.param('action')

  if (action === 'approve') {
    if (t.status !== 'pending' || t.apartment_id == null)
      return c.json({ error: 'not_pending' }, 409)
    const aptId = t.apartment_id
    const [apt] = await db
      .select({ code: apartments.code })
      .from(apartments)
      .where(eq(apartments.id, aptId))
    const { apartment } = c.req.valid('json')
    if (!apt || apartment !== apt.code) return c.json({ error: 'apartment_changed' }, 409)
    try {
      const approved = await db.transaction(async (tx) => {
        const [result] = await tx
          .update(users)
          .set({ status: 'approved' })
          .where(
            and(eq(users.id, t.id), eq(users.status, 'pending'), eq(users.apartment_id, aptId)),
          )
        if (result.affectedRows === 0) return false
        const adminId = c.get('user').id
        const others = await tx
          .select({ id: users.id })
          .from(users)
          .where(
            and(eq(users.apartment_id, aptId), eq(users.status, 'pending'), ne(users.id, t.id)),
          )
          .for('update')
        await tx
          .update(users)
          .set({ status: 'rejected' })
          .where(
            and(eq(users.apartment_id, aptId), eq(users.status, 'pending'), ne(users.id, t.id)),
          )
        const rows: NewEvent[] = [
          {
            type: 'resident_approved',
            actor_user_id: adminId,
            subject_user_id: t.id,
            apartment_id: aptId,
          },
          ...others.map((o) => ({
            type: 'resident_rejected' as const,
            actor_user_id: adminId,
            subject_user_id: o.id,
            apartment_id: aptId,
          })),
        ]
        await recordEvents(tx, rows)
        return true
      })
      if (!approved) return c.json({ error: 'apartment_changed' }, 409)
    } catch (e) {
      if (isDuplicate(e)) return c.json({ error: 'apartment_taken' }, 409)
      throw e
    }
  } else if (action === 'reject') {
    if (t.status !== 'pending') return c.json({ error: 'not_pending' }, 409)
    const adminId = c.get('user').id
    await db.transaction(async (tx) => {
      const [result] = await tx
        .update(users)
        .set({ status: 'rejected' })
        .where(and(eq(users.id, t.id), eq(users.status, 'pending')))
      if (result.affectedRows === 1)
        await recordEvents(tx, [
          {
            type: 'resident_rejected',
            actor_user_id: adminId,
            subject_user_id: t.id,
            apartment_id: t.apartment_id,
          },
        ])
    })
  } else {
    if (t.status !== 'approved' || t.apartment_id == null)
      return c.json({ error: 'not_approved' }, 409)
    const aptId = t.apartment_id
    const adminId = c.get('user').id
    await db.transaction(async (tx) => {
      const future = await tx
        .select({
          id: bookings.id,
          apartment_id: bookings.apartment_id,
          booked_by_user_id: bookings.booked_by_user_id,
          slot_start: bookings.slot_start,
        })
        .from(bookings)
        .where(
          and(eq(bookings.apartment_id, aptId), gt(bookings.slot_start, new Date()), activeBooking),
        )
        .for('update')
      await tx.update(users).set({ status: 'revoked' }).where(eq(users.id, t.id))
      await tx
        .update(bookings)
        .set({ deleted_at: new Date(), deleted_by_user_id: adminId })
        .where(
          and(eq(bookings.apartment_id, aptId), gt(bookings.slot_start, new Date()), activeBooking),
        )
      await recordEvents(tx, [
        {
          type: 'resident_revoked',
          actor_user_id: adminId,
          subject_user_id: t.id,
          apartment_id: aptId,
        },
        ...future.map(bookingEvent('booking_cancelled', adminId)),
      ])
    })
  }
  return c.json({ ok: true })
})
