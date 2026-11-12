import { expect, test } from '@playwright/test'
import { confirm, openAs, resetAndPin, slot } from './support'

test.beforeEach(resetAndPin)

test('an applicant requests an apartment and an admin approves it', async ({ browser }) => {
  const applicant = await openAs(browser, 'applicant')
  await applicant.goto('/')
  await applicant.getByRole('radio', { name: 'A2', exact: true }).check()
  await applicant.getByRole('button', { name: 'Request access' }).click()
  await expect(applicant.getByText('Waiting for admin approval for A2')).toBeVisible()

  const admin = await openAs(browser, 'admin')
  await admin.goto('/')
  const row = admin.getByRole('row', { name: /applicant@example\.test/ })
  await row.getByRole('button', { name: 'Approve' }).click()
  await expect(row).toContainText('approved')

  await applicant.reload()
  await expect(applicant.getByRole('link', { name: 'My laundry' })).toBeVisible()
})

test('an admin blocks a slot for maintenance', async ({ browser }) => {
  const admin = await openAs(browser, 'admin')
  await admin.goto('/')
  await admin.getByRole('checkbox', { name: 'Book as maintenance (admin)' }).check()
  await slot(admin, 1, 10).click()
  await confirm(admin, 'Book')
  await expect(slot(admin, 1, 10)).toHaveClass(/maint/)
})
