import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'
import { SECTIONS } from '../app/sections.js'

/**
 * The one thing that keeps the showcase honest.
 *
 * A gallery nobody checks rots quietly: a component breaks, its page throws, and
 * the site keeps looking fine to anyone who does not click that tab. This walks
 * every entry in `SECTIONS`, so a new section is covered the moment it is added
 * and there is no test to remember to update — which is the whole reason the
 * section list is data rather than nine hand-written links.
 *
 * It is a smoke test, not a gate. It asserts each page renders and says nothing
 * alarming. What each component actually does is asserted in that component's
 * own tests.
 */

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

/**
 * The raw response body is HTML, so a title containing `&` arrives as `&amp;`.
 * Escaping here rather than banning ampersands from section titles: the check is
 * about server-rendered markup, and markup is escaped.
 */
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const waitForHydration = (page: Page) =>
  page.waitForFunction(() => document.documentElement.dataset['apHydrated'] === 'true', undefined, {
    timeout: 10_000,
  })

test('the section list is not empty', () => {
  // Otherwise every per-section test below would vacuously pass by not existing,
  // and an empty showcase would report itself healthy.
  expect(SECTIONS.length).toBeGreaterThan(0)
})

test('the overview links to every section', async ({ page }) => {
  const problems = collect(page)
  await page.goto('/')
  await waitForHydration(page)
  for (const section of SECTIONS) {
    await expect(
      page.getByRole('link', { name: section.title, exact: true }).first(),
      `the overview has no link to "${section.title}"`,
    ).toBeVisible()
  }
  expect(problems, `console output on /: ${problems.join(' | ')}`).toEqual([])
})

for (const section of SECTIONS) {
  test(`/${section.slug} renders cleanly`, async ({ page }) => {
    const problems = collect(page)
    const response = await page.goto(`/${section.slug}`)

    expect(response?.status(), `/${section.slug} did not return 200`).toBe(200)

    // Server-rendered before anything else runs: the heading has to be in the
    // response body, not merely in the hydrated DOM.
    expect(await response?.text()).toContain(escapeHtml(section.title))

    await waitForHydration(page)
    await expect(page.getByRole('heading', { level: 1, name: section.title })).toBeVisible()

    // The nav is on every page, and it is derived from the same list, so this
    // also catches a section that routes but never appears in navigation.
    await expect(
      page.getByRole('navigation').getByRole('link', { name: section.title, exact: true }),
    ).toHaveAttribute('aria-current', 'page')

    expect(problems, `console output on /${section.slug}: ${problems.join(' | ')}`).toEqual([])
  })
}
