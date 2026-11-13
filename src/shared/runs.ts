export type SlotRun<T> = { bookings: T[]; start: Date; end: Date }

const HOUR = 3_600_000

export function mergeRuns<T extends { slot_start: string | Date }>(bookings: T[]): SlotRun<T>[] {
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime(),
  )
  const runs: SlotRun<T>[] = []
  for (const booking of sorted) {
    const start = new Date(booking.slot_start)
    const end = new Date(start.getTime() + HOUR)
    const last = runs.at(-1)
    if (last?.end.getTime() === start.getTime()) {
      last.bookings.push(booking)
      last.end = end
    } else {
      runs.push({ bookings: [booking], start, end })
    }
  }
  return runs
}
