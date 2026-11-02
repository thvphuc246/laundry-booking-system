import { useTranslation } from 'react-i18next'
import { downloadIcs } from '../ics'
import type { Booking } from '../types'
import { CalendarIcon } from './icons'

export function ExportButton({ bookings, now }: { bookings: Booking[]; now: Date }) {
  const { t } = useTranslation()
  const upcoming = bookings.filter((b) => b.mine && new Date(b.slot_start) > now)

  const download = () =>
    downloadIcs(upcoming, t('title'), t('address'), t('calendar.exportFile'), now)

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
