export const EVENT_TYPES = [
  'apartment_requested',
  'resident_approved',
  'resident_rejected',
  'resident_revoked',
  'booking_created',
  'booking_cancelled',
] as const
export type EventType = (typeof EVENT_TYPES)[number]
export const EVENTS_PAGE = 50
