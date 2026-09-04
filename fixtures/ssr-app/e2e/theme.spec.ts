import { expect, test, type Page } from '@playwright/test'

/**
 * ADR-0009's runtime theming path in a real browser.
 *
 * The unit tests assert the markup: a style element, a scope class, the
 * attribute on the right element. None of that answers the question that
 * actually matters — whether the cascade resolves the way the design claims —
 * so the assertions here read computed values, not markup.
 */

const waitForHydration = (page: Page) =>
  page.waitForFunction(() => document.documentElement.dataset['apHydrated'] === 'true', undefined, {
    timeout: 10_000,
  })

const brandOf = (page: Page, id: string) =>
  page.evaluate(
    (sel) => getComputedStyle(document.querySelector(sel)!).getPropertyValue('--ap-brand-9').trim(),
    `#${id}`,
  )

test('a per-tenant theme is in the server response, not injected after hydration', async ({
  page,
}) => {
  const response = await page.goto('/theme')
  const html = (await response?.text()) ?? ''

  // The whole point of the runtime path being render-time rather than
  // effect-time: the tokens ship with the document, so the first paint is
  // already correct. An effect-injected stylesheet would leave this body
  // without the scoped rule and repaint after hydration — a visible flash of
  // the wrong brand, which no screenshot taken after load would ever catch.
  expect(html).toContain('--ap-brand-9')
  expect(html).toMatch(/<style[^>]*>[^<]*\.ap-t-/)
})

test('the tenant theme applies inside its scope and nowhere else', async ({ page }) => {
  await page.goto('/theme')
  await waitForHydration(page)

  const outside = await brandOf(page, 'outside')
  const tenant = await brandOf(page, 'tenant')
  const nested = await brandOf(page, 'nested')

  for (const [name, value] of [
    ['outside', outside],
    ['tenant', tenant],
    ['nested', nested],
  ] as const) {
    expect(value, `${name} resolved --ap-brand-9 to nothing at all`).not.toBe('')
  }

  // The containment claim. Without this, an override that leaked to :root would
  // satisfy every "the tenant colour is applied" assertion perfectly.
  expect(tenant, 'the tenant theme did not override the build-time brand').not.toBe(outside)
  expect(outside, 'the tenant theme leaked outside its provider').toBe(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--ap-brand-9').trim(),
    ),
  )

  // And that scoping composes: the inner provider wins for its own subtree
  // without disturbing the outer one.
  expect(nested, 'the nested provider did not re-scope').not.toBe(tenant)
  expect(nested).not.toBe(outside)
})

test('hydrates with no console noise', async ({ page }) => {
  const problems: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text())
  })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))

  await page.goto('/theme')
  await waitForHydration(page)

  // A scope class that differed between the server render and the client would
  // surface here as a hydration mismatch — which is the failure `useId` is
  // chosen to prevent.
  expect(problems.filter((p) => !/favicon|DevTools/i.test(p))).toEqual([])
})
