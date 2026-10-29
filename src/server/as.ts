import { and, eq, ne } from 'drizzle-orm'
import { ADMINS, BUILDING_ID, db } from './db.js'
import { apartments, USER_STATUSES, users } from './schema.js'
import { assertTestDb } from './wipe.js'

type Status = (typeof USER_STATUSES)[number]
const isStatus = (s: string | undefined): s is Status =>
  USER_STATUSES.some((status) => status === s)

const [status, code] = process.argv.slice(2)
if (!isStatus(status))
  throw new Error(`Usage: bun run test:as <${USER_STATUSES.join('|')}> [apartment code]`)
assertTestDb()
const email = ADMINS[0]
if (!email) throw new Error('ADMIN_EMAILS is empty')
const [me] = await db.select().from(users).where(eq(users.email, email))
if (!me) throw new Error(`Sign in with Google as ${email} once first`)

const buildingApartments = await db
  .select()
  .from(apartments)
  .where(eq(apartments.building_id, BUILDING_ID))

const pickApartment = async () => {
  if (code) {
    const apt = buildingApartments.find((a) => a.code === code)
    if (!apt) throw new Error(`No apartment ${code}`)
    return apt
  }
  const current = buildingApartments.find((a) => a.id === me.apartment_id)
  if (current) return current
  const held = new Set(
    (await db.select({ id: users.approved_apartment_id }).from(users)).map((r) => r.id),
  )
  const free = buildingApartments
    .filter((a) => !held.has(a.id))
    .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }))[0]
  if (!free) throw new Error('Every apartment is taken: pass an apartment code to take one over')
  return free
}

const apt = status === 'new' ? null : await pickApartment()
await db.transaction(async (tx) => {
  if (status === 'approved' && apt) {
    await tx
      .update(users)
      .set({ status: 'revoked' })
      .where(and(eq(users.approved_apartment_id, apt.id), ne(users.id, me.id)))
    await tx
      .update(users)
      .set({ status: 'rejected' })
      .where(and(eq(users.apartment_id, apt.id), eq(users.status, 'pending'), ne(users.id, me.id)))
  }
  await tx
    .update(users)
    .set({ status, apartment_id: apt?.id ?? null })
    .where(eq(users.id, me.id))
})
console.log(`${email} is now ${status}${apt ? ` in ${apt.code}` : ''}`)
process.exit(0)
