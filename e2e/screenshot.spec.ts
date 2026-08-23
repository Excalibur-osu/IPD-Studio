import { test } from '@playwright/test'

// Not a test — a design-verification harness. Run explicitly:
//   npx playwright test e2e/screenshot.spec.ts
test('capture imported sample-plant HMI', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await page.setViewportSize({ width: 1680, height: 1000 })
  await page.goto('/')
  await page.locator('select.tb-template').selectOption('sample')
  await page.getByTestId('open-hmi').click()
  await page.getByTestId('hmi-import-empty').click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: '/tmp/hmi-import-edit.png' })
  await page.getByTestId('hmi-run-toggle').click()
  await page.getByTestId('hmi-speed').click()
  await page.waitForTimeout(5000)
  await page.screenshot({ path: '/tmp/hmi-import-run.png' })
})
