import { and, eq, gte, like, lt } from 'drizzle-orm'
import { sign } from 'hono/jwt'
import {
  addDays,
  BOOK_AHEAD_DAYS,
  CLOSE_HOUR,
  helsinki,
  MAX_PER_WEEK,
  MAX_RUN_HOURS,
  OPEN_HOUR,
  toUtc,
  weekStart,
} from '../shared/rules.js'
import { BUILDING_ID, db } from './db.js'
import { MOCK_DOMAIN, mock } from './mock.js'
import { bookings, type User, users } from './schema.js'

const BASE = process.env.LOAD_URL ?? 'http://localhost:3000'
const SECRET = process.env.SESSION_SECRET
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const ROUNDS = 3
const SLOT_RACERS = 20

if (!SECRET) throw new Error('SESSION_SECRET is not set')

type Resident = User & { apartment_id: string; cookie: string }
type Reply = { status: number; error?: string; slots?: { slot_start: string }[] }

const timings = new Map<string, { ms: number[]; statuses: Record<number, number> }>()
const checks: { name: string; ok: boolean; detail: string }[] = []

const call = async (who: Resident, label: string, path: string, body?: unknown) => {
  const started = performance.now()
  const res = await fetch(`${BASE}/api${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      cookie: who.cookie,
      'content-type': 'application/json',
      ...(BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  const t = timings.get(label) ?? { ms: [], statuses: {} }
  t.ms.push(performance.now() - started)
  t.statuses[res.status] = (t.statuses[res.status] ?? 0) + 1
  timings.set(label, t)
  const reply: Reply = { status: res.status }
  if (Array.isArray(json)) reply.slots = json
  else if (typeof json?.error === 'string') reply.error = json.error
  return reply
}

const book = (who: Resident, label: string, slot: Date, hours = 1) =>
  call(who, label, '/bookings', { slot_start: slot.toISOString(), hours })

const check = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail })

const outcome = (replies: Reply[]) => {
  const counts = new Map<string, number>()
  for (const r of replies) {
    const key = `${r.status}${r.error ? ` ${r.error}` : ''}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts].map(([key, n]) => `${n}× ${key}`).join(', ')
}

const bookedBetween = (from: Date, to: Date) =>
  db
    .select({ apartment_id: bookings.apartment_id, slot_start: bookings.slot_start })
    .from(bookings)
    .where(
      and(
        eq(bookings.building_id, BUILDING_ID),
        gte(bookings.slot_start, from),
        lt(bookings.slot_start, to),
      ),
    )

async function races(residents: Resident[]) {
  const day = addDays(helsinki(new Date()).date, BOOK_AHEAD_DAYS - 1)
  const at = (hour: number) => toUtc(day, hour)
  await db
    .delete(bookings)
    .where(
      and(
        eq(bookings.building_id, BUILDING_ID),
        gte(bookings.slot_start, at(0)),
        lt(bookings.slot_start, toUtc(addDays(day, 1))),
      ),
    )
  const week = weekStart(day)
  const weekRows = await bookedBetween(toUtc(week), toUtc(addDays(week, 7)))
  const roomy = residents.filter(
    (r) =>
      r.status === 'approved' &&
      weekRows.filter((b) => b.apartment_id === r.apartment_id).length <=
        MAX_PER_WEEK - MAX_RUN_HOURS - 1,
  )
  if (roomy.length < SLOT_RACERS + 3) throw new Error('Not enough apartments with room to race')
  const [limited, runnerA, runnerB, ...slotRacers] = roomy

  const slotReplies = await Promise.all(
    slotRacers.slice(0, SLOT_RACERS).map((r) => book(r, 'race: same slot', at(10))),
  )
  const slotRows = await bookedBetween(at(10), at(11))
  check(
    `slot race: ${SLOT_RACERS} apartments, one slot`,
    slotReplies.filter((r) => r.status === 200).length === 1 &&
      slotReplies.filter((r) => r.error === 'slot_taken').length === SLOT_RACERS - 1 &&
      slotRows.length === 1,
    `${slotRows.length} booking in DB; replies: ${outcome(slotReplies)}`,
  )

  await db.insert(bookings).values({
    building_id: BUILDING_ID,
    apartment_id: limited.apartment_id,
    booked_by_user_id: limited.id,
    slot_start: at(15),
  })
  const limitReplies = await Promise.all([
    book(limited, 'race: day limit', at(17)),
    book(limited, 'race: day limit', at(19)),
  ])
  const limitRows = (await bookedBetween(at(0), at(CLOSE_HOUR))).filter(
    (b) => b.apartment_id === limited.apartment_id,
  )
  check(
    'limit race: 1 hour left today, two parallel bookings',
    limitReplies.filter((r) => r.status === 200).length === 1 &&
      limitReplies.some((r) => r.error === 'day_limit') &&
      limitRows.length === 2,
    `${limitRows.length} bookings today in DB; replies: ${outcome(limitReplies)}`,
  )

  const runReplies = await Promise.all([
    book(runnerA, 'race: overlapping runs', at(11), 2),
    book(runnerB, 'race: overlapping runs', at(12), 2),
  ])
  const runRows = await bookedBetween(at(11), at(14))
  const winner = runReplies[0].status === 200 ? runnerA : runnerB
  const winnerStart = winner === runnerA ? at(11) : at(12)
  check(
    'run race: two overlapping 2-hour runs',
    runReplies.filter((r) => r.status === 200).length === 1 &&
      runReplies.some((r) => r.error === 'slot_taken') &&
      runRows.length === 2 &&
      runRows.every(
        (b) =>
          b.apartment_id === winner.apartment_id &&
          b.slot_start.getTime() - winnerStart.getTime() < 2 * 3_600_000 &&
          b.slot_start >= winnerStart,
      ),
    `${runRows.length} bookings in DB; replies: ${outcome(runReplies)}`,
  )
}

