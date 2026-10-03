import { expect, test } from '@playwright/test'

/**
 * Tooltip and Popover in a real browser: neither popup is in the server HTML,
 * and both behave after hydration.
 */

const waitForHydration = (page: import('@playwright/test').Page) =>
  page.waitForFunction(() => document.documentElement.dataset['apHydrated'] === 'true', undefined, {
    timeout: 10_000,
  })

test('neither popup is in the server response, and the trigger is not yet described', async ({
  page,
}) => {
  const response = await page.goto('/overlays')
  const serverHtml = (await response?.text()) ?? ''

  // The RAW response body, before any script runs.
  expect(serverHtml).toContain('id="tip-trigger"')
  expect(serverHtml).not.toContain('role="tooltip"')
  expect(serverHtml).not.toContain('role="dialog"')

  const tag = /<button[^>]*id="tip-trigger"[^>]*>/.exec(serverHtml)?.[0] ?? ''
  expect(tag, 'the tip-trigger tag was not found in the server HTML').not.toBe('')
  expect(tag).not.toContain('aria-describedby')
})

test('focusing the trigger shows the tooltip and describes the trigger by it', async ({ page }) => {
  await page.goto('/overlays')
  await waitForHydration(page)
  await expect(page.getByRole('tooltip')).toHaveCount(0)

  await page.locator('#tip-trigger').focus()
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toBeVisible()

  const id = await tooltip.getAttribute('id')
  expect(id, 'the tooltip has no id').toBeTruthy()
  await expect(page.locator('#tip-trigger')).toHaveAttribute('aria-describedby', id as string)
})

test('clicking the trigger opens a named popover with focus inside; Tab past it closes it', async ({
  page,
}) => {
  await page.goto('/overlays')
  await waitForHydration(page)

  await page.locator('#pop-trigger').click()
  const popover = page.getByRole('dialog', { name: 'Rename employee' })
  await expect(popover).toBeVisible()

  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id), {
      message: 'focus did not land on the first tabbable element inside the popover',
    })
    .toBe('rename-input')

  // Tab until focus leaves the last tabbable element; the popover must close.
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
