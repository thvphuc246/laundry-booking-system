import { useTranslation } from 'react-i18next'

export function UsageCard({ label, used, max }: { label: string; used: number; max: number }) {
  const { t } = useTranslation()
  return (
    <div className="card usage-card">
      <div className="usage-head">
        <span className="usage-label">{label}</span>
        <span className="usage-value">{t('calendar.hours', { used, max })}</span>
      </div>
      <div className="meter">
        <span className="meter-fill" style={{ width: `${Math.min(100, (used / max) * 100)}%` }} />
      </div>
    </div>
  )
}
