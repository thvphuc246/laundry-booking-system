import { execFileSync } from 'node:child_process'
import type { Browser, Page } from '@playwright/test'
import { OPEN_HOUR } from '../src/shared/rules'
import { E2E_ENV, NOW, type Role } from './env'

export const runBun = (script: string) =>
  execFileSync('bun', [script], { env: { ...process.env, ...E2E_ENV }, stdio: 'inherit' })

export const authFile = (role: Role) => `e2e/.auth/${role}.json`

export const resetAndPin = async ({ page }: { page: Page }) => {
  runBun('e2e/reset.ts')
  await page.clock.setFixedTime(NOW)
}

export const openAs = async (browser: Browser, role: Role) => {
  const context = await browser.newContext({ storageState: authFile(role) })
  const page = await context.newPage()
  await page.clock.setFixedTime(NOW)
  return page
}

export const slot = (page: Page, day: number, hour: number) =>
  page.locator(`[data-pos="${day}-${hour - OPEN_HOUR}"]`)

export const confirm = (page: Page, label: string) =>
  page.getByRole('dialog').getByRole('button', { name: label, exact: true }).click()
