import { useTranslation } from 'react-i18next'

export function UsageCard({ label, left, max }: { label: string; left: number; max: number }) {
  const { t } = useTranslation()
  return (
    <div className="card usage-card">
      <div className="usage-head">
        <span className="usage-label">{label}</span>
        <span className="usage-value">{t('calendar.hoursLeft', { left, max })}</span>
      </div>
      <div className="meter">
        <span className="meter-fill" style={{ width: `${Math.min(100, (left / max) * 100)}%` }} />
      </div>
    </div>
  )
}
