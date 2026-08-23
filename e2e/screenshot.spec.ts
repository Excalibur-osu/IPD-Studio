import { test } from '@playwright/test'
import fs from 'node:fs'

// Not a test — a design-verification harness. Run explicitly:
//   npx playwright test e2e/screenshot.spec.ts

/** Load any real .pnid through the dev store hook and capture its HMI:
 *  HMI_CAPTURE_DOC=/path/to/doc.pnid npx playwright test e2e/screenshot.spec.ts */
const USER_DOC = process.env.HMI_CAPTURE_DOC
test('capture a real user document', async ({ page }) => {
  test.skip(!USER_DOC, 'set HMI_CAPTURE_DOC to a .pnid path')
  const text = fs.readFileSync(USER_DOC!, 'utf8')
  page.on('dialog', (d) => void d.accept())
  await page.setViewportSize({ width: 1680, height: 1000 })
  await page.goto('/')
  await page.evaluate((t) => {
    const pid = (window as unknown as { __pid: { useStore: { getState(): { loadIntoStore(d: unknown): void } } } }).__pid
    pid.useStore.getState().loadIntoStore(JSON.parse(t))
  }, text)
  await page.getByTestId('open-hmi').click()
  // build a fresh screen from the sheet with the current importer
  await page.waitForSelector('[data-testid="hmi-import"], [data-testid="hmi-import-empty"]')
  const importBtn = page.getByTestId('hmi-import')
  if (await importBtn.count()) await importBtn.click()
  else await page.getByTestId('hmi-import-empty').click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: '/tmp/hmi-user-edit.png' })
  await page.getByTestId('hmi-run-toggle').click()
  await page.getByTestId('hmi-speed').click()
  await page.waitForTimeout(9000) // ~45 sim-seconds at 5×
  await page.screenshot({ path: '/tmp/hmi-user-run.png' })
})
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

test('capture alarm summary and journal', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await page.setViewportSize({ width: 1680, height: 1000 })
  await page.goto('/')
  await page.getByTestId('open-hmi').click()
  await page.getByRole('button', { name: 'New screen' }).click()
  await page.getByText('Tank', { exact: true }).dblclick()
  const canvas = page.getByTestId('hmi-canvas')
  const b = (await canvas.boundingBox())!
  await page.mouse.click(b.x + (360 / 1600) * b.width, b.y + (300 / 1000) * b.height)
  await page.getByPlaceholder('e.g. LT-101').fill('TK-1')
  await page.locator('label', { hasText: 'Start level %' }).locator('input').fill('96')
  await page.getByTestId('hmi-run-toggle').click()
  await page.waitForTimeout(1200) // HH at 95 trips on the first ticks
  await page.getByTestId('alarm-summary-toggle').click()
  await page.waitForTimeout(200)
  await page.screenshot({ path: '/tmp/hmi-alarm-summary.png' })
  await page.getByRole('button', { name: '▾ Journal' }).click()
  await page.getByTestId('alarm-ack').click()
  await page.waitForTimeout(200)
  await page.screenshot({ path: '/tmp/hmi-alarm-journal.png' })
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
