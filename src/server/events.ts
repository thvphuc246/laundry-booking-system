import type { EventType } from '../shared/events.js'
import type { db } from './db.js'
import { events, type NewEvent } from './schema.js'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export const recordEvents = async (tx: Tx, rows: NewEvent[]) => {
  if (rows.length) await tx.insert(events).values(rows)
}

export const bookingEvent =
  (type: EventType, actorUserId: string) =>
  (b: {
    id: string
    apartment_id?: string | null
    booked_by_user_id: string
    slot_start: Date
  }): NewEvent => ({
    type,
    actor_user_id: actorUserId,
    apartment_id: b.apartment_id ?? null,
    subject_user_id: b.booked_by_user_id,
    booking_id: b.id,
    slot_start: b.slot_start,
  })
