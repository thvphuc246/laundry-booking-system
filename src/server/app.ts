import { googleAuth } from '@hono/oauth-providers/google'
import { and, asc, eq, gt, gte, lt, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { addDays, BOOK_AHEAD_DAYS, helsinki, limitError, slotError, toUtc, weekStart } from '../shared/rules.js'
import { BUILDING_ID, db, isDuplicate } from './db.js'
import { apartments, bookings, users, type User } from './schema.js'

const SECRET = process.env.SESSION_SECRET
if (!SECRET) throw new Error('SESSION_SECRET is not set')
const ADMINS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)

type Env = { Variables: { user: User; isAdmin: boolean } }

export const app = new Hono<Env>().basePath('/api')

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'server_error' }, 500)
})


app.get('/auth/google', googleAuth({ scope: ['openid', 'email', 'profile'] }), async (c) => {
  const g = c.get('user-google')
  if (!g?.email || !g.verified_email) return c.text('Google account email is not verified', 403)
  const email = g.email.toLowerCase()
  const name = g.name || email
  await db.insert(users).values({ email, name }).onDuplicateKeyUpdate({ set: { name } })
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
  await setSignedCookie(c, 'sid', String(u.id), SECRET, {
    path: '/', httpOnly: true, sameSite: 'Lax', maxAge: 60 * 60 * 24 * 30,
    secure: new URL(c.req.url).protocol === 'https:',
  })
  return c.redirect('/')
})

app.post('/auth/logout', (c) => {
  deleteCookie(c, 'sid', { path: '/' })
  return c.json({ ok: true })
})

const auth = createMiddleware<Env>(async (c, next) => {
  const id = await getSignedCookie(c, SECRET, 'sid')
  const [u] = id ? await db.select().from(users).where(eq(users.id, Number(id))) : []
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
  const [apt] = u.apartment_id ? await db.select().from(apartments).where(eq(apartments.id, u.apartment_id)) : []
  return c.json({ id: u.id, email: u.email, name: u.name, status: u.status, apartment: apt?.code ?? null, isAdmin: c.get('isAdmin') })
})

app.get('/apartments', async (c) => {
  const list = await db.select({ id: apartments.id, code: apartments.code }).from(apartments)
    .where(eq(apartments.building_id, BUILDING_ID)).orderBy(asc(apartments.id))
  const taken = new Set((await db.select({ a: users.approved_apartment_id }).from(users)).map((r) => r.a))
  return c.json(list.map((a) => ({ ...a, taken: taken.has(a.id) })))
})

app.post('/me/apartment', async (c) => {
  const u = c.get('user')
  if (u.status === 'approved') return c.json({ error: 'already_approved' }, 409)
  const { apartment_id } = await c.req.json<{ apartment_id: number }>()
  const [apt] = await db.select().from(apartments).where(eq(apartments.id, Number(apartment_id)))
  if (!apt) return c.json({ error: 'invalid_apartment' }, 400)
  const [holder] = await db.select({ id: users.id }).from(users).where(eq(users.approved_apartment_id, apt.id))
  if (holder) return c.json({ error: 'apartment_taken' }, 409)
  await db.update(users).set({ apartment_id: apt.id, status: 'pending' }).where(eq(users.id, u.id))
  return c.json({ ok: true })
})

app.get('/bookings', async (c) => {
  const u = c.get('user')
  const today = helsinki(new Date()).date
  const from = toUtc(weekStart(today))
  const to = toUtc(addDays(weekStart(addDays(today, BOOK_AHEAD_DAYS)), 7))
  const rows = await db.select({
    id: bookings.id, slot_start: bookings.slot_start, apartment_id: bookings.apartment_id,
    apartment: apartments.code, maintenance: bookings.is_maintenance,
  }).from(bookings).leftJoin(apartments, eq(apartments.id, bookings.apartment_id))
    .where(and(eq(bookings.building_id, BUILDING_ID), gte(bookings.slot_start, from), lt(bookings.slot_start, to)))
  const mine = u.status === 'approved' ? u.apartment_id : null
  return c.json(rows.map(({ apartment_id, ...r }) => ({ ...r, mine: mine != null && apartment_id === mine })))
})

