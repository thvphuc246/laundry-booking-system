import type { EventType } from '../shared/events.js'
import type { Subscriber } from './events.js'
import { adminCancelMails, decisionMails, requestMails } from './statusEmails.js'

const decide: Subscriber = (e) => decisionMails(e)

export const subscribers: Partial<Record<EventType, Subscriber[]>> = {
  apartment_requested: [requestMails],
  resident_approved: [decide],
  resident_rejected: [decide],
  resident_revoked: [decide],
  booking_cancelled: [adminCancelMails],
}
