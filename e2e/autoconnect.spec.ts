import { expect, test, type Page } from '@playwright/test'

/* Magnetic docking — connect by touching, not by drawing:
   - drop a palette symbol onto an existing symbol's connection point and it
     clicks into place already connected
   - drag a symbol already on the sheet the same way, in one undo step
   - pull the pair apart afterwards and the pipe stretches instead of breaking */

interface PidHook {
  useStore: { getState(): any; temporal: { getState(): any } }
  canvasRef: { paper?: any }
}
declare global {
  interface Window { __pid: PidHook }
}

async function clientPoint(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return page.evaluate(([lx, ly]) => {
    const p = window.__pid.canvasRef.paper!.localToClientPoint({ x: lx, y: ly })
    return { x: p.x, y: p.y }
  }, [x, y])
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 16) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps })
  await page.mouse.up()
}

const sheet = (page: Page) => page.evaluate(() => window.__pid.useStore.getState().doc.sheets[0])
const undoDepth = (page: Page) =>
  page.evaluate(() => window.__pid.useStore.temporal.getState().pastStates.length)

/** Drop a palette symbol on the canvas at a sheet point, the way the browser
 *  does it: a real DragEvent carrying the palette's MIME payload. */
async function dropSymbol(page: Page, symbolId: string, at: { x: number; y: number }) {
  const client = await clientPoint(page, at.x, at.y)
  await page.evaluate(
    ([id, cx, cy]) => {
      const dt = new DataTransfer()
      dt.setData('application/x-pid-symbol', JSON.stringify({ symbolId: id }))
      const host = document.querySelector('[data-testid="canvas"]')!
      host.dispatchEvent(
        new DragEvent('drop', { dataTransfer: dt, clientX: cx as number, clientY: cy as number, bubbles: true, cancelable: true }),
      )
    },
    [symbolId, client.x, client.y] as [string, number, number],
  )
}

/** A single gate valve at (200,200): 32x16, port w at (200,208), e at (232,208). */
async function withGateValve(page: Page): Promise<string> {
  await page.goto('/app')
  await page.waitForFunction(() => '__pid' in window)
  await page.waitForFunction(() => Boolean(window.__pid))
  const id = await page.evaluate(() => {
    const s = window.__pid.useStore.getState()
    const id = s.addNode({ symbolId: 'valve.gate', kind: 'valve', x: 200, y: 200, rotation: 0 })
    s.setSelection([])
    return id as string
  })
  await expect(page.locator('[model-id]')).toHaveCount(1)
  return id
}

test('dropping a palette symbol on a connection point docks and connects it', async ({ page }) => {
  const gate = await withGateValve(page)

  // Aim so the dropped valve's own w port lands 8px off the fixed valve's e
  // port: centred on (254,210) it is placed at (240,200), w at (240,208).
  await dropSymbol(page, 'valve.gate', { x: 254, y: 210 })

  await expect.poll(async () => (await sheet(page)).nodes.length).toBe(2)
  const after = await sheet(page)
  const dropped = after.nodes.find((n: any) => n.id !== gate)

  // pulled into place so the two connection points are the same point
  expect({ x: dropped.x, y: dropped.y }).toEqual({ x: 232, y: 200 })
  expect(after.edges).toHaveLength(1)
  expect(after.edges[0].source).toEqual({ nodeId: dropped.id, portId: 'w' })
  expect(after.edges[0].target).toEqual({ nodeId: gate, portId: 'e' })
  expect(after.edges[0].lineClass).toBe('process.major')

  // symbol + line arrived together, so one undo takes both back
  await page.evaluate(() => window.__pid.useStore.getState().undo())
  const undone = await sheet(page)
  expect(undone.nodes).toHaveLength(1)
  expect(undone.edges).toHaveLength(0)
})

test('a symbol dropped clear of every connection point just lands there', async ({ page }) => {
  await withGateValve(page)
  await dropSymbol(page, 'valve.gate', { x: 500, y: 500 })
  await expect.poll(async () => (await sheet(page)).nodes.length).toBe(2)
  expect((await sheet(page)).edges).toHaveLength(0)
})

test('dragging a placed symbol onto a connection point docks it, and pulling away stretches the line', async ({ page }) => {
  const gate = await withGateValve(page)
  const moving = await page.evaluate(() => {
    const s = window.__pid.useStore.getState()
    const id = s.addNode({ symbolId: 'valve.gate', kind: 'valve', x: 400, y: 300, rotation: 0 })
    s.setSelection([])
    return id as string
  })
  await expect(page.locator('[model-id]')).toHaveCount(2)
  const before = await undoDepth(page)

  // Grab the moving valve by its centre (416,308) and bring its w port to
  // within a few px of the fixed valve's e port at (232,208).
  await drag(page, await clientPoint(page, 416, 308), await clientPoint(page, 254, 208))

  await expect.poll(async () => (await sheet(page)).edges.length).toBe(1)
  const docked = await sheet(page)
  const node = docked.nodes.find((n: any) => n.id === moving)
  expect({ x: node.x, y: node.y }).toEqual({ x: 232, y: 200 })
  expect(docked.edges[0].source).toEqual({ nodeId: moving, portId: 'w' })
  expect(docked.edges[0].target).toEqual({ nodeId: gate, portId: 'e' })
  // the move and the line are one gesture, so they are one undo step
  expect(await undoDepth(page)).toBe(before + 1)

  // docked: the ports coincide, so there is no pipe drawn between them yet
  const edgeId = docked.edges[0].id
  const length = () =>
    page.evaluate((id) => {
      const paper = window.__pid.canvasRef.paper!
      const view = paper.model.getCell(id).findView(paper)
      return view.getConnectionLength() as number
    }, edgeId)
  await expect.poll(length).toBeLessThan(2)

  // pull it away and the pipe stretches to follow instead of breaking
  await drag(page, await clientPoint(page, 248, 208), await clientPoint(page, 448, 208))
  const moved = await sheet(page)
  expect(moved.edges).toHaveLength(1)
  expect(moved.edges[0].source).toEqual({ nodeId: moving, portId: 'w' })
  expect(moved.edges[0].target).toEqual({ nodeId: gate, portId: 'e' })
  expect(moved.nodes.find((n: any) => n.id === moving).x).toBeGreaterThan(400)
  await expect.poll(length).toBeGreaterThan(150)
})
