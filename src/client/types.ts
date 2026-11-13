import type { EventType } from '../shared/events'
import type { SlotRun } from '../shared/runs'
import type { Language } from './i18n'

export type Status = 'new' | 'pending' | 'approved' | 'rejected' | 'revoked'
export type Me = {
  id: string
  email: string
  name: string
  status: Status
  apartment: string | null
  isAdmin: boolean
  language: Language
}
export type Booking = {
  id: string
  slot_start: string
  apartment: string | null
  maintenance: boolean
  mine: boolean
}
export type Notice = { id: string; slot_start: string }
export type BookingRun = SlotRun<Booking>
export type Apartment = { id: string; code: string; taken: boolean }
export type AdminUser = {
  id: string
  email: string
  name: string
  status: Status
  apartment: string | null
}
export type ThemeChoice = 'light' | 'dark' | 'system'
export type Run = (fn: () => Promise<unknown>, after?: () => unknown) => Promise<void>
export type ActivityEvent = {
  id: string
  type: EventType
  created_at: string
  slot_start: string | null
  actor: string
  subject: string | null
  apartment: string | null
}