const freeSlots = (booked: Set<number>, now: Date) => {
  const today = helsinki(now).date
  const slots: Date[] = []
  for (let day = 1; day <= BOOK_AHEAD_DAYS; day++)
    for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
      const slot = toUtc(addDays(today, day), hour)
      if (!booked.has(slot.getTime())) slots.push(slot)
    }
  return slots
}

async function visit(r: Resident) {
  await call(r, 'GET /me', '/me')
  const { slots = [] } = await call(r, 'GET /bookings', '/bookings')
  if (r.status !== 'approved') {
    await call(r, 'GET /apartments', '/apartments')
    return
  }
  const free = freeSlots(new Set(slots.map((b) => new Date(b.slot_start).getTime())), new Date())
  const slot = free[Math.floor(Math.random() * free.length)]
  if (slot) await book(r, 'POST /bookings', slot)
}

const percentile = (sorted: number[], p: number) =>
  Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))])

await mock()
const exp = Math.floor(Date.now() / 1000) + 60 * 60
const residents: Resident[] = await Promise.all(
  (
    await db
      .select()
      .from(users)
      .where(like(users.email, `%@${MOCK_DOMAIN}`))
  )
    .filter((u): u is User & { apartment_id: string } => u.apartment_id != null)
    .map(async (u) => ({ ...u, cookie: `sid=${await sign({ sub: u.id, exp }, SECRET, 'HS256')}` })),
)

console.log(`Racing against ${BASE}`)
await races(residents)
for (let round = 1; round <= ROUNDS; round++) {
  const started = performance.now()
  await Promise.all(residents.map(visit))
  console.log(
    `Peak round ${round}: ${residents.length} residents in ${Math.round(performance.now() - started)} ms`,
  )
}

console.table(
  Object.fromEntries(
    [...timings].map(([label, { ms, statuses }]) => {
      const sorted = [...ms].sort((a, b) => a - b)
      return [
        label,
        {
          n: sorted.length,
          p50: percentile(sorted, 0.5),
          p95: percentile(sorted, 0.95),
          max: percentile(sorted, 1),
          statuses: JSON.stringify(statuses),
        },
      ]
    }),
  ),
)
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}: ${c.detail}`)
const serverErrors = [...timings.values()]
  .flatMap((t) => Object.entries(t.statuses))
  .reduce((sum, [status, n]) => (Number(status) >= 500 ? sum + n : sum), 0)
if (serverErrors) console.log(`FAIL ${serverErrors} responses were 5xx`)
process.exit(checks.every((c) => c.ok) && !serverErrors ? 0 : 1)
