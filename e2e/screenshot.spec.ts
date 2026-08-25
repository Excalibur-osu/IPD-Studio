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

test('capture zoomed segment editing', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await page.setViewportSize({ width: 1680, height: 1000 })
  await page.goto('/')
  await page.getByTestId('open-hmi').click()
  await page.getByRole('button', { name: 'New screen' }).click()
  const canvas = page.getByTestId('hmi-canvas')
  const world = async (wx: number, wy: number) => {
    const b = (await canvas.boundingBox())!
    return { x: b.x + (wx / 1600) * b.width, y: b.y + (wy / 1000) * b.height }
  }
  await page.getByText('Tank', { exact: true }).dblclick()
  await page.getByTestId('hmi-pipe-tool').click()
  for (const [wx, wy] of [[96, 600], [320, 600], [320, 368]] as const) {
    const q = await world(wx, wy)
    await page.mouse.click(q.x, q.y)
  }
  await page.keyboard.press('Enter')
  let p = await world(200, 600)
  await page.mouse.click(p.x, p.y) // select the pipe: vertices + segment diamonds
  p = await world(320, 480)
  await page.mouse.move(p.x, p.y)
  await page.mouse.wheel(0, -600)
  await page.mouse.wheel(0, -600)
  await page.waitForTimeout(250)
  await page.screenshot({ path: '/tmp/hmi-zoom-segments.png' })
})

test('capture run header, home screen, nav alarm dot', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await page.setViewportSize({ width: 1680, height: 1000 })
  await page.goto('/')
  await page.getByTestId('open-hmi').click()
  // Screen 1: an alarming tank
  await page.getByRole('button', { name: 'New screen' }).click()
  const canvas = page.getByTestId('hmi-canvas')
  const b = (await canvas.boundingBox())!
  const at = (wx: number, wy: number) => ({ x: b.x + (wx / 1600) * b.width, y: b.y + (wy / 1000) * b.height })
  await page.getByText('Tank', { exact: true }).dblclick()
  await page.mouse.click(at(360, 290).x, at(360, 290).y)
  await page.getByTestId('prop-tag').fill('TK-1')
  await page.getByLabel('Start level %').fill('96')
  // Screen 2 (home): overview with a nav to Screen 1
  await page.getByTitle('Add screen').click()
  await page.getByText('Screen link', { exact: true }).dblclick()
  await page.mouse.click(at(360, 262).x, at(360, 262).y)
  await page.locator('label:has-text("Go to") select').selectOption({ label: 'Screen 1' })
  await page.getByTestId('screen-home').click()
  // run from Screen 1 — RUN must land on the home overview
  await page.locator('.hmi-tab', { hasText: /^Screen 1$/ }).click()
  await page.getByTestId('hmi-run-toggle').click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: '/tmp/hmi-screens-chrome.png' })
})

test('capture alarm summary v2 with suppression', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await page.setViewportSize({ width: 1680, height: 1000 })
  await page.goto('/')
  await page.getByTestId('open-hmi').click()
  await page.getByRole('button', { name: 'New screen' }).click()
  const canvas = page.getByTestId('hmi-canvas')
  const world = async (wx: number, wy: number) => {
    const b = (await canvas.boundingBox())!
    return { x: b.x + (wx / 1600) * b.width, y: b.y + (wy / 1000) * b.height }
  }
  // tank trips H (medium) + HH (high); a low-priority display trips L (low)
  await page.getByText('Tank', { exact: true }).dblclick()
  let p = await world(360, 290)
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  p = await world(900, 300)
  await page.mouse.move(p.x, p.y, { steps: 4 })
  await page.mouse.up()
  await page.getByTestId('prop-tag').fill('TK-1')
  await page.getByLabel('Start level %').fill('96')
  await page.getByText('Value display', { exact: true }).dblclick()
  p = await world(350, 255)
  await page.mouse.click(p.x, p.y)
  await page.getByTestId('prop-tag').fill('XI-9')
  await page.getByLabel('L', { exact: true }).fill('60')
  await page.getByTestId('prop-priority').selectOption('low')
  await page.getByTestId('hmi-run-toggle').click()
  await page.waitForTimeout(1200)
  await page.getByTestId('alarm-summary-toggle').click()
  await page.locator('.al-shelve').first().selectOption('15')
  await page.waitForTimeout(400)
  await page.screenshot({ path: '/tmp/hmi-alarm-v2.png' })
})

