import { expect, test } from '@playwright/test'
import { confirm, openAs, resetAndPin, slot } from './support'

test.beforeEach(resetAndPin)

test('an admin sees a booking in the activity log in every language', async ({ browser }) => {
  const resident = await openAs(browser, 'resident')
  await resident.goto('/#/calendar')
  await slot(resident, 1, 10).click()
  await confirm(resident, 'Book')

  const admin = await openAs(browser, 'admin')
  await admin.goto('/')
  await admin.getByRole('heading', { name: 'Activity' }).click()
  const row = admin.getByRole('row').filter({ hasText: 'Booked' })
  await expect(row).toContainText('Riku Resident')
  await expect(row).toContainText('A1')

  await admin.getByRole('button', { name: 'suomi' }).click()
  await expect(admin.getByRole('heading', { name: 'Tapahtumat' })).toBeVisible()
  await expect(admin.getByRole('row').filter({ hasText: 'Varasi vuoron' })).toContainText('A1')
})

test('a maintenance block reads as maintenance and residents see no activity', async ({
  browser,
}) => {
  const admin = await openAs(browser, 'admin')
  await admin.goto('/')
  await admin.getByRole('checkbox', { name: 'Book as maintenance (admin)' }).check()
  await slot(admin, 1, 10).click()
  await confirm(admin, 'Book')
  await admin.getByRole('heading', { name: 'Activity' }).click()
  await expect(admin.getByRole('row').filter({ hasText: 'Blocked' })).toContainText(
    'for maintenance',
  )

  const resident = await openAs(browser, 'resident')
  await resident.goto('/#/calendar')
  await expect(resident.getByRole('heading', { name: 'Activity' })).toHaveCount(0)
})
