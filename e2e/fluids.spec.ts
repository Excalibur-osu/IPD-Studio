import { expect, test } from '@playwright/test'

declare global {
  interface Window { __pid: any }
}

test('fluids are reachable from the toolbar with nothing selected', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => Boolean(window.__pid))
  await page.getByTestId('tb-fluids').click()
  await expect(page.getByRole('dialog', { name: 'Fluids / services' })).toBeVisible()
  const before = await page.evaluate(() => (window.__pid.useStore.getState().doc.fluids ?? []).length)
  await page.getByTestId('fluid-add').click()
  const after = await page.evaluate(() => (window.__pid.useStore.getState().doc.fluids ?? []).length)
  expect(after).toBe(before + 1)
  // rename sticks
  await page.getByRole('dialog').locator('input:not([type="color"])').last().fill('Brine')
  const names = await page.evaluate(() => (window.__pid.useStore.getState().doc.fluids ?? []).map((f: any) => f.name))
  expect(names).toContain('Brine')
})

test('fluid assignment colors the connected run on canvas', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => Boolean(window.__pid))

  // build tank -> line -> valve -> line (free end) straight from the store
  const ids = await page.evaluate(() => {
    const st = window.__pid.useStore.getState()
    const tk = st.addNode({ symbolId: 'vessel.tank', kind: 'equipment', x: 96, y: 96, rotation: 0 })
    const v = st.addNode({ symbolId: 'valve.gate', kind: 'valve', x: 320, y: 128, rotation: 0 })
    const e1 = st.addEdge({ lineClass: 'process.major', source: { nodeId: tk, portId: 'e' }, target: { nodeId: v, portId: 'w' } })
    const e2 = st.addEdge({ lineClass: 'process.major', source: { nodeId: v, portId: 'e' }, target: { x: 520, y: 136 } })
    return { e1, e2 }
  })
  await expect(page.locator(`[model-id="${ids.e1}"]`)).toHaveCount(1)

  // select the first line and assign Water from the property panel
  await page.evaluate((id) => window.__pid.useStore.getState().setSelection([id]), ids.e1)
  const water = await page.evaluate(() =>
    window.__pid.useStore.getState().doc.fluids.find((f: any) => f.name === 'Water'))
  await page.getByTestId('edge-fluid').selectOption(water.id)

  // BOTH lines render in the water color — the run spread through the valve
  for (const id of [ids.e1, ids.e2]) {
    await expect(page.locator(`[model-id="${id}"] path`).nth(2)).toHaveAttribute('stroke', water.color)
  }

  // editing the fluid color restyles live
  await page.evaluate((fid) => window.__pid.useStore.getState().updateFluid(fid, { color: '#00ff00' }), water.id)
  await expect(page.locator(`[model-id="${ids.e2}"] path`).nth(2)).toHaveAttribute('stroke', '#00ff00')
})
