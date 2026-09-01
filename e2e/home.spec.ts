import { expect, test, type Page } from '@playwright/test'

/**
 * Whether this build has a Firebase project behind it. There is no hardcoded
 * config (see src/auth/config.ts), so a fork — and CI, which has no secrets —
 * runs with the account layer switched off entirely. The sign-in gate cannot
 * be asserted when there is nothing to sign in to.
 */
async function backendConfigured(page: Page): Promise<boolean> {
  await page.waitForFunction(() => '__pid' in window)
  return page.evaluate(
    () => (window as unknown as { __pid: { firebaseReady?: boolean } }).__pid.firebaseReady === true,
  )
}

test('the homepage is what / serves, and its CTA opens the editor', async ({ page }) => {
  await page.goto('/')

  // the marketing page, not the editor
  await expect(page.locator('.home')).toBeVisible()
  await expect(page.locator('h1')).toBeVisible()
  await expect(page.locator('.toolbar')).toHaveCount(0)

  await page.getByRole('button', { name: /open the editor/i }).first().click()

  await expect(page).toHaveURL(/\/app$/)
  await expect(page.locator('.toolbar')).toBeVisible()
})

test('sign in on the homepage leads to the editor sign-in screen', async ({ page, context }) => {
  await context.addInitScript(() => { try { localStorage.removeItem('pid.dev.skipAuth') } catch {} })
  await page.goto('/')
  test.skip(!(await backendConfigured(page)), 'no Firebase project configured — the account layer is off')
  await page.getByRole('button', { name: /^sign in$/i }).first().click()

  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByTestId('auth-dialog')).toBeVisible()
  await expect(page.getByTestId('auth-email')).toBeVisible()
  await expect(page.getByTestId('auth-password')).toBeVisible()
})

test('the editor is gated: no account, no canvas', async ({ page, context }) => {
  // opt out of the suite-wide dev bypass to see what a real visitor sees
  await context.addInitScript(() => { try { localStorage.removeItem('pid.dev.skipAuth') } catch {} })
  await page.goto('/app')
  test.skip(!(await backendConfigured(page)), 'no Firebase project configured — the account layer is off')

  await expect(page.getByTestId('auth-dialog')).toBeVisible()
  await expect(page.locator('.toolbar')).toHaveCount(0)
  await expect(page.locator('.palette')).toHaveCount(0)
})

test('a deep link straight to /app boots the editor, not the homepage', async ({ page }) => {
  await page.goto('/app')
  await page.waitForFunction(() => '__pid' in window)
  await expect(page.locator('.home')).toHaveCount(0)
  await expect(page.locator('.toolbar')).toBeVisible()
})

test('the homepage says the product is actively updated', async ({ page }) => {
  await page.goto('/')
  const banner = page.locator('.version-banner')
  await expect(banner).toBeVisible()
  await expect(banner).toContainText(/in active development/i)
  await expect(banner).toContainText(/v\d+\.\d+\.\d+/)
  await expect(page.getByTestId('version-refresh')).toBeVisible()
})
