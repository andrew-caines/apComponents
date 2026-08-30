import { expect, test, type ConsoleMessage } from '@playwright/test'

/** React hydration problems surface as console errors/warnings with these markers. */
const HYDRATION_MARKERS = [
  'Hydration failed',
  'did not match',
  'server rendered HTML',
  'Text content does not match',
  'There was an error while hydrating',
  'server-rendered',
]

/**
 * Noise that is not a defect in the library. Keep this list short and
 * justified — never add a hydration marker to it.
 */
const IGNORED = [/favicon/i, /Download the React DevTools/i]

function collect(page: import('@playwright/test').Page): string[] {
  const messages: string[] = []
  const keep = (text: string): boolean => !IGNORED.some((r) => r.test(text))
  page.on('console', (m: ConsoleMessage) => {
    if ((m.type() === 'error' || m.type() === 'warning') && keep(m.text())) messages.push(m.text())
  })
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`))
  return messages
}

test('home route hydrates with no React warnings or page errors', async ({ page }) => {
  const messages = collect(page)
  await page.goto('/')
  await expect(page.locator('#surface-raised')).toBeVisible()
  await page.waitForTimeout(500) // let hydration settle

  const hydration = messages.filter((m) => HYDRATION_MARKERS.some((k) => m.includes(k)))
  expect(hydration, `hydration problems:\n${hydration.join('\n')}`).toEqual([])
  expect(messages, `unexpected console output:\n${messages.join('\n')}`).toEqual([])
})

test('streamed route hydrates cleanly after late Suspense content', async ({ page }) => {
  const messages = collect(page)
  await page.goto('/streamed')
  await expect(page.locator('#streamed-surface')).toBeVisible()
  await page.waitForTimeout(500)

  expect(messages, `unexpected console output:\n${messages.join('\n')}`).toEqual([])
})

test('token custom properties resolve to real computed values in the browser', async ({ page }) => {
  await page.goto('/')
  const bg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--ap-color-bg-canvas').trim(),
  )
  expect(bg, 'theme.css did not reach the browser').not.toBe('')

  const surfaceBg = await page.evaluate(() => {
    const el = document.querySelector('#surface-raised')!
    return getComputedStyle(el).backgroundColor
  })
  expect(surfaceBg, 'Surface has no resolved background').not.toBe('rgba(0, 0, 0, 0)')
})

test('Inter loads from our own origin, never a third party (ADR-0015)', async ({ page }) => {
  const external: string[] = []
  page.on('request', (r) => {
    const url = new URL(r.url())
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') external.push(r.url())
  })
  await page.goto('/')
  await page.waitForTimeout(500)
  expect(external, `third-party requests: ${external.join(', ')}`).toEqual([])
})
