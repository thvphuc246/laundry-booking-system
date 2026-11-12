import { isNull, sql } from 'drizzle-orm'
import {
  boolean,
  datetime,
  index,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core'
import { EVENT_TYPES } from '../shared/events.js'

const uuid = () => varchar({ length: 36 })
const id = () =>
  uuid()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())

export const buildings = mysqlTable('Buildings', {
  id: id(),
  address: varchar({ length: 255 }).notNull().unique(),
})

export const apartments = mysqlTable(
  'Apartments',
  {
    id: id(),
    building_id: uuid()
      .notNull()
      .references(() => buildings.id),
    code: varchar({ length: 16 }).notNull(),
  },
  (t) => [uniqueIndex('apartments_building_code').on(t.building_id, t.code)],
)

export const USER_STATUSES = ['new', 'pending', 'approved', 'rejected', 'revoked'] as const

export const users = mysqlTable('Users', {
  id: id(),
  email: varchar({ length: 255 }).notNull().unique(),
  name: varchar({ length: 255 }).notNull(),
  apartment_id: uuid().references(() => apartments.id),
  status: mysqlEnum(USER_STATUSES).notNull().default('new'),
  approved_apartment_id: uuid()
    .generatedAlwaysAs(sql`(case when status = 'approved' then apartment_id end)`, {
      mode: 'stored',
    })
    .unique(),
  created_at: timestamp().notNull().defaultNow(),
})

export const bookings = mysqlTable(
  'Bookings',
  {
    id: id(),
    building_id: uuid()
      .notNull()
      .references(() => buildings.id),
    apartment_id: uuid().references(() => apartments.id),
    booked_by_user_id: uuid()
      .notNull()
      .references(() => users.id),
    slot_start: datetime().notNull(),
    is_maintenance: boolean().notNull().default(false),
    deleted_at: timestamp(),
    deleted_by_user_id: uuid().references(() => users.id),
    notice_dismissed_at: timestamp(),
    active_slot: datetime().generatedAlwaysAs(
      sql`(case when deleted_at is null then slot_start end)`,
      {
        mode: 'virtual',
      },
    ),
    created_at: timestamp().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('bookings_building_active_slot').on(t.building_id, t.active_slot),
    index('bookings_apartment_slot').on(t.apartment_id, t.slot_start),
  ],
)

export const activeBooking = isNull(bookings.deleted_at)

export const events = mysqlTable(
  'Events',
  {
    id: id(),
    type: mysqlEnum(EVENT_TYPES).notNull(),
    actor_user_id: uuid()
      .notNull()
      .references(() => users.id),
    subject_user_id: uuid().references(() => users.id),
    apartment_id: uuid().references(() => apartments.id),
    booking_id: uuid().references(() => bookings.id),
    slot_start: datetime(),
    created_at: timestamp().notNull().defaultNow(),
  },
  (t) => [index('events_created_at').on(t.created_at)],
)

export type NewEvent = typeof events.$inferInsert

export type User = typeof users.$inferSelect
