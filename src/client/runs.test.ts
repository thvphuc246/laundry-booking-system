import { expect, test } from 'bun:test'
import { mergeRuns } from './runs'
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

test('mergeRuns sorts and merges adjacent bookings', () => {
  const runs = mergeRuns([booking('b', 2), booking('a', 1), booking('c', 4)])
  expect(runs).toHaveLength(2)
  expect(runs[0].bookings.map((b) => b.id)).toEqual(['a', 'b'])
  expect(runs[1].bookings.map((b) => b.id)).toEqual(['c'])
  expect(runs[0].start.toISOString()).toBe('2026-09-21T11:00:00.000Z')
  expect(runs[0].end.toISOString()).toBe('2026-09-21T13:00:00.000Z')
  expect(runs[1].start.toISOString()).toBe('2026-09-21T14:00:00.000Z')
  expect(runs[1].end.toISOString()).toBe('2026-09-21T15:00:00.000Z')
})
