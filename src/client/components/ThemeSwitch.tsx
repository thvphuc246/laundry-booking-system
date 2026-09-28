import { useTranslation } from 'react-i18next'
import { useTheme } from '../theme'
import { MonitorIcon, MoonIcon, SunIcon } from './icons'

const OPTIONS = [
  ['light', SunIcon],
  ['dark', MoonIcon],
  ['system', MonitorIcon],
] as const

export function ThemeSwitch() {
  const { t } = useTranslation()
  const [theme, setTheme] = useTheme()

  return (
    <fieldset className="seg">
      <legend className="sr-only">{t('theme.label')}</legend>
      {OPTIONS.map(([value, Icon]) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          title={t(`theme.${value}`)}
          onClick={() => setTheme(value)}
        >
          <Icon />
          <span className="seg-label">{t(`theme.${value}`)}</span>
        </button>
      ))}
    </fieldset>
  )
}
