import { expect, test } from '@playwright/test'

// opt back out of the suite-wide pre-dismissed state: fresh browser profile
test.use({ storageState: { cookies: [], origins: [] } })

test('first visit: welcome overlay offers the sample plant, then never returns', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('dialog', { name: /Welcome to IPD Studio/ })).toBeVisible()

  // sample path: loads the demo plant and dismisses
  await page.getByTestId('welcome-sample').click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('[model-id]').first()).toBeVisible()

  // second visit: no overlay comes back
  await page.reload()
  await expect(page.locator('.toolbar')).toBeVisible()
  await page.waitForTimeout(400)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
