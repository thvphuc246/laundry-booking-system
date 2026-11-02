import { expect, test } from 'bun:test'
import { relativeTime } from './format'

const NOW = new Date('2026-09-21T10:00:00Z')
const HOUR = 3_600_000

test('relativeTime chooses minute, hour and day units', () => {
  expect(relativeTime(new Date(NOW.getTime() + 30 * 60_000), NOW, 'en')).toMatch(/minute/)
  expect(relativeTime(new Date(NOW.getTime() + 3 * HOUR), NOW, 'en')).toMatch(/hour/)
  expect(relativeTime(new Date(NOW.getTime() + 3 * 24 * HOUR), NOW, 'en')).toMatch(/day/)
})
