import { expect, test } from '@playwright/test'

// opt back out of the suite-wide pre-dismissed state: fresh browser profile
test.use({ storageState: { cookies: [], origins: [] } })

test('first visit: welcome overlay offers the sample plant, then never returns', async ({ page, context }) => {
  // fresh profile above drops the suite's dev bypass too; put it back, since
  // this spec is about the welcome overlay and not about the sign-in gate
  await context.addInitScript(() => { try { localStorage.setItem('pid.dev.skipAuth', '1') } catch {} })
  await page.goto('/app')
  await page.waitForFunction(() => '__pid' in window)
  await expect(page.getByRole('dialog', { name: /Welcome to IPD Studio/ })).toBeVisible()
  await expect(page.getByTestId('welcome-video')).toBeVisible() // demo plays inline
  await expect(page.getByTestId('welcome-blank')).toBeVisible()

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
