import { afterAll, expect, setSystemTime, test } from 'bun:test'
import type { ReminderRow } from './reminders.js'

const NOW = new Date('2026-09-21T10:00:00Z')
setSystemTime(NOW)
afterAll(() => setSystemTime())

const HOUR = 3_600_000
const at = (hours: number) => new Date(NOW.getTime() + hours * HOUR)

const { reminderMails } = await import('./reminders.js')

const row = (over: Partial<ReminderRow>): ReminderRow => ({
  id: crypto.randomUUID(),
  slot_start: at(20),
  email: 'a@example.test',
  name: 'A',
  language: 'en',
  apartment: 'A1',
  ...over,
})

test('reminderMails sends one email per resident, merging back-to-back runs', () => {
  const appUrl = 'https://example.test/laundry'
  const mails = reminderMails(
    [
      row({ slot_start: at(20) }),
      row({ slot_start: at(21) }),
      row({ slot_start: at(24) }),
      row({ email: 'b@example.test', name: 'B', language: 'fi', apartment: 'B2' }),
    ],
    appUrl,
  )

  expect(mails).toHaveLength(2)
  const [a, b] = mails
  expect(a.to).toBe('a@example.test')
  expect(a.subject).toBe('Laundry room reminder')
  expect(a.text.split('\n')).toContain('Tue 22.09 09:00–\u206011:00')
  expect(a.text.split('\n')).toContain('Tue 22.09 13:00–\u206014:00')
  expect(b.to).toBe('b@example.test')
  expect(b.subject).toBe('Pesutupamuistutus')
  for (const mail of mails) expect(mail.text).toContain(appUrl)
})
