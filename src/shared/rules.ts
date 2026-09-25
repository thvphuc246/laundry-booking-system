export const TZ = 'Europe/Helsinki'
export const OPEN_HOUR = 7
export const CLOSE_HOUR = 22
export const MAX_PER_DAY = 2
export const MAX_PER_WEEK = 6
export const BOOK_AHEAD_DAYS = 14

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export function helsinki(d: Date) {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) }
}

const utcMs = (date: string, hour = 0, minute = 0) => {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d, hour, minute)
}

export function toUtc(date: string, hour = 0): Date {
  const wall = utcMs(date, hour)
  let t = wall
  for (let i = 0; i < 2; i++) {
    const h = helsinki(new Date(t))
    t = wall - (utcMs(h.date, h.hour, h.minute) - t)
  }
  return new Date(t)
}

export function addDays(date: string, n: number) {
  return new Date(utcMs(date) + n * 86_400_000).toISOString().slice(0, 10)
}

export function weekStart(date: string) {
  const dow = new Date(utcMs(date)).getUTCDay()
  return addDays(date, -((dow + 6) % 7))
}

export type RuleError = 'invalid_slot' | 'past' | 'too_far' | 'day_limit' | 'week_limit'

export function slotError(slot: Date, now: Date): RuleError | null {
  const { date, hour, minute } = helsinki(slot)
  if (minute !== 0 || slot.getUTCSeconds() || slot.getUTCMilliseconds() || hour < OPEN_HOUR || hour >= CLOSE_HOUR) return 'invalid_slot'
  if (slot <= now) return 'past'
  if (date > addDays(helsinki(now).date, BOOK_AHEAD_DAYS)) return 'too_far'
  return null
}

export function limitError(existing: Date[], slot: Date): RuleError | null {
  const { date } = helsinki(slot)
  const week = weekStart(date)
  const days = existing.map((e) => helsinki(e).date)
  if (days.filter((d) => d === date).length >= MAX_PER_DAY) return 'day_limit'
  if (days.filter((d) => weekStart(d) === week).length >= MAX_PER_WEEK) return 'week_limit'
  return null
}
