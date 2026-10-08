import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * Toasts, banners and dialogs from `toast()`, `banner()` and `confirm()` in a
 * real browser: what the server HTML holds, a toast raised from a page's own
 * mount effect, the real keyboard, and forced colours.
 */

const waitForHydration = (page: Page) =>
  page.waitForFunction(() => document.documentElement.dataset['apHydrated'] === 'true', undefined, {
    timeout: 10_000,
  })

const IGNORED = [/favicon/i, /Download the React DevTools/i]

function collect(page: Page): string[] {
  const messages: string[] = []
  page.on('console', (m: ConsoleMessage) => {
    if ((m.type() === 'error' || m.type() === 'warning') && !IGNORED.some((r) => r.test(m.text()))) {
      messages.push(m.text())
    }
  })
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`))
  return messages
}

/** The toast viewport: the one `role="region"` on the page. */
const viewport = (page: Page) => page.locator('[role="region"][aria-live="polite"]')

test('the server HTML has the two empty live regions and the empty banner wrapper only', async ({
  page,
}) => {
  const response = await page.goto('/notifications')
  const html = (await response?.text()) ?? ''

  // Fails if either live region is not rendered on the server, or renders text.
  expect(html.match(/aria-live="polite"[^>]*><\/div>/g)).toHaveLength(1)
  expect(html.match(/aria-live="assertive"[^>]*><\/div>/g)).toHaveLength(1)
  // Fails if the viewport is rendered outside the portal.
  expect(html).not.toContain('role="region"')
  // Fails if a toast raised in an effect leaks into server HTML.
  expect(html).not.toContain('Mounted toast')
  // Fails if a dialog is rendered while closed.
  expect(html).not.toContain('alertdialog')
  // Fails if BannerRegion renders nothing on the server, or renders a banner there.
  expect(html).toMatch(/<main><h1>notifications<\/h1><div class="[^"]*"><\/div>/)
  expect(html).not.toContain('role="status"')
})

test('a toast raised from a page mount effect is shown after hydration', async ({ page }) => {
  await page.goto('/notifications')
  await waitForHydration(page)

  // Regression pin, not the effect-order discriminator (the unit test in
  // NotificationProvider.test.tsx owns that). Fails if a toast raised in a
  // page's mount effect is lost across SSR and hydration, e.g. if Relay is
  // moved after the children and subscribes in useEffect.
  await expect(page.getByText('Mounted toast')).toBeVisible()
})

test('hydrates with no React warnings or page errors', async ({ page }) => {
  const messages = collect(page)
  await page.goto('/notifications')
  await waitForHydration(page)
  await expect(page.getByText('Mounted toast')).toBeVisible()
  await page.waitForTimeout(200)

  // Fails on any hydration mismatch or warning the provider, live regions or banner region cause.
  expect(messages, `unexpected console output:\n${messages.join('\n')}`).toEqual([])
})

test('F6 focuses the viewport, Tab reaches the toast, Escape closes it', async ({ page }) => {
  await page.goto('/notifications')
  await waitForHydration(page)
  await page.locator('#toast-info').click()
  await expect(page.getByRole('heading', { name: 'Info toast' })).toBeVisible()

  await page.keyboard.press('F6')
  // Fails if the viewport is not focusable by F6 (fact 8).
  await expect(viewport(page)).toBeFocused()
  expect(await page.evaluate(() => document.activeElement?.getAttribute('role'))).toBe('region')

  await page.keyboard.press('Tab')
  // Fails if the toast is not in the Tab order after the viewport.
  await expect(page.locator('[role="dialog"]', { hasText: 'Info toast' })).toBeFocused()

  await page.keyboard.press('Escape')
  // Fails if Escape on a focused toast does not close it.
  await expect(page.getByRole('heading', { name: 'Info toast' })).toHaveCount(0)
})

test('a danger confirm focuses Cancel, Tab reaches Confirm, Enter resolves true and focus returns', async ({
  page,
}) => {
  await page.goto('/notifications')
  await waitForHydration(page)
  await page.locator('#confirm-danger').click()

  const dialog = page.getByRole('alertdialog', { name: 'Delete record' })
  await expect(dialog).toBeVisible()
  // Fails if the danger tone does not pass initialFocus to Cancel.
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()

  await page.keyboard.press('Tab')
  // Fails if Confirm does not follow Cancel in the Tab order.
  await expect(dialog.getByRole('button', { name: 'Confirm' })).toBeFocused()
  await page.keyboard.press('Enter')

  // Fails if Enter on Confirm does not resolve the promise with true.
  await expect(page.locator('#confirm-result')).toHaveText('true')
  await expect(dialog).toHaveCount(0)
  // Fails if focus is not returned to the control that opened the dialog.
  await expect(page.locator('#confirm-danger')).toBeFocused()
})

/** Widest border side width and its style, from logical computed properties. */
const borderOf = (locator: ReturnType<Page['locator']>) =>
  locator.evaluate((el) => {
    const cs = getComputedStyle(el)
    return ['block-start', 'block-end', 'inline-start', 'inline-end'].map((side) => ({
      side,
      width: parseFloat(cs.getPropertyValue(`border-${side}-width`)),
      style: cs.getPropertyValue(`border-${side}-style`),
    }))
  })

// Forced colours drop the fill, so a toast and a banner stay visible only by
// their border. Fails if the border is removed and only the background kept:
// every side is then 0px and `none`.
test('under forced colours an open toast and a banner keep a real border', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' })
  await page.goto('/notifications')
  await waitForHydration(page)
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true)

  await page.locator('#banner-warning').click()
  const toast = page.locator('[role="dialog"]', { hasText: 'Mounted toast' })
  const banner = page.locator('[role="status"]', { hasText: 'Warning banner' })
  await expect(toast).toBeVisible()
  await expect(banner).toBeVisible()

  for (const [name, locator] of [
    ['toast', toast],
    ['banner', banner],
  ] as const) {
    for (const side of await borderOf(locator)) {
      expect(side.width, `${name}: border-${side.side}-width`).toBeGreaterThanOrEqual(1)
      expect(side.style, `${name}: border-${side.side}-style`).not.toBe('none')
    }
  }
})
