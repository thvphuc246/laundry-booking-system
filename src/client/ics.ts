import { mergeRuns } from './runs'
import type { Booking } from './types'

export const REMINDER_MINUTES = 15
const stamp = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '')
const text = (s: string) => s.replace(/[;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')

export function bookingsToIcs(bookings: Booking[], summary: string, location: string, now: Date) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Laundry booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...mergeRuns(bookings).flatMap((run) => [
      'BEGIN:VEVENT',
      `UID:${run.bookings[0].id}@laundry-booking`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(run.start)}`,
      `DTEND:${stamp(run.end)}`,
      `SUMMARY:${text(summary)}`,
      `LOCATION:${text(location)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${text(summary)}`,
      `TRIGGER:-PT${REMINDER_MINUTES}M`,
      'END:VALARM',
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ]
  return `${lines.join('\r\n')}\r\n`
}

export function downloadIcs(
  bookings: Booking[],
  summary: string,
  location: string,
  fileName: string,
  now: Date,
) {
  const ics = bookingsToIcs(bookings, summary, location, now)
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url))
}
