import { afterAll, expect, setSystemTime, test } from 'bun:test'
import { EVENT_TYPES, type EventType } from '../shared/events.js'
import type { DispatchedEvent } from './events.js'
import { adminCancelMails, adminRequestMails, decisionMails } from './statusEmails.js'
import { subscribers } from './subscribers.js'

const NOW = new Date('2026-09-21T10:00:00Z')
setSystemTime(NOW)
afterAll(() => setSystemTime())

const HOUR = 3_600_000
const at = (hours: number) => new Date(NOW.getTime() + hours * HOUR)

const resident = {
  id: crypto.randomUUID(),
  name: 'Aino',
  email: 'aino@example.test',
  language: 'fi' as const,
  status: 'approved' as const,
}

const event = (over: Partial<DispatchedEvent> = {}): DispatchedEvent => ({
  id: crypto.randomUUID(),
  type: 'resident_approved',
  created_at: NOW,
  slot_start: null,
  actor: { id: crypto.randomUUID(), name: 'Admin' },
  subject: resident,
  apartment: 'A1',
  ...over,
})

test('decisionMails writes to the subject in their language', () => {
  const appUrl = 'https://example.test/laundry'
  const mails = decisionMails(event({ type: 'resident_approved' }), appUrl)

  expect(mails).toHaveLength(1)
  expect(mails[0].to).toBe('aino@example.test')
  expect(mails[0].subject).toBe('Pesutuvan käyttöoikeutesi on hyväksytty')
  expect(mails[0].text.split('\n')).toContain('Hei Aino,')
  expect(mails[0].text).toContain(appUrl)
  expect(mails[0].text).toContain('A1')
})

test('adminCancelMails emails the resident whose booking an admin cancelled', () => {
  const appUrl = 'https://example.test/laundry'
  const mails = adminCancelMails(
    event({ type: 'booking_cancelled', slot_start: at(20) }),
    NOW,
    appUrl,
  )

  expect(mails).toHaveLength(1)
  expect(mails[0].to).toBe('aino@example.test')
  expect(mails[0].subject).toBe('Pesutupavarauksesi peruttiin')
  expect(mails[0].text).toContain('Ylläpitäjä perui varauksesi')
  expect(mails[0].text).toContain(appUrl)
})

test('adminCancelMails sends nothing when the resident cancelled or nothing is left to send', () => {
  const cancelled = event({ type: 'booking_cancelled', slot_start: at(20) })
  const cases: DispatchedEvent[] = [
    { ...cancelled, actor: { id: resident.id, name: resident.name } },
    { ...cancelled, apartment: null },
    { ...cancelled, slot_start: at(-1) },
    { ...cancelled, subject: { ...resident, status: 'revoked' } },
    { ...cancelled, slot_start: null },
    { ...cancelled, subject: null },
  ]

  for (const e of cases) expect(adminCancelMails(e, NOW)).toEqual([])
})

test('adminRequestMails writes to each admin in their own language and skips the requester', () => {
  const appUrl = 'https://example.test/laundry'
  const requester = event({
    type: 'apartment_requested',
    subject: { ...resident, email: 'admin@example.test' },
  })
  const mails = adminRequestMails(
    requester,
    [
      { email: 'admin@example.test', name: 'Admin', language: 'fi' },
      { email: 'boss@example.test', name: 'Boss', language: 'sv' },
    ],
    appUrl,
  )

  expect(mails).toHaveLength(1)
  expect(mails[0].to).toBe('boss@example.test')
  expect(mails[0].subject).toBe('Ny åtkomstbegäran')
  expect(mails[0].text.split('\n')).toContain('Hej Boss,')
  expect(mails[0].text).toContain('Aino')
  expect(mails[0].text).toContain(appUrl)
})

test('subscribers covers real event types only', () => {
  for (const type of Object.keys(subscribers)) expect(EVENT_TYPES).toContain(type as EventType)
})
