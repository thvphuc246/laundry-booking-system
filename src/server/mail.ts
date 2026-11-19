import i18next from 'i18next'
import nodemailer from 'nodemailer'
import en from '../client/locales/en.json' with { type: 'json' }
import fi from '../client/locales/fi.json' with { type: 'json' }
import sv from '../client/locales/sv.json' with { type: 'json' }

export type Mail = { to: string; subject: string; text: string }
export type Send = (mail: Mail) => Promise<unknown>

export const i18n = i18next.createInstance()
await i18n.init({
  resources: { en: { translation: en }, fi: { translation: fi }, sv: { translation: sv } },
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

const SMTP_URL = process.env.SMTP_URL
const transport = SMTP_URL ? nodemailer.createTransport(SMTP_URL) : null

export const send: Send = transport
  ? (mail) =>
      transport.sendMail({
        from: {
          name: i18n.t('appName'),
          address: decodeURIComponent(new URL(SMTP_URL as string).username),
        },
        ...mail,
      })
  : async (mail) => console.log('mail', mail)

export const APP_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:5173'

export function letter(language: string, name: string, body: string[]): string {
  const t = i18n.getFixedT(language)
  return [t('email.greeting', { name }), '', ...body, '', `${t('title')}, ${t('address')}`].join(
    '\n',
  )
}
