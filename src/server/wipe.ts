import { notInArray } from 'drizzle-orm'
import { ADMINS, db } from './db.js'
import { bookings, users } from './schema.js'

export function assertTestDb(url = process.env.DATABASE_URL ?? '') {
  const { hostname, pathname } = new URL(url)
  if (['localhost', '127.0.0.1'].includes(hostname) || pathname.includes('test')) return
  throw new Error(
    `Refusing to touch ${hostname}${pathname}: use localhost or a database whose name contains "test"`,
  )
}

export async function wipe() {
  assertTestDb()
  await db.delete(bookings)
  await db.delete(users).where(ADMINS.length ? notInArray(users.email, ADMINS) : undefined)
}

if (import.meta.main) {
  await wipe()
  console.log('Wiped all bookings and every user not in ADMIN_EMAILS')
  process.exit(0)
}
