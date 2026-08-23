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
  const summary = page.getByTestId('alarm-summary-toggle')
  if (await summary.isVisible()) {
    await summary.click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: '/tmp/hmi-alarm-summary.png' })
  }
})

test('capture new widgets on a hand-built screen', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await page.setViewportSize({ width: 1680, height: 1000 })
  await page.goto('/')
  await page.getByTestId('open-hmi').click()
  await page.getByRole('button', { name: 'New screen' }).click()
  const canvas = page.getByTestId('hmi-canvas')
  const at = async (wx: number, wy: number) => {
    const b = (await canvas.boundingBox())!
    return { x: b.x + (wx / 1600) * b.width, y: b.y + (wy / 1000) * b.height }
  }
  const place = async (label: string, wx: number, wy: number) => {
    await page.getByText(label, { exact: true }).dblclick()
    // widgets spawn at 320,240: drag the fresh one into place
    let p = await at(340, 260)
    await page.mouse.move(p.x, p.y)
    await page.mouse.down()
    p = await at(wx, wy)
    await page.mouse.move(p.x, p.y, { steps: 4 })
    await page.mouse.up()
  }
  await place('Group panel', 600, 400)
  await place('Bar indicator', 200, 300)
  await place('Trend', 200, 550)
  await place('Screen link', 200, 750)
  await page.waitForTimeout(300)
  await page.screenshot({ path: '/tmp/hmi-new-widgets.png' })
})
