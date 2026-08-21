import { expect, test, type Page } from '@playwright/test'

/* Pointer-level coverage for the v0.3.1 interaction fixes:
   - symbols drag by their interior, not just their outline strokes
   - port-to-port drags connect and auto-pick a legal line class
   - short accidental drags near a port do NOT leave ghost stub lines
   - clicking a line opens the floating quick editor
   - side panels collapse and restore */

interface PidHook {
  useStore: { getState(): any }
  canvasRef: { paper?: any }
}
declare global {
  interface Window { __pid: PidHook }
}

/** Client-space point for a sheet-local point, via the live paper transform. */
async function clientPoint(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return page.evaluate(([lx, ly]) => {
    const p = window.__pid.canvasRef.paper!.localToClientPoint({ x: lx, y: ly })
    return { x: p.x, y: p.y }
  }, [x, y])
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps })
  await page.mouse.up()
}

test('move, connect, ghost-stub guard, quick line editor, panel collapse', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => Boolean(window.__pid))

  const ids = await page.evaluate(() => {
    const s = window.__pid.useStore.getState()
    const tank = s.addNode({ symbolId: 'vessel.tank', kind: 'equipment', x: 96, y: 96, rotation: 0 })
    const fic = s.addNode({
      symbolId: 'instr.bubble', kind: 'instrument', x: 320, y: 96, rotation: 0,
      config: { display: 'discrete', location: 'field' }, tag: { letters: 'FIC', loop: '101' },
    })
    const valve = s.addNode({
      symbolId: 'cv.globe', kind: 'valve', x: 320, y: 240, rotation: 0,
      config: { actuator: 'diaphragm', fail: 'none' },
    })
    s.setSelection([])
    return { tank, fic, valve }
  })
  await expect(page.locator('[model-id]')).toHaveCount(3)

  // --- connection points are visible dots -------------------------------
  await expect(page.locator(`[model-id="${ids.tank}"] .pid-port-dot`)).toHaveCount(12)

  // --- drag the tank by its interior (not an outline stroke) -------------
  // Tank is 64x56 at (96,96); its center (128,124) has no stroke underneath.
  await drag(page, await clientPoint(page, 128, 124), await clientPoint(page, 208, 124))
  const tankPos = await page.evaluate((id) => {
    const s = window.__pid.useStore.getState()
    const sheet = s.doc.sheets[0]
    const n = sheet.nodes.find((n: any) => n.id === id)
    return { x: n.x, y: n.y }
  }, ids.tank)
  expect(tankPos.x).toBeGreaterThanOrEqual(168)
  expect(tankPos.y).toBe(96)

  // --- port-to-port drag connects, auto-picking a signal class -----------
  // Active line class stays the default process.major; FIC south port (both)
  // to valve top signal port must still connect, as signal.electric.
  // FIC bubble at (320,96), port s at local (20,40) -> sheet (340,136).
  // Valve at (320,240), port sig at local (16,0) -> sheet (336,240).
  await drag(page, await clientPoint(page, 340, 136), await clientPoint(page, 336, 240), 20)
  const edges1 = await page.evaluate(() => window.__pid.useStore.getState().doc.sheets[0].edges)
  expect(edges1).toHaveLength(1)
  expect(edges1[0].lineClass).toBe('signal.electric')
  expect(edges1[0].source.portId).toBe('s')
  expect(edges1[0].target.portId).toBe('sig')

  // --- short drag from a port into blank leaves no ghost stub ------------
  await drag(page, await clientPoint(page, 232, 152), await clientPoint(page, 244, 158))
  const edges2 = await page.evaluate(() => window.__pid.useStore.getState().doc.sheets[0].edges)
  expect(edges2).toHaveLength(1)

  // --- clicking the line opens the quick editor and can retype it --------
  const mid = await clientPoint(page, 338, 188)
  await page.mouse.click(mid.x, mid.y)
  await expect(page.locator('.line-popover')).toBeVisible()
  await page.locator('.line-popover select').selectOption('signal.pneumatic')
  const cls = await page.evaluate(() => window.__pid.useStore.getState().doc.sheets[0].edges[0].lineClass)
  expect(cls).toBe('signal.pneumatic')

  // --- panels collapse into strips and come back --------------------------
  await page.locator('.palette .panel-collapse').click()
  await expect(page.locator('.strip-left')).toBeVisible()
  await expect(page.locator('.palette')).toHaveCount(0)
  await page.locator('.strip-left').click()
  await expect(page.locator('.palette')).toBeVisible()
  await page.locator('.props .panel-collapse').click()
  await expect(page.locator('.strip-right')).toBeVisible()
  await page.locator('.strip-right').click()
  await expect(page.locator('.props')).toBeVisible()

  // --- converter is searchable ------------------------------------------
  await page.locator('.palette-search').fill('i/p')
  await expect(page.locator('.palette-entry', { hasText: 'Signal Converter' })).toBeVisible()
})
