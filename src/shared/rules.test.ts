import { expect, test } from 'bun:test'
import { helsinki, limitError, slotError, toUtc, weekStart } from './rules'

test('toUtc handles Helsinki DST (UTC+2 winter, UTC+3 summer)', () => {
  expect(toUtc('2026-01-15', 7).toISOString()).toBe('2026-01-15T05:00:00.000Z')
  expect(toUtc('2026-07-15', 7).toISOString()).toBe('2026-07-15T04:00:00.000Z')
  expect(toUtc('2026-03-29', 7).toISOString()).toBe('2026-03-29T04:00:00.000Z')
  expect(toUtc('2026-10-25', 7).toISOString()).toBe('2026-10-25T05:00:00.000Z')
  expect(toUtc('2026-10-25', 0).toISOString()).toBe('2026-10-24T21:00:00.000Z')
  expect(helsinki(toUtc('2026-03-29', 21))).toEqual({ date: '2026-03-29', hour: 21, minute: 0 })
})

test('weekStart is Monday', () => {
  expect(weekStart('2026-09-25')).toBe('2026-09-21')
  expect(weekStart('2026-09-21')).toBe('2026-09-21')
  expect(weekStart('2026-09-27')).toBe('2026-09-21')
})

test('slotError', () => {
  const now = toUtc('2026-09-25', 12)
  expect(slotError(toUtc('2026-09-25', 13), now)).toBeNull()
  expect(slotError(toUtc('2026-09-25', 11), now)).toBe('past')
  expect(slotError(toUtc('2026-09-26', 6), now)).toBe('invalid_slot')
  expect(slotError(toUtc('2026-09-26', 22), now)).toBe('invalid_slot')
  expect(slotError(new Date(toUtc('2026-09-26', 8).getTime() + 1800_000), now)).toBe('invalid_slot')
  expect(slotError(toUtc('2026-10-09', 21), now)).toBeNull()
  expect(slotError(toUtc('2026-10-10', 7), now)).toBe('too_far')
})

test('limitError: 2/day, 6/week, Helsinki calendar', () => {
  const s = (d: string, h: number) => toUtc(d, h)
  expect(limitError([s('2026-09-21', 7)], s('2026-09-21', 8))).toBeNull()
  expect(limitError([s('2026-09-21', 7), s('2026-09-21', 8)], s('2026-09-21', 9))).toBe('day_limit')
  const six = ['21', '22', '23'].flatMap((d) => [s(`2026-09-${d}`, 7), s(`2026-09-${d}`, 8)])
  expect(limitError(six, s('2026-09-27', 7))).toBe('week_limit')
  expect(limitError(six, s('2026-09-28', 7))).toBeNull()
  expect(helsinki(new Date('2026-09-20T21:30:00Z')).date).toBe('2026-09-21')
})
