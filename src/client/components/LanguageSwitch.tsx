import { useTranslation } from 'react-i18next'
import { chooseLanguage, LANGUAGES } from '../i18n'

const endonym = (language: string) =>
  new Intl.DisplayNames([language], { type: 'language' }).of(language)

export function LanguageSwitch() {
  const { t, i18n } = useTranslation()

  return (
    <fieldset className="seg">
      <legend className="sr-only">{t('language')}</legend>
      {LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          lang={language}
          aria-pressed={i18n.resolvedLanguage === language}
          aria-label={endonym(language)}
          title={endonym(language)}
          onClick={() => chooseLanguage(language)}
        >
          {language.toUpperCase()}
        </button>
      ))}
    </fieldset>
  )
}
