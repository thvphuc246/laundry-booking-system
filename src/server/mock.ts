import { eq, isNotNull } from 'drizzle-orm'
import {
  addDays,
  BOOK_AHEAD_DAYS,
  CLOSE_HOUR,
  helsinki,
  limitError,
  OPEN_HOUR,
  toUtc,
} from '../shared/rules.js'
import { BUILDING_ID, db } from './db.js'
import { apartments, bookings, users } from './schema.js'
import { wipe } from './wipe.js'

export const MOCK_DOMAIN = 'example.test'
const APPROVED = 60
const PENDING = 10
const PAST_DAYS = 28
const MAINTENANCE_DAYS = [-10, 5]
const MAINTENANCE_HOURS = [7, 8]
const NO_LAST_MINUTE = new Date(0)

const FIRST = [
  'Aino',
  'Eero',
  'Linnea',
  'Mikael',
  'Saara',
  'Juho',
  'Elsa',
  'Oskari',
  'Venla',
  'Lukas',
  'Ida',
  'Emil',
  'Maja',
  'Noah',
  'Helmi',
  'Anton',
  'Ebba',
  'Aleksandra',
]
const LAST = [
  'Virtanen',
  'Korhonen',
  'Nieminen',
  'Mäkinen',
  'Lindqvist',
  'Andersson',
  'Smith',
  'Nguyen',
  'Johansson',
  'Heikkinen',
  'Laine',
  'Karlsson',
  'Hämäläinen-Söderström',
]

type NewUser = typeof users.$inferInsert & { id: string }
type NewBooking = typeof bookings.$inferInsert

const seededRandom = (seed: number) => {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const busyness = (hour: number) => (hour >= 17 ? 0.9 : hour >= 10 ? 0.6 : 0.35)

const resident = (
  i: number,
  status: NewUser['status'],
  apartment_id: string | null = null,
): NewUser => ({
  id: crypto.randomUUID(),
  email: `resident${i + 1}@${MOCK_DOMAIN}`,
  name: `${FIRST[i % FIRST.length]} ${LAST[(i * 5) % LAST.length]}`,
  status,
  apartment_id,
})

export async function mock(now = new Date()) {
  await wipe()
  const held = new Set(
    (
      await db
        .select({ id: users.approved_apartment_id })
        .from(users)
        .where(isNotNull(users.approved_apartment_id))
    ).map((r) => r.id),
  )
  const apts = (await db.select().from(apartments).where(eq(apartments.building_id, BUILDING_ID)))
    .filter((a) => !held.has(a.id))
    .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }))
  const free = apts.slice(APPROVED)
  if (!free.length) throw new Error('Not enough apartments: run bun run db:seed first')

  const approved = apts.slice(0, APPROVED).map((a, i) => resident(i, 'approved', a.id))
  const pending = [free[0], ...free]
    .slice(0, PENDING)
    .map((a, i) => resident(APPROVED + i, 'pending', a.id))
  let n = APPROVED + PENDING
  const others = [
    resident(n++, 'rejected', free[0].id),
    resident(n++, 'rejected', apts[0].id),
    resident(n++, 'revoked', apts[1].id),
    resident(n++, 'new'),
  ]
  const maintainer: NewUser = {
    id: crypto.randomUUID(),
    email: `maintenance@${MOCK_DOMAIN}`,
    name: 'Kiinteistöhuolto',
    status: 'new',
  }

  const random = seededRandom(42)
  const today = helsinki(now).date
  const taken = new Map(approved.map((u) => [u.id, [] as Date[]]))
  const rows: NewBooking[] = []
  for (let day = -PAST_DAYS; day <= BOOK_AHEAD_DAYS; day++) {
    const date = addDays(today, day)
    for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
      const slot_start = toUtc(date, hour)
      if (MAINTENANCE_DAYS.includes(day) && MAINTENANCE_HOURS.includes(hour)) {
        rows.push({
          building_id: BUILDING_ID,
          booked_by_user_id: maintainer.id,
          slot_start,
          is_maintenance: true,
        })
        continue
      }
      if (random() > busyness(hour)) continue
      for (let attempt = 0; attempt < 5; attempt++) {
        const u = approved[Math.floor(random() * approved.length)]
        const mine = taken.get(u.id) ?? []
        if (limitError(mine, slot_start, NO_LAST_MINUTE)) continue
        mine.push(slot_start)
        rows.push({
          building_id: BUILDING_ID,
          apartment_id: u.apartment_id,
          booked_by_user_id: u.id,
          slot_start,
        })
        break
      }
    }
  }

  const people = [...approved, ...pending, ...others, maintainer]
  await db.insert(users).values(people)
  await db.insert(bookings).values(rows)
  return { users: people.length, bookings: rows.length }
}

if (import.meta.main) {
  const { users, bookings } = await mock()
  console.log(`Mocked ${users} users and ${bookings} bookings`)
  process.exit(0)
}
