import { expect, test } from 'bun:test'
import en from '../client/locales/en.json'
import fi from '../client/locales/fi.json'
import sv from '../client/locales/sv.json'
import { EVENT_TYPES } from './events'
import { activityKey, dateTimeLabel, relativeTime } from './format'

const NOW = new Date('2026-09-21T10:00:00Z')
const HOUR = 3_600_000

test('relativeTime chooses minute, hour and day units', () => {
  expect(relativeTime(new Date(NOW.getTime() + 30 * 60_000), NOW, 'en')).toMatch(/minute/)
  expect(relativeTime(new Date(NOW.getTime() + 3 * HOUR), NOW, 'en')).toMatch(/hour/)
  expect(relativeTime(new Date(NOW.getTime() + 3 * 24 * HOUR), NOW, 'en')).toMatch(/day/)
})

test('activityKey picks the maintenance wording for a booking without an apartment', () => {
  expect(activityKey({ type: 'booking_created', apartment: null })).toBe(
    'activity.events.maintenance_created',
  )
  expect(activityKey({ type: 'booking_created', apartment: 'A1' })).toBe(
    'activity.events.booking_created',
  )
  expect(activityKey({ type: 'resident_approved', apartment: null })).toBe(
    'activity.events.resident_approved',
  )
})

const lookup = (data: Record<string, unknown>, path: string) =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], data)

test('every event type has text in every locale', () => {
  for (const type of EVENT_TYPES) {
    for (const apartment of [null, 'A1']) {
      const key = activityKey({ type, apartment })
      for (const locale of [en, fi, sv]) expect(typeof lookup(locale, key)).toBe('string')
    }
  }
})

test('dateTimeLabel shows Helsinki wall time', () => {
  expect(dateTimeLabel(NOW, 'en')).toMatch(/13:00$/)
})
