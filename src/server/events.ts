import { and, asc, eq, isNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/mysql-core'
import type { EventType } from '../shared/events.js'
import { db } from './db.js'
import { type Mail, type Send, send } from './mail.js'
import {
  apartments,
  events,
  type NewEvent,
  type USER_LANGUAGES,
  type USER_STATUSES,
  users,
} from './schema.js'
import { subscribers } from './subscribers.js'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type DispatchedEvent = {
  id: string
  type: EventType
  created_at: Date
  slot_start: Date | null
  actor: { id: string; name: string }
  subject: {
    id: string
    name: string
    email: string
    language: (typeof USER_LANGUAGES)[number]
    status: (typeof USER_STATUSES)[number]
  } | null
  apartment: string | null
}
export type Subscriber = (e: DispatchedEvent, now: Date) => Mail[] | Promise<Mail[]>

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

export async function dispatchEvents(now: Date, sendMail: Send = send): Promise<number> {
  try {
    const actor = alias(users, 'actor')
    const subject = alias(users, 'subject')
    const rows = await db
      .select({
        id: events.id,
        type: events.type,
        created_at: events.created_at,
        slot_start: events.slot_start,
        actor: { id: actor.id, name: actor.name },
        subject: {
          id: subject.id,
          name: subject.name,
          email: subject.email,
          language: subject.language,
          status: subject.status,
        },
        apartment: apartments.code,
      })
      .from(events)
      .innerJoin(actor, eq(actor.id, events.actor_user_id))
      .leftJoin(subject, eq(subject.id, events.subject_user_id))
      .leftJoin(apartments, eq(apartments.id, events.apartment_id))
      .where(isNull(events.processed_at))
      .orderBy(asc(events.created_at), asc(events.id))
    let sent = 0
    for (const row of rows) {
      const e: DispatchedEvent = { ...row, subject: row.subject?.id == null ? null : row.subject }
      const [claimed] = await db
        .update(events)
        .set({ processed_at: now })
        .where(and(eq(events.id, e.id), isNull(events.processed_at)))
      if (claimed.affectedRows !== 1) continue
      for (const subscriber of subscribers[e.type] ?? []) {
        try {
          const mails = await subscriber(e, now)
          const results = await Promise.allSettled(mails.map(sendMail))
          for (const result of results) {
            if (result.status === 'fulfilled') sent++
            else console.error(result.reason)
          }
        } catch (e) {
          console.error(e)
        }
      }
    }
    return sent
  } catch (e) {
    console.error(e)
    return 0
  }
}
