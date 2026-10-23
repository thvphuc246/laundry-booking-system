import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import fi from './locales/fi.json'
import sv from './locales/sv.json'

const resources = { en: { translation: en }, fi: { translation: fi }, sv: { translation: sv } }
export type Language = keyof typeof resources
export const LANGUAGES = Object.keys(resources) as Language[]
const STORAGE_KEY = 'language'

const isLanguage = (value: string | null): value is Language => value != null && value in resources

function storedLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function chooseLanguage(language: Language) {
  i18n.changeLanguage(language)
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    return
  }
}

const browserLanguage = navigator.languages.map((l) => l.slice(0, 2)).find(isLanguage)
const stored = storedLanguage()

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language
})

i18n.use(initReactI18next).init({
  resources,
  lng: isLanguage(stored) ? stored : (browserLanguage ?? 'en'),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