app.post('/bookings', async (c) => {
  const u = c.get('user')
  const body = await c.req.json<{ slot_start: string; maintenance?: boolean }>()
  const slot = new Date(body.slot_start)
  if (isNaN(slot.getTime())) return c.json({ error: 'invalid_slot' }, 400)
  const err = slotError(slot, new Date())
  if (err) return c.json({ error: err }, 400)

  try {
    if (body.maintenance) {
      if (!c.get('isAdmin')) return c.json({ error: 'forbidden' }, 403)
      await db.insert(bookings).values({ building_id: BUILDING_ID, booked_by_user_id: u.id, slot_start: slot, is_maintenance: true })
      return c.json({ ok: true })
    }
    const aptId = u.apartment_id
    if (u.status !== 'approved' || aptId == null) return c.json({ error: 'not_approved' }, 403)

    const limit = await db.transaction(async (tx) => {
      const [apt] = await tx.select().from(apartments).where(eq(apartments.id, aptId)).for('update')
      const week = weekStart(helsinki(slot).date)
      const existing = await tx.select({ s: bookings.slot_start }).from(bookings).where(and(
        eq(bookings.apartment_id, aptId), gte(bookings.slot_start, toUtc(week)), lt(bookings.slot_start, toUtc(addDays(week, 7))),
      ))
      const e = limitError(existing.map((r) => r.s), slot)
      if (e) return e
      await tx.insert(bookings).values({ building_id: apt.building_id, apartment_id: aptId, booked_by_user_id: u.id, slot_start: slot })
      return null
    })
    if (limit) return c.json({ error: limit }, 409)
    return c.json({ ok: true })
  } catch (e) {
    if (isDuplicate(e)) return c.json({ error: 'slot_taken' }, 409)
    throw e
  }
})

app.delete('/bookings/:id', async (c) => {
  const u = c.get('user')
  const [b] = await db.select().from(bookings).where(eq(bookings.id, Number(c.req.param('id'))))
  if (!b) return c.json({ error: 'not_found' }, 404)
  const own = u.status === 'approved' && b.apartment_id != null && b.apartment_id === u.apartment_id && b.slot_start > new Date()
  if (!own && !c.get('isAdmin')) return c.json({ error: 'forbidden' }, 403)
  await db.delete(bookings).where(eq(bookings.id, b.id))
  return c.json({ ok: true })
})


app.get('/admin/users', async (c) => {
  const rows = await db.select({
    id: users.id, email: users.email, name: users.name, status: users.status, apartment: apartments.code,
  }).from(users).leftJoin(apartments, eq(apartments.id, users.apartment_id)).orderBy(asc(users.status), asc(users.id))
  return c.json(rows)
})

app.post('/admin/users/:id/:action{approve|reject|revoke}', async (c) => {
  const [t] = await db.select().from(users).where(eq(users.id, Number(c.req.param('id'))))
  if (!t) return c.json({ error: 'not_found' }, 404)
  const action = c.req.param('action')

  if (action === 'approve') {
    if (t.status !== 'pending' || t.apartment_id == null) return c.json({ error: 'not_pending' }, 409)
    const aptId = t.apartment_id
    try {
      await db.transaction(async (tx) => {
        await tx.update(users).set({ status: 'approved' }).where(eq(users.id, t.id))
        await tx.update(users).set({ status: 'rejected' })
          .where(and(eq(users.apartment_id, aptId), eq(users.status, 'pending'), ne(users.id, t.id)))
      })
    } catch (e) {
      if (isDuplicate(e)) return c.json({ error: 'apartment_taken' }, 409)
      throw e
    }
  } else if (action === 'reject') {
    if (t.status !== 'pending') return c.json({ error: 'not_pending' }, 409)
    await db.update(users).set({ status: 'rejected' }).where(eq(users.id, t.id))
  } else {
    if (t.status !== 'approved' || t.apartment_id == null) return c.json({ error: 'not_approved' }, 409)
    const aptId = t.apartment_id
    await db.transaction(async (tx) => {
      await tx.update(users).set({ status: 'revoked' }).where(eq(users.id, t.id))
      await tx.delete(bookings).where(and(eq(bookings.apartment_id, aptId), gt(bookings.slot_start, new Date())))
    })
  }
  return c.json({ ok: true })
})
