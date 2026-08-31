import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * React hydration problems surface as console errors/warnings with these
 * markers — but only in an unminified/dev React build. This fixture builds
 * React in production mode, where a real mismatch instead surfaces as a
 * minified error (e.g. "Minified React error #418") that contains none of
 * these substrings — confirmed by deliberately injecting a mismatch during
 * this gate's own review (see task-8-report.md). So in practice this list is
 * a best-effort, friendlier failure message for local/dev debugging only; it
 * is NOT the enforcement mechanism. The broad "zero unexpected console
 * output" assertion below is what actually enforces the gate — never weaken
 * that assertion, and never treat a pass here as proof of a clean hydration.
 */
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

function collect(page: Page): string[] {
  const messages: string[] = []
  const keep = (text: string): boolean => !IGNORED.some((r) => r.test(text))
  page.on('console', (m: ConsoleMessage) => {
    if ((m.type() === 'error' || m.type() === 'warning') && keep(m.text())) messages.push(m.text())
  })
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`))
  return messages
}

/**
 * Waits for the client-only hydration marker set by `app/root.tsx`'s effect.
 * An effect runs only after React has finished hydrating, so this is a real
 * positive signal — unlike a fixed sleep, a stalled or failed hydration
 * surfaces as a clear timeout here rather than a silent pass.
 */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset['apHydrated'] === 'true', undefined, {
    timeout: 10_000,
  })
}

test('home route hydrates with no React warnings or page errors', async ({ page }) => {
  const messages = collect(page)
  await page.goto('/')
  await expect(page.locator('#surface-raised')).toBeVisible()
  await waitForHydration(page)
  await page.waitForTimeout(200) // settle window for errors that fire just after hydration

  const hydration = messages.filter((m) => HYDRATION_MARKERS.some((k) => m.includes(k)))
  expect(hydration, `hydration problems:\n${hydration.join('\n')}`).toEqual([])
  expect(messages, `unexpected console output:\n${messages.join('\n')}`).toEqual([])
})

test('streamed route hydrates cleanly after late Suspense content', async ({ page }) => {
  const messages = collect(page)
  await page.goto('/streamed')
  await expect(page.locator('#streamed-surface')).toBeVisible()
  await waitForHydration(page)
  await page.waitForTimeout(200)

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

test('Inter loads from our own origin, never a third party (ADR-0015)', async ({ page, baseURL }) => {
  // Compare full origin (scheme + host + port), not just hostname — a
  // same-host request on a different port would otherwise be misclassified
  // as our own.
  const ownOrigin = new URL(baseURL ?? 'http://127.0.0.1:3112').origin
  const external: string[] = []
  const fontRequests: string[] = []
  page.on('request', (r) => {
    const url = r.url()
    const origin = new URL(url).origin
    if (origin !== ownOrigin) external.push(url)
    if (/inter-.*\.woff2/.test(url)) fontRequests.push(url)
  })
  await page.goto('/')
  await waitForHydration(page)
  await page.waitForTimeout(200)
  expect(external, `third-party requests: ${external.join(', ')}`).toEqual([])
  // The negative assertion above passes identically if fonts.css failed to
  // bundle, --ap-font-body stopped naming 'Inter', or the relative font url()
  // broke and no woff2 was ever requested. Assert the positive half: Inter is
  // actually served, from our own origin, and the browser actually loaded it.
  expect(fontRequests, 'no same-origin Inter woff2 request was observed').not.toEqual([])
  const interLoaded = await page.evaluate(() => document.fonts.check('1em Inter'))
  expect(interLoaded, "document.fonts.check('1em Inter') was false").toBe(true)
})
