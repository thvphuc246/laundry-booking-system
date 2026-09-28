export type Status = 'new' | 'pending' | 'approved' | 'rejected' | 'revoked'
export type Me = {
  id: string
  email: string
  name: string
  status: Status
  apartment: string | null
  isAdmin: boolean
}
export type Booking = {
  id: string
  slot_start: string
  apartment: string | null
  maintenance: boolean
  mine: boolean
}
export type Apartment = { id: string; code: string; taken: boolean }
export type AdminUser = {
  id: string
  email: string
  name: string
  status: Status
  apartment: string | null
}
export type Run = (fn: () => Promise<unknown>, after?: () => unknown) => Promise<void>
