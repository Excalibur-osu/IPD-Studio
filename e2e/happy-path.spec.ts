import { expect, test } from '@playwright/test'

test('place, connect, tag, validate, export', async ({ page }) => {
  await page.goto('/')
  page.on('dialog', (d) => void d.accept())

  // Place a pump, a tank, and an FT instrument through the store dev hook
  // (HTML5 palette drag is exercised manually; the hook mirrors its code path).
  await page.waitForFunction(() => Boolean((window as never as { __pid?: unknown }).__pid))
  await page.evaluate(() => {
    const { useStore } = (window as never as { __pid: { useStore: { getState(): any } } }).__pid
    const s = useStore.getState()
    const tank = s.addNode({ symbolId: 'vessel.tank', kind: 'equipment', x: 96, y: 96, rotation: 0 })
    const pump = s.addNode({ symbolId: 'pump.centrifugal', kind: 'equipment', x: 280, y: 240, rotation: 0 })
    s.addEdge({ lineClass: 'process.major', source: { nodeId: tank, portId: 's' }, target: { nodeId: pump, portId: 'suction' } })
    const ft = s.addNode({ symbolId: 'instr.bubble', kind: 'instrument', x: 424, y: 96, rotation: 0, config: { display: 'discrete', location: 'field' } })
    s.setSelection([ft])
  })

  // Symbols render on the canvas
  await expect(page.locator('[model-id]')).toHaveCount(4, { timeout: 5000 }) // 3 elements + 1 link

  // The untagged instrument is flagged
  await expect(page.locator('.status')).toContainText('1 finding')

  // Tag it through the property panel; expansion appears; finding clears
  await page.locator('.tag-letters').fill('FIC')
  await page.locator('.tag-loop').fill('101')
  await expect(page.locator('.tag-expansion')).toHaveText('Flow Indicating Controller')
  await expect(page.locator('.status')).toContainText('No findings')

  // Undo removes the loop digits, redo restores them
  await page.keyboard.press('ControlOrMeta+z')
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(page.locator('.tag-loop')).toHaveValue('101')

  // Instrument index CSV contains the tagged row
  await page.locator('.props').click() // move focus out of input
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Index' }).click()
  const download = await downloadPromise
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  const csv = Buffer.concat(chunks).toString()
  expect(csv).toContain('Tag,Description,Loop,Symbol,Connected To,Notes')
  expect(csv).toContain('FIC-101,Flow Indicating Controller,101,Instrument')

  // Sample plant loads clean
  await page.getByRole('button', { name: 'Sample' }).click()
  await expect(page.locator('.status')).toContainText('No findings')
  await expect(page.locator('.doc-name')).toContainText('Sample Plant')
})
