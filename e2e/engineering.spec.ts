import { expect, test, type Page } from '@playwright/test'

async function store(page: Page) {
  await page.waitForFunction(() => '__pid' in window)
  await expect(page.locator('.rail')).toBeVisible()
}

test('an engineering record survives deleting and redrawing its symbol', async ({ page }) => {
  await page.goto('/app')
  await store(page)

  // place a transmitter and tag it
  await page.evaluate(() => {
    const { useStore } = (window as never as { __pid: { useStore: { getState(): any } } }).__pid
    const s = useStore.getState()
    const ft = s.addNode({ symbolId: 'instr.bubble', kind: 'instrument', x: 200, y: 160, rotation: 0 })
    s.setTag(ft, { letters: 'FT', loop: '101' })
    s.setSelection([ft])
  })

  // fill in the record through the inspector
  await page.getByTestId('insp-eng').click()
  await page.getByTestId('eng-signal.range').fill('0-150 m3/h')
  await page.getByTestId('eng-general.service').fill('Feed water')
  await page.locator('.props').click()

  // delete the symbol, then redraw it with the same tag
  await page.evaluate(() => {
    const { useStore } = (window as never as { __pid: { useStore: { getState(): any } } }).__pid
    const s = useStore.getState()
    s.deleteIds(s.doc.sheets[0].nodes.map((n: any) => n.id))
    const again = useStore.getState().addNode({ symbolId: 'instr.bubble', kind: 'instrument', x: 260, y: 200, rotation: 0 })
    useStore.getState().setTag(again, { letters: 'FT', loop: '101' })
    useStore.getState().setSelection([again])
  })

  await page.getByTestId('insp-eng').click()
  await expect(page.getByTestId('eng-signal.range')).toHaveValue('0-150 m3/h')
  await expect(page.getByTestId('eng-general.service')).toHaveValue('Feed water')
})

test('renaming a tag carries its record', async ({ page }) => {
  await page.goto('/app')
  await store(page)
  await page.evaluate(() => {
    const { useStore } = (window as never as { __pid: { useStore: { getState(): any } } }).__pid
    const s = useStore.getState()
    const pt = s.addNode({ symbolId: 'instr.bubble', kind: 'instrument', x: 200, y: 160, rotation: 0 })
    s.setTag(pt, { letters: 'PT', loop: '200' })
    s.setRecordField('PT-200', 'instrument', 'signal.range', '0-10 bar')
    s.setSelection([pt])
  })

  // rename through the tag editor on the Symbol tab
  await page.getByTestId('insp-symbol').click()
  await page.locator('.tag-loop').fill('201')
  await page.locator('.props').click()

  await page.getByTestId('insp-eng').click()
  await expect(page.getByTestId('eng-signal.range')).toHaveValue('0-10 bar')
})

test('an untagged object is told why it has no record', async ({ page }) => {
  await page.goto('/app')
  await store(page)
  await page.evaluate(() => {
    const { useStore } = (window as never as { __pid: { useStore: { getState(): any } } }).__pid
    const s = useStore.getState()
    const id = s.addNode({ symbolId: 'pump.centrifugal', kind: 'equipment', x: 200, y: 200, rotation: 0 })
    s.setSelection([id])
  })
  await page.getByTestId('insp-eng').click()
  await expect(page.locator('.eng-untagged')).toContainText('no tag yet')
})

test('a deleted record surfaces as an orphan and can be purged', async ({ page }) => {
  await page.goto('/app')
  await store(page)
  await page.evaluate(() => {
    const { useStore } = (window as never as { __pid: { useStore: { getState(): any } } }).__pid
    const s = useStore.getState()
    const ft = s.addNode({ symbolId: 'instr.bubble', kind: 'instrument', x: 200, y: 160, rotation: 0 })
    s.setTag(ft, { letters: 'FT', loop: '101' })
    s.setRecordField('FT-101', 'instrument', 'signal.range', '0-150')
    useStore.getState().deleteIds([ft])
  })

  await page.getByTestId('rail-checks').click()
  const orphan = page.locator('.ws-issue', { hasText: 'engineering record' })
  await expect(orphan).toBeVisible()

  // the fix names what it does rather than saying "Fix"
  await orphan.getByRole('button', { name: 'Discard the record' }).click()
  await expect(page.locator('.ws-issue', { hasText: 'engineering record' })).toHaveCount(0)
})
