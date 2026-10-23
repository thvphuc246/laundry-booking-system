import { expect, test } from 'bun:test'
import {
  canCancel,
  helsinki,
  limitError,
  runLimitError,
  slotError,
  slotRun,
  toUtc,
  weekStart,
} from './rules'

const NOW = new Date('2026-09-20T10:00:00Z')

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
  expect(limitError([s('2026-09-21', 7)], s('2026-09-21', 8), NOW)).toBeNull()
  expect(limitError([s('2026-09-21', 7), s('2026-09-21', 8)], s('2026-09-21', 9), NOW)).toBe(
    'day_limit',
  )
  const six = ['21', '22', '23'].flatMap((d) => [s(`2026-09-${d}`, 7), s(`2026-09-${d}`, 8)])
  expect(limitError(six, s('2026-09-27', 7), NOW)).toBe('week_limit')
  expect(limitError(six, s('2026-09-28', 7), NOW)).toBeNull()
  expect(helsinki(new Date('2026-09-20T21:30:00Z')).date).toBe('2026-09-21')
})

test('canCancel allows own or admin cancellation of future slots only', () => {
  const now = new Date('2026-09-21T10:00:00Z')
  const future = new Date('2026-09-21T11:00:00Z')
  const past = new Date('2026-09-21T09:00:00Z')
  expect(canCancel(future, true, false, now)).toBe(true)
  expect(canCancel(future, false, true, now)).toBe(true)
  expect(canCancel(future, false, false, now)).toBe(false)
  expect(canCancel(past, true, true, now)).toBe(false)
})

test('limitError ignores limits for slots starting within 2 h', () => {
  const hour = (n: number) => new Date(NOW.getTime() + n * 3_600_000)
  const full = [hour(-2), hour(-1)]
  expect(limitError(full, hour(1), NOW)).toBeNull()
  expect(limitError(full, hour(2), NOW)).toBeNull()
  expect(limitError(full, hour(3), NOW)).toBe('day_limit')
})

test('slotRun lists consecutive hours; runLimitError counts earlier hours of the run', () => {
  const hour = (n: number) => new Date(NOW.getTime() + n * 3_600_000)
  const start = hour(24)
  const run = slotRun(start, 2)
  expect(run.map((d) => d.getTime() - start.getTime())).toEqual([0, 3_600_000])
  expect(runLimitError([], run, NOW)).toBeNull()
  expect(runLimitError([hour(23)], run, NOW)).toBe('day_limit')
  expect(runLimitError([hour(23)], slotRun(start, 1), NOW)).toBeNull()
  expect(runLimitError([hour(-2), hour(-1)], slotRun(hour(1), 2), NOW)).toBeNull()
})
