import { expect, test } from 'bun:test'
import { bookingsToIcs } from './ics'
import type { Booking } from './types'

const NOW = new Date('2026-09-21T10:00:00Z')
const HOUR = 3_600_000

const booking = (id: string, hoursFromNow: number): Booking => ({
  id,
  slot_start: new Date(NOW.getTime() + hoursFromNow * HOUR).toISOString(),
  apartment: 'A1',
  maintenance: false,
  mine: true,
})

test('bookingsToIcs merges back-to-back hours into one event and escapes text', () => {
  const ics = bookingsToIcs(
    [booking('b', 2), booking('a', 1), booking('c', 5)],
    'Laundry room',
    'Street 2, Espoo',
    NOW,
  )
  const lines = ics.split('\r\n')
  expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(2)
  expect(lines).toContain('UID:a@laundry-booking')
  expect(lines).toContain('DTSTART:20260921T110000Z')
  expect(lines).toContain('DTEND:20260921T130000Z')
  expect(lines).toContain('DTSTART:20260921T150000Z')
  expect(lines).toContain('DTSTAMP:20260921T100000Z')
  expect(lines).toContain('LOCATION:Street 2\\, Espoo')
  expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
})
