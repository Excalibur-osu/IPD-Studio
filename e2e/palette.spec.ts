import { expect, test } from '@playwright/test'

declare global {
  interface Window { __pid: any }
}

test('instrument palette: quick row, show-all groups, shortcut + full-name search', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => Boolean(window.__pid))
  const palette = page.locator('.palette')

  // collapsed instruments section: the 8 workhorse presets, deep cuts hidden
  await expect(palette.locator('.palette-entry', { hasText: /^FT$/ })).toBeVisible()
  await expect(palette.locator('.palette-entry', { hasText: /^LSHH$/ })).toHaveCount(0)

  // Show all expands to the grouped full table (instruments renders first)
  await palette.locator('.palette-more').first().click()
  await expect(palette.locator('.palette-subhead', { hasText: 'Flow' })).toBeVisible()
  await expect(palette.locator('.palette-entry', { hasText: /^LSHH$/ })).toBeVisible()
  await palette.locator('.palette-more').first().click()
  await expect(palette.locator('.palette-entry', { hasText: /^LSHH$/ })).toHaveCount(0)

  // shortcut search
  await palette.locator('.palette-search').fill('fic')
  await expect(palette.locator('.palette-entry').first()).toHaveText(/FIC/)

  // full-name search + Enter places the bubble pre-tagged per-type
  await palette.locator('.palette-search').fill('level switch high')
  await expect(palette.locator('.palette-entry').first()).toHaveText(/LSH/)
  await palette.locator('.palette-search').press('Enter')
  const tags = await page.evaluate(() =>
    window.__pid.useStore.getState().doc.sheets[0].nodes
      .map((n: any) => (n.tag ? `${n.tag.letters}-${n.tag.loop}` : '?')),
  )
  expect(tags).toContain('LSH-100')
})
