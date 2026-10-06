import { expect, test, type Page } from '@playwright/test'

/**
 * Tabs and Accordion in a real browser: what the server HTML holds, and how
 * both behave after hydration.
 */

const waitForHydration = (page: Page) =>
  page.waitForFunction(() => document.documentElement.dataset['apHydrated'] === 'true', undefined, {
    timeout: 10_000,
  })

/** The opening tag of the element that wraps `#id`'s content and has `role="region"`. */
const panelTagAround = (html: string, id: string): string => {
  const at = html.indexOf(`id="${id}"`)
  const before = html.slice(0, at)
  const start = before.lastIndexOf('role="region"')
  const open = before.lastIndexOf('<div', start)
  return at < 0 || start < 0 ? '' : html.slice(open, html.indexOf('>', start) + 1)
}

test('the server HTML holds the selected tab content only, and no script in the tabs', async ({
  page,
}) => {
  const response = await page.goto('/disclosure')
  const serverHtml = (await response?.text()) ?? ''

  // Fails if the first-enabled-item default is dropped: no panel would be selected on the server.
  expect(serverHtml).toContain('id="tab-profile"')
  // Fails if inactive panels were rendered (keepMounted defaulted on).
  expect(serverHtml).not.toContain('id="tab-pay"')
  expect(serverHtml).not.toContain('id="tab-leave"')

  const start = serverHtml.indexOf('<section id="tabs-host">')
  const end = serverHtml.indexOf('</section>', start)
  expect(start, 'the tabs container was not found').toBeGreaterThan(-1)
  // Fails if the indicator renders Base UI's renderBeforeHydration script.
  expect(serverHtml.slice(start, end)).not.toContain('<script')
})

test('closed accordion content is in the server HTML under plain hidden', async ({ page }) => {
  const response = await page.goto('/disclosure')
  const serverHtml = (await response?.text()) ?? ''

  // Fails if the content were unmounted while closed (keepMounted off).
  expect(serverHtml).toContain('id="acc-input"')
  const tag = panelTagAround(serverHtml, 'acc-input')
  expect(tag, 'the panel tag around acc-input was not found').not.toBe('')
  // Fails if hiddenUntilFound were dropped from the server: the panel would not be hidden.
  expect(tag).toMatch(/\shidden(=""|\s|>)/)
  // Fails if the server rendered until-found, which React cannot (it is set in a layout effect).
  expect(tag).not.toContain('until-found')
})

test('after hydration the panel is hidden until-found and beforematch opens it', async ({
  page,
}) => {
  await page.goto('/disclosure')
  await waitForHydration(page)

  const panel = page.locator('[role="region"]:has(#acc-input)')
  // Fails if the hiddenUntilFound default is dropped: the value stays plain "".
  await expect(panel).toHaveAttribute('hidden', 'until-found')
  const trigger = page.getByRole('button', { name: 'Second' })
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  await panel.dispatchEvent('beforematch')

  // Fails if Base UI's beforematch listener is not attached.
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#acc-input')).toBeVisible()
})

test('a keyboard user tabs into the tabs, ArrowRight then Enter changes the panel', async ({
  page,
}) => {
  await page.goto('/disclosure')
  await waitForHydration(page)

  await page.keyboard.press('Tab')
  await expect(page.getByRole('tab', { name: 'Profile' })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Pay' })).toBeFocused()
  // Manual activation: arrowing alone must not change the panel.
  await expect(page.locator('#tab-profile')).toBeVisible()
  await page.keyboard.press('Enter')

  // Fails if activateOnFocus were on (the panel would change before Enter) or Enter did nothing.
  await expect(page.locator('#tab-pay')).toBeVisible()
  await expect(page.locator('#tab-profile')).toHaveCount(0)
})

test('real Tab does not enter a closed accordion section, and reaches it once opened', async ({
  page,
}) => {
  await page.goto('/disclosure')
  await waitForHydration(page)

  const second = page.getByRole('button', { name: 'Second' })
  await second.focus()
  await page.keyboard.press('Tab')
  // Fails if a hidden panel's content were focusable (display not none).
  await expect(page.getByRole('button', { name: 'Third' })).toBeFocused()
  expect(await page.evaluate(() => document.activeElement?.id)).not.toBe('acc-input')

  await second.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#acc-input')).toBeVisible()
  await page.keyboard.press('Tab')
  // Fails if opening did not make the content reachable.
  await expect(page.locator('#acc-input')).toBeFocused()
})
