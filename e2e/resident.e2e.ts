import { expect, type Page, test } from '@playwright/test'
import { authFile, confirm, resetAndPin, slot } from './support'

test.use({ storageState: authFile('resident') })
test.beforeEach(resetAndPin)

const bookTomorrowTen = async (page: Page) => {
  await page.goto('/#/calendar')
  await slot(page, 1, 10).click()
  await confirm(page, 'Book')
}

test('books a slot and sees it on My laundry', async ({ page }) => {
  await bookTomorrowTen(page)
  const cell = slot(page, 1, 10)
  await expect(cell).toHaveClass(/mine/)
  await expect(cell).toContainText('A1')
  await page.getByRole('link', { name: 'My laundry' }).click()
  await expect(page.locator('ol.runs')).toContainText('Tue 22.09')
})

test('cancels a booking from My laundry', async ({ page }) => {
  await bookTomorrowTen(page)
  await page.getByRole('link', { name: 'My laundry' }).click()
  await page.locator('ol.runs').getByRole('button', { name: 'Cancel booking' }).click()
  await confirm(page, 'Cancel booking')
  await expect(page.getByText('No bookings yet.')).toBeVisible()
})

test('blocks a third hour on the same day', async ({ page }) => {
  await page.goto('/#/calendar')
  await page.getByRole('button', { name: '2 h', exact: true }).click()
  await slot(page, 1, 10).click()
  await confirm(page, 'Book')
  await page.getByRole('button', { name: '1 h', exact: true }).click()
  const cell = slot(page, 1, 13)
  await expect(cell).toHaveAttribute('aria-disabled', 'true')
  await expect(cell).toHaveAttribute('title', 'Daily limit reached (2 h per day).')
})

test('shows an error when the booking request fails', async ({ page }) => {
  await page.route('**/api/bookings', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 500, json: { error: 'server_error' } })
      : route.fallback(),
  )
  await page.goto('/#/calendar')
  await slot(page, 1, 10).click()
  await confirm(page, 'Book')
  await expect(page.getByRole('alert')).toHaveText('Something went wrong. Try again.')
})

test('saves the chosen language for emails', async ({ page }) => {
  await page.goto('/')
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/me/language'))
  await page.getByRole('button', { name: 'suomi' }).click()
  await saved
  expect((await (await page.request.get('/api/me')).json()).language).toBe('fi')
})