test('capture multi-pen trend and sparkline', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await page.setViewportSize({ width: 1680, height: 1000 })
  await page.goto('/')
  await page.getByTestId('open-hmi').click()
  await page.getByRole('button', { name: 'New screen' }).click()
  const canvas = page.getByTestId('hmi-canvas')
  const world = async (wx: number, wy: number) => {
    const b = (await canvas.boundingBox())!
    return { x: b.x + (wx / 1600) * b.width, y: b.y + (wy / 1000) * b.height }
  }
  const place = async (label: string, wx: number, wy: number) => {
    await page.getByText(label, { exact: true }).dblclick()
    let q = await world(350, 260)
    await page.mouse.move(q.x, q.y)
    await page.mouse.down()
    q = await world(wx, wy)
    await page.mouse.move(q.x, q.y, { steps: 4 })
    await page.mouse.up()
  }
  // level loop: tank + controller display + big trend on the pair
  await place('Tank', 300, 300)
  await page.getByTestId('prop-tag').fill('LT-1')
  await place('Value display', 640, 180)
  await page.getByTestId('prop-tag').fill('LIC-1')
  await page.getByTestId('prop-controller').check()
  await place('Value display', 640, 260)
  await page.getByTestId('prop-tag').fill('FT-1')
  await page.getByTestId('prop-spark').check()
  await place('Trend', 760, 560)
  // widen it via the panel geometry row (aiming at the SE handle is fiddly)
  const wh = page.locator('label:has-text("W / H") input')
  await wh.nth(0).fill('440')
  await wh.nth(1).fill('240')
  await page.getByTestId('prop-tag').fill('LIC-1')
  await page.getByTestId('prop-pen-0').fill('LIC-1.SP')
  await page.getByTestId('prop-pen-1').fill('LT-1.PV')
  await page.getByTestId('hmi-run-toggle').click()
  await page.waitForTimeout(4000)
  await page.screenshot({ path: '/tmp/hmi-trend-pens.png' })
})

test('capture faceplate v2 and command journal', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await page.setViewportSize({ width: 1680, height: 1000 })
  await page.goto('/')
  await page.getByTestId('open-hmi').click()
  await page.getByRole('button', { name: 'New screen' }).click()
  const canvas = page.getByTestId('hmi-canvas')
  const world = async (wx: number, wy: number) => {
    const b = (await canvas.boundingBox())!
    return { x: b.x + (wx / 1600) * b.width, y: b.y + (wy / 1000) * b.height }
  }
  // tank near-full so its faceplate shows live alarms; a controller display
  await page.getByText('Tank', { exact: true }).dblclick()
  let p = await world(360, 290)
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  p = await world(800, 300)
  await page.mouse.move(p.x, p.y, { steps: 5 })
  await page.mouse.up()
  await page.getByTestId('prop-tag').fill('TK-1')
  await page.getByLabel('Start level %').fill('96')
  await page.getByText('Value display', { exact: true }).dblclick()
  p = await world(350, 255)
  await page.mouse.click(p.x, p.y)
  await page.getByTestId('prop-tag').fill('LIC-1')
  await page.getByTestId('prop-controller').check()
  // run: tank faceplate first (bar + limit ticks + sparkline + alarm ack)
  await page.getByTestId('hmi-run-toggle').click()
  await page.waitForTimeout(1600)
  p = await world(800, 320)
  await page.mouse.click(p.x, p.y)
  await page.waitForTimeout(300)
  await page.screenshot({ path: '/tmp/hmi-faceplate-tank.png' })
  await page.getByTestId('fp-close').click()
  // controller faceplate + journal filtered to operator commands
  p = await world(350, 255)
  await page.mouse.click(p.x, p.y)
  await page.getByTestId('fp-sp').fill('62')
  await page.getByRole('button', { name: /Journal/ }).click()
  await page.getByTestId('journal-commands').click()
  await page.waitForTimeout(250)
  await page.screenshot({ path: '/tmp/hmi-faceplate-controller.png' })
})

test('capture the tag picker and value-source rows', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await page.setViewportSize({ width: 1680, height: 1000 })
  await page.goto('/')
  await page.locator('select.tb-template').selectOption('sample')
  await page.getByTestId('open-hmi').click()
  await page.getByRole('button', { name: 'New screen' }).click()
  const canvas = page.getByTestId('hmi-canvas')
  await page.getByText('Value display', { exact: true }).dblclick()
  const b = (await canvas.boundingBox())!
  await page.mouse.click(b.x + (350 / 1600) * b.width, b.y + (255 / 1000) * b.height)
  await page.getByTestId('prop-tag').click()
  await page.waitForTimeout(200)
  await page.screenshot({ path: '/tmp/hmi-tag-picker.png' })
  // armed pick-on-canvas state
  await page.keyboard.press('Escape')
  await page.getByTestId('pick-bindTank').click()
  await page.waitForTimeout(150)
  await page.screenshot({ path: '/tmp/hmi-bind-pick.png' })
})
