import { expect, test } from '@playwright/test'

test('build an HMI screen by hand and keep it across reload', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await page.goto('/')
  await page.getByTestId('open-hmi').click()
  await page.getByRole('button', { name: 'New screen' }).click()
  // place a tank and a pump via palette double-click
  await page.getByText('Tank', { exact: true }).dblclick()
  await page.getByText('Pump', { exact: true }).dblclick()
  const canvas = page.getByTestId('hmi-canvas')
  await expect(canvas.locator('g.hmi-widget')).toHaveCount(2)
  // draw a pipe
  await page.getByTestId('hmi-pipe-tool').click()
  const box = (await canvas.boundingBox())!
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.8)
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.8)
  await page.keyboard.press('Enter')
  await expect(canvas.locator('polyline')).not.toHaveCount(0)
  // autosave (500ms debounce) then reload; restore confirm auto-accepted
  await page.waitForTimeout(1200)
  await page.reload()
  await expect(page.getByTestId('hmi-canvas')).toBeVisible()
  await expect(page.getByTestId('hmi-canvas').locator('g.hmi-widget')).toHaveCount(2)
})
