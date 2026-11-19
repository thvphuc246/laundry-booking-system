import { and, eq, gt, inArray, lt, or } from 'drizzle-orm'
import type { EventType } from '../shared/events.js'
import { dayLabel, timeLabel } from '../shared/format.js'
import { helsinki } from '../shared/rules.js'
import { ADMINS, db } from './db.js'
import type { DispatchedEvent } from './events.js'
import { APP_URL, i18n, letter, type Mail } from './mail.js'
import { events, users } from './schema.js'

const REQUEST_EMAIL_HOURS = 24

export type Admin = { email: string; name: string; language: string }

const decisionKind = (type: EventType) =>
  type === 'resident_approved'
    ? 'approved'
    : type === 'resident_rejected'
      ? 'rejected'
      : type === 'resident_revoked'
        ? 'revoked'
        : null

export function decisionMails(e: DispatchedEvent, appUrl = APP_URL): Mail[] {
  const kind = decisionKind(e.type)
  const subject = e.subject
  if (!kind || !subject) return []
  const t = i18n.getFixedT(subject.language)
  return [
    {
      to: subject.email,
      subject: t(`email.${kind}.subject`),
      text: letter(subject.language, subject.name, [
        t(`email.${kind}.text`, { apartment: e.apartment, url: appUrl }),
      ]),
    },
  ]
}

export function adminCancelMails(e: DispatchedEvent, now: Date, appUrl = APP_URL): Mail[] {
  const subject = e.subject
  const slotStart = e.slot_start
  if (!subject || !slotStart || e.apartment == null) return []
  if (e.actor.id === subject.id) return []
  if (subject.status !== 'approved') return []
  if (slotStart <= now) return []
  const h = helsinki(slotStart)
  const when = `${dayLabel(h.date, subject.language)} ${timeLabel(h.hour)}`
  const t = i18n.getFixedT(subject.language)
  return [
    {
      to: subject.email,
      subject: t('email.cancelled.subject'),
      text: letter(subject.language, subject.name, [
        t('email.cancelled.text', { when, url: appUrl }),
      ]),
    },
  ]
}

export function adminRequestMails(e: DispatchedEvent, admins: Admin[], appUrl = APP_URL): Mail[] {
  const subject = e.subject
  if (!subject) return []
  return admins
    .filter((admin) => admin.email !== subject.email)
    .map((admin) => {
      const t = i18n.getFixedT(admin.language)
      return {
        to: admin.email,
        subject: t('email.request.subject'),
        text: letter(admin.language, admin.name, [
          t('email.request.text', {
            resident: subject.name,
            apartment: e.apartment,
            url: appUrl,
          }),
        ]),
      }
    })
}

export async function requestMails(e: DispatchedEvent): Promise<Mail[]> {
  const subject = e.subject
  if (!subject || ADMINS.length === 0) return []
  const since = new Date(e.created_at.getTime() - REQUEST_EMAIL_HOURS * 3_600_000)
  const [earlier] = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.type, 'apartment_requested'),
        eq(events.subject_user_id, subject.id),
        gt(events.created_at, since),
        or(
          lt(events.created_at, e.created_at),
          and(eq(events.created_at, e.created_at), lt(events.id, e.id)),
        ),
      ),
    )
    .limit(1)
  if (earlier) return []
  const rows = await db
    .select({ email: users.email, name: users.name, language: users.language })
    .from(users)
    .where(inArray(users.email, ADMINS))
  const admins = ADMINS.map(
    (email) => rows.find((r) => r.email === email) ?? { email, name: email, language: 'en' },
  )
  return adminRequestMails(e, admins, APP_URL)
}
