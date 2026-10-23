import { useTranslation } from 'react-i18next'
import { bookingsToIcs } from '../ics'
import type { Booking } from '../types'
import { CalendarIcon } from './icons'

export function ExportButton({ bookings, now }: { bookings: Booking[]; now: Date }) {
  const { t } = useTranslation()
  const upcoming = bookings.filter((b) => b.mine && new Date(b.slot_start) > now)

  const download = () => {
    const ics = bookingsToIcs(upcoming, t('title'), t('address'), now)
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
    const link = document.createElement('a')
    link.href = url
    link.download = t('calendar.exportFile')
    link.click()
    setTimeout(() => URL.revokeObjectURL(url))
  }

  return (
    <button
      type="button"
      className="btn secondary jump"
      disabled={!upcoming.length}
      title={t('calendar.exportHint')}
      onClick={download}
    >
      <CalendarIcon />
      {t('calendar.export')}
    </button>
  )
}
