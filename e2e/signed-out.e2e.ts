import { expect, test } from '@playwright/test'
import { resetAndPin } from './support'

test.beforeEach(resetAndPin)

test('shows the sign-in page without a session', async ({ page }) => {
  await page.goto('/')
  const link = page.getByRole('link', { name: 'Sign in with Google' })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', '/api/auth/google')
})
