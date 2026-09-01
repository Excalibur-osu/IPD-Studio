import { expect, test, type Page } from '@playwright/test'

/** Seed a small tagged drawing through the dev store hook, the way the other
 *  specs do — the palette drag is exercised in palette.spec.ts. */
async function seed(page: Page) {
  await page.goto('/app')
  await page.waitForFunction(() => '__pid' in window)
  await page.evaluate(() => {
    const { useStore } = (window as never as { __pid: { useStore: { getState(): any } } }).__pid
    const s = useStore.getState()
    const tank = s.addNode({ symbolId: 'vessel.tank', kind: 'equipment', x: 96, y: 96, rotation: 0 })
    const pump = s.addNode({ symbolId: 'pump.centrifugal', kind: 'equipment', x: 280, y: 240, rotation: 0 })
    s.addEdge({
      lineClass: 'process.major',
      source: { nodeId: tank, portId: 's' },
      target: { nodeId: pump, portId: 'suction' },
      lineNumber: { size: '6"', spec: 'CS', service: 'CW', seq: '001' },
    })
    const ft = s.addNode({ symbolId: 'instr.bubble', kind: 'instrument', x: 424, y: 96, rotation: 0 })
    s.setTag(ft, { letters: 'FT', loop: '101' })
  })
  // Wait for the shell to be mounted before any test presses a key. A keyboard
  // shortcut is a one-shot event: fired before the palette's effect attaches,
  // it is lost for good and the assertion then polls a palette that will never
  // open. Anything rendered by the shell will do as the settle signal.
  await expect(page.locator('.rail')).toBeVisible()
}

test('the rail moves between workspaces, and the URL and back button follow', async ({ page }) => {
  await seed(page)
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.locator('.canvas-host')).toBeVisible()

  await page.getByTestId('rail-data').click()
  await expect(page).toHaveURL(/\/app\/data$/)
  await expect(page.locator('.ws-table')).toBeVisible()
  await expect(page.locator('.canvas-host')).toHaveCount(0)

  await page.getByTestId('rail-checks').click()
  await expect(page).toHaveURL(/\/app\/checks$/)
  await expect(page.getByTestId('checks-tally')).toBeVisible()

  // the back button is real navigation, not a re-render
  await page.goBack()
  await expect(page).toHaveURL(/\/app\/data$/)
  await expect(page.locator('.ws-table')).toBeVisible()
})

test('Ctrl+1..4 switch workspaces from the keyboard', async ({ page }) => {
  await seed(page)
  await page.locator('.canvas-host').click({ position: { x: 5, y: 5 } })

  await page.keyboard.press('ControlOrMeta+3')
  await expect(page).toHaveURL(/\/app\/checks$/)

  await page.keyboard.press('ControlOrMeta+1')
  await expect(page).toHaveURL(/\/app\/draw$/)
  await expect(page.locator('.canvas-host')).toBeVisible()
})

test('the deep link straight to a workspace opens it', async ({ page }) => {
  await page.goto('/app/checks')
  await page.waitForFunction(() => '__pid' in window)
  await expect(page.getByTestId('checks-tally')).toBeVisible()
})

test('the command palette finds a tag and jumps to it on the drawing', async ({ page }) => {
  await seed(page)
  await page.getByTestId('rail-data').click()
  await expect(page).toHaveURL(/\/app\/data$/)

  // Ctrl+K works from any workspace — the palette lives in the shell
  await page.keyboard.press('ControlOrMeta+k')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.getByTestId('command-input').fill('FT-101')
  await page.keyboard.press('Enter')

  // a tag jump always lands you on the drawing, with the object selected
  await expect(page).toHaveURL(/\/app\/draw$/)
  await expect(page.locator('.status')).toContainText('1 selected')
})

test('the palette runs commands, and Ctrl+F still opens it', async ({ page }) => {
  await seed(page)
  await page.keyboard.press('ControlOrMeta+f')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.getByTestId('command-input').fill('>checks')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/app\/checks$/)
})

test('a generated report row locates its object back on the sheet', async ({ page }) => {
  await seed(page)
  await page.getByTestId('rail-data').click()

  // the instrument index is generated from the drawing, not typed
  await expect(page.locator('.ws-table tbody tr')).toHaveCount(1)
  await expect(page.locator('.ws-key').first()).toHaveText('FT-101')

  await page.getByTestId('data-tab-lines').click()
  await expect(page.locator('.ws-key').first()).toHaveText('6"-CS-CW-001')

  await page.locator('.ws-jump button').first().click()
  await expect(page).toHaveURL(/\/app\/draw$/)
  await expect(page.locator('.status')).toContainText('1 selected')
})

test('the inspector shows where a tagged object is used', async ({ page }) => {
  await seed(page)
  await page.evaluate(() => {
    const { useStore } = (window as never as { __pid: { useStore: { getState(): any } } }).__pid
    const s = useStore.getState()
    const ft = s.doc.sheets[0].nodes.find((n: any) => n.tag?.letters === 'FT')
    s.setSelection([ft.id])
  })

  await page.getByTestId('insp-used').click()
  await expect(page.locator('.used-head', { hasText: 'Sheet' })).toBeVisible()
  await expect(page.locator('.used')).toContainText('Sheet 1')
})
