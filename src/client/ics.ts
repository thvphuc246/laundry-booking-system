import type { Booking } from './types'

const HOUR = 3_600_000
const stamp = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '')
const text = (s: string) => s.replace(/[;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')

type Event = { id: string; start: Date; end: Date }

function mergeAdjacent(bookings: Booking[]) {
  const starts = bookings
    .map((b) => ({ id: b.id, start: new Date(b.slot_start) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
  const events: Event[] = []
  for (const { id, start } of starts) {
    const end = new Date(start.getTime() + HOUR)
    const last = events.at(-1)
    if (last?.end.getTime() === start.getTime()) last.end = end
    else events.push({ id, start, end })
  }
  return events
}

export function bookingsToIcs(bookings: Booking[], summary: string, location: string, now: Date) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Laundry booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...mergeAdjacent(bookings).flatMap((e) => [
      'BEGIN:VEVENT',
      `UID:${e.id}@laundry-booking`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SUMMARY:${text(summary)}`,
      `LOCATION:${text(location)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${text(summary)}`,
      'TRIGGER:-PT15M',
      'END:VALARM',
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ]
  return `${lines.join('\r\n')}\r\n`
}
