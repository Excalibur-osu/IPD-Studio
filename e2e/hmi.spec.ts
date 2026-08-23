import { expect, test } from '@playwright/test'

test('one click: sample P&ID becomes a running HMI', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await page.goto('/')
  await page.locator('select.tb-template').selectOption('sample')
  await page.getByTestId('open-hmi').click()
  // the doc has no screens yet -> empty-state import button
  await page.getByTestId('hmi-import-empty').click()
  const canvas = page.getByTestId('hmi-canvas')
  await expect(canvas.locator('g.hmi-widget')).not.toHaveCount(0)
  await expect(canvas.locator('polyline')).not.toHaveCount(0)
  await expect(page.getByTestId('hmi-reimport')).toBeVisible()
  await page.getByTestId('hmi-run-toggle').click()
  await page.getByTestId('hmi-speed').click()
  // something on screen changes as the sim runs (flows/levels/drifting values)
  const text = () => canvas.textContent()
  const before = await text()
  await expect.poll(text, { timeout: 20000 }).not.toBe(before)
})

test('operate a hand-built screen: start pump, watch it fill, alarm, ack', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await page.goto('/')
  await page.getByTestId('open-hmi').click()
  await page.getByRole('button', { name: 'New screen' }).click()
  const canvas = page.getByTestId('hmi-canvas')
  const world = async (wx: number, wy: number) => {
    const b = (await canvas.boundingBox())!
    return { x: b.x + (wx / 1600) * b.width, y: b.y + (wy / 1000) * b.height }
  }
  // place tank, drag it right, then place the pump (both spawn at 320,240)
  await page.getByText('Tank', { exact: true }).dblclick()
  let p = await world(360, 280)
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  p = await world(800, 300)
  await page.mouse.move(p.x, p.y, { steps: 5 })
  await page.mouse.up()
  await page.getByText('Pump', { exact: true }).dblclick()
  // tag both via the property panel
  const setTag = async (wx: number, wy: number, tag: string) => {
    const q = await world(wx, wy)
    await page.mouse.click(q.x, q.y)
    await page.getByPlaceholder('e.g. LT-101').fill(tag)
  }
  await setTag(348, 268, 'P-1')
  await setTag(800, 320, 'TK-1')
  // pipes: source -> pump, pump -> tank
  await page.getByTestId('hmi-pipe-tool').click()
  for (const [wx, wy] of [[100, 268], [316, 268]] as const) {
    const q = await world(wx, wy)
    await page.mouse.click(q.x, q.y)
  }
  await page.keyboard.press('Enter')
  await page.getByTestId('hmi-pipe-tool').click()
  for (const [wx, wy] of [[380, 268], [790, 330]] as const) {
    const q = await world(wx, wy)
    await page.mouse.click(q.x, q.y)
  }
  await page.keyboard.press('Enter')
  // run + operate
  await page.getByTestId('hmi-run-toggle').click()
  const q = await world(348, 268)
  await page.mouse.click(q.x, q.y)
  await page.getByTestId('fp-start').click()
  const levelText = () => canvas.locator('text', { hasText: '%' }).first().textContent()
  const before = await levelText()
  await expect.poll(levelText, { timeout: 15000 }).not.toBe(before)
  await page.getByTestId('fp-close').click()
  await page.getByTestId('hmi-speed').click()
  await expect(page.getByTestId('alarm-ack')).toBeVisible({ timeout: 60000 })
  await page.getByTestId('alarm-ack-all').click()
  await page.getByTestId('hmi-run-toggle').click()
})

test('marquee select, duplicate, and navigate a running plant', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await page.goto('/')
  await page.getByTestId('open-hmi').click()
  await page.getByRole('button', { name: 'New screen' }).click()
  await page.getByText('Tank', { exact: true }).dblclick()
  await page.getByText('Pump', { exact: true }).dblclick()
  const canvas = page.getByTestId('hmi-canvas')
  await expect(canvas.locator('g.hmi-widget')).toHaveCount(2)
  const box = (await canvas.boundingBox())!
  const at = (wx: number, wy: number) => ({ x: box.x + (wx / 1600) * box.width, y: box.y + (wy / 1000) * box.height })
  // rubber-band from an empty corner over both widgets
  let p = at(80, 60)
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  p = at(900, 700)
  await page.mouse.move(p.x, p.y, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByRole('heading', { name: '2 selected' })).toBeVisible()
  // duplicate the pair from the keyboard
  await page.keyboard.press('ControlOrMeta+d')
  await expect(canvas.locator('g.hmi-widget')).toHaveCount(4)
  // second screen, then RUN plant-wide and navigate back while running
  await page.getByTitle('Add screen').click()
  await expect(page.locator('.hmi-tab.active')).toContainText('Screen 2')
  await page.getByTestId('hmi-run-toggle').click()
  await page.locator('.hmi-tab', { hasText: 'Screen 1' }).click()
  await expect(canvas.locator('g.hmi-widget')).toHaveCount(4)
  // still running: navigation did not stop the sim
  await expect(page.getByTestId('hmi-run-toggle')).toContainText('Stop')
  await expect(page.getByTestId('sim-clock')).toBeVisible()
  await page.getByTestId('hmi-run-toggle').click()
})

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
