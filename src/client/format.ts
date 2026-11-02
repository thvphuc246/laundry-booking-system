import { TZ, toUtc } from '../shared/rules'

const weekdays = new Map<string, Intl.DateTimeFormat>()

export const pad = (n: number) => String(n).padStart(2, '0')
export const dayMonthLabel = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`
export const timeLabel = (h: number, hours = 1) => `${pad(h)}:00–\u2060${pad(h + hours)}:00`

export function weekdayFormat(language: string) {
  const existing = weekdays.get(language)
  if (existing) return existing
  const format = new Intl.DateTimeFormat(language, { timeZone: TZ, weekday: 'short' })
  weekdays.set(language, format)
  return format
}

export function dayLabel(date: string, language: string) {
  return `${weekdayFormat(language).format(toUtc(date, 12))} ${dayMonthLabel(date)}`
}

export function relativeTime(target: Date, now: Date, language: string) {
  const minutes = Math.round((target.getTime() - now.getTime()) / 60_000)
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 48) return format.format(hours, 'hour')
  return format.format(Math.round(hours / 24), 'day')
}
