import { useTranslation } from 'react-i18next'
import { MAX_RUN_HOURS } from '../../shared/rules'

const LENGTHS = Array.from({ length: MAX_RUN_HOURS }, (_, i) => i + 1)

export function LengthSwitch({
  value,
  onChange,
}: {
  value: number
  onChange: (hours: number) => void
}) {
  const { t } = useTranslation()

  return (
    <fieldset className="seg">
      <legend className="sr-only">{t('calendar.length')}</legend>
      {LENGTHS.map((hours) => (
        <button
          key={hours}
          type="button"
          aria-pressed={value === hours}
          onClick={() => onChange(hours)}
        >
          {t('calendar.lengthHours', { count: hours })}
        </button>
      ))}
    </fieldset>
  )
}
