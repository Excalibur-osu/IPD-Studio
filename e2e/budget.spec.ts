import { expect, test } from '@playwright/test'

declare global {
  interface Window { __pid: any }
}

test('budget: costs accrue while drawing, budget warns when exceeded', async ({ page }) => {
  await page.goto('/app')
  await page.waitForFunction(() => '__pid' in window)
  await page.waitForFunction(() => Boolean(window.__pid))

  // empty project: the chip invites setting a budget
  await expect(page.getByTestId('budget-chip')).toHaveText(/Budget…/)

  // place an FT (transmitter, $3800) via palette search + Enter
  await page.locator('.palette-search').fill('FT')
  await page.locator('.palette-search').press('Enter')
  await expect(page.getByTestId('budget-chip')).toHaveText(/\$3\.8k/)

  // place a centrifugal pump ($9500) -> total 13.3k
  await page.locator('.palette-search').fill('centrifugal pump')
  await page.locator('.palette-search').press('Enter')
  await expect(page.getByTestId('budget-chip')).toHaveText(/\$13k/)

  // set a budget below the estimate -> chip goes over-budget red
  await page.getByTestId('budget-chip').click()
  await page.getByTestId('budget-total').fill('5000')
  await expect(page.getByTestId('budget-est')).toContainText('13,300')
  await expect(page.getByRole('dialog')).toContainText('Over budget')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('budget-chip')).toHaveClass(/budget-over/)
  await expect(page.getByTestId('budget-chip')).toHaveText(/\$13k \/ \$5\.0k/)

  // exact per-node price: select the pump, set Cost -> totals follow
  const pumpId = await page.evaluate(() =>
    window.__pid.useStore.getState().doc.sheets[0].nodes.find((n: any) => n.symbolId === 'pump.centrifugal').id)
  await page.evaluate((id) => window.__pid.useStore.getState().setSelection([id]), pumpId)
  await page.getByTestId('node-cost').fill('500')
  await expect(page.getByTestId('budget-chip')).toHaveText(/\$4\.3k \/ \$5\.0k/)
  await expect(page.getByTestId('budget-chip')).not.toHaveClass(/budget-over/)

  // the panel says which price is in force, and ↺ hands it back to the default
  await expect(page.locator('.prop-cost-note').first()).toContainText('overriding $9,500')
  await page.getByTestId('node-cost-reset').click()
  await expect(page.getByTestId('node-cost')).toHaveValue('')
  await expect(page.locator('.prop-cost-note').first()).toHaveText('$9,500 budgetary')
  await expect(page.getByTestId('budget-chip')).toHaveText(/\$13k \/ \$5\.0k/)

  // a project-wide override from the dialog is labelled as such, not as budgetary
  await page.getByTestId('budget-chip').click()
  await page.locator('.bd-unit').first().fill('7000')
  await page.keyboard.press('Escape')
  await expect(page.locator('.prop-cost-note').first()).toContainText('project price')
})
