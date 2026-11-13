import { and, eq, isNull, type SQL } from 'drizzle-orm'
import i18next from 'i18next'
import nodemailer from 'nodemailer'
import en from '../client/locales/en.json' with { type: 'json' }
import fi from '../client/locales/fi.json' with { type: 'json' }
import sv from '../client/locales/sv.json' with { type: 'json' }
import { dayLabel, timeLabel } from '../shared/format.js'
import { helsinki } from '../shared/rules.js'
import { mergeRuns } from '../shared/runs.js'
import { db } from './db.js'
import { activeBooking, apartments, bookings, type USER_LANGUAGES, users } from './schema.js'

export type Mail = { to: string; subject: string; text: string }
export type Send = (mail: Mail) => Promise<unknown>
export type ReminderRow = {
  id: string
  slot_start: Date
  email: string
  name: string
  language: (typeof USER_LANGUAGES)[number]
  apartment: string
}

const i18n = i18next.createInstance()
await i18n.init({
  resources: { en: { translation: en }, fi: { translation: fi }, sv: { translation: sv } },
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

const SMTP_URL = process.env.SMTP_URL
const transport = SMTP_URL ? nodemailer.createTransport(SMTP_URL) : null

export const send: Send = transport
  ? (mail) =>
      transport.sendMail({
        from: {
          name: i18n.t('appName'),
          address: decodeURIComponent(new URL(SMTP_URL as string).username),
        },
        ...mail,
      })
  : async (mail) => console.log('reminder', mail)

export const APP_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:5173'

export function reminderMails(rows: ReminderRow[], appUrl: string): Mail[] {
  const groups = new Map<string, ReminderRow[]>()
  for (const row of rows) {
    const group = groups.get(row.email)
    if (group) group.push(row)
    else groups.set(row.email, [row])
  }
  return [...groups.values()].map((group) => {
    const resident = group[0]
    const t = i18n.getFixedT(resident.language)
    const lines = [
      t('email.greeting', { name: resident.name }),
      '',
      t('email.intro', { apartment: resident.apartment }),
      ...mergeRuns(group).map(
        (run) =>
          `${dayLabel(helsinki(run.start).date, resident.language)} ${timeLabel(helsinki(run.start).hour, run.bookings.length)}`,
      ),
      '',
      t('email.cancel', { url: appUrl }),
      '',
      `${t('title')}, ${t('address')}`,
    ]
    return { to: resident.email, subject: t('email.subject'), text: lines.join('\n') }
  })
}

export async function remindBookings(
  where: SQL | undefined,
  now: Date,
  sendMail: Send = send,
): Promise<number> {
  try {
    const rows = await db
      .select({
        id: bookings.id,
        slot_start: bookings.slot_start,
        email: users.email,
        name: users.name,
        language: users.language,
        apartment: apartments.code,
      })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.booked_by_user_id))
      .innerJoin(apartments, eq(apartments.id, bookings.apartment_id))
      .where(
        and(where, activeBooking, eq(bookings.is_maintenance, false), isNull(bookings.reminded_at)),
      )
    const claimed: ReminderRow[] = []
    for (const row of rows) {
      const [result] = await db
        .update(bookings)
        .set({ reminded_at: now })
        .where(and(eq(bookings.id, row.id), isNull(bookings.reminded_at), activeBooking))
      if (result.affectedRows === 1) claimed.push(row)
    }
    let sent = 0
    for (const mail of reminderMails(claimed, APP_URL)) {
      try {
        await sendMail(mail)
        sent++
      } catch (e) {
        console.error(e)
      }
    }
    return sent
  } catch (e) {
    console.error(e)
    return 0
  }
}
