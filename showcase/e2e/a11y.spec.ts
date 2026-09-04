import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { SECTIONS } from '../app/sections.js'

/**
 * Gate 5 — accessibility.
 *
 * **What this proves, exactly:** zero MACHINE-DETECTABLE violations. Automated
 * tooling catches roughly 30–40% of WCAG issue types; it cannot tell you whether
 * a label is meaningful, whether focus order makes sense, or whether an error
 * message is comprehensible. ADR-0014 says this outright, and it is repeated
 * here because a green gate named "accessibility" is the single most inviting
 * thing in this repository to over-read. The manual screen-reader pass per
 * component is still owed and is not replaced by this file.
 *
 * **Why the showcase and not Storybook.** The spec (§7.1) originally chose
 * Storybook as the host for this gate. The showcase did not exist then. It now
 * renders every component and every variant in a real browser and is already
 * walked by `smoke.spec.ts`, so axe runs over the same pages for the cost of
 * this file instead of a second toolchain — which the spec's own risk table
 * flags as a CI-weight concern. The trade is failure-report granularity: a
 * violation names the page, not the story. That is mitigated below by printing
 * the offending selector and the rule's help URL, which is what you need to fix
 * it anyway.
 */

const waitForHydration = (page: Page) =>
  page.waitForFunction(() => document.documentElement.dataset['apHydrated'] === 'true', undefined, {
    timeout: 10_000,
  })

const analyse = (page: Page) =>
  new AxeBuilder({ page })
    // The four WCAG tags we hold ourselves to. Naming them rather than taking
    // axe's defaults keeps the bar explicit and stops it drifting when axe
    // changes what it enables by default.
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

/** Turns axe's result into something a failure message can actually be read from. */
const describeViolations = (results: Awaited<ReturnType<typeof analyse>>) =>
  results.violations
    .map(
      (v) =>
        `${v.id} (${v.impact ?? 'unknown'}): ${v.help}\n` +
        v.nodes.map((n) => `    at ${n.target.join(' ')}`).join('\n') +
        `\n    ${v.helpUrl}`,
    )
    .join('\n\n')

test('there are sections to check', () => {
  // An empty list would make every assertion below vacuous by not existing.
  expect(SECTIONS.length).toBeGreaterThan(0)
})

for (const section of SECTIONS) {
  test(`/${section.slug} has no axe violations`, async ({ page }) => {
    await page.goto(`/${section.slug}`)
    await waitForHydration(page)
    const results = await analyse(page)
    expect(results.violations.length, `\n${describeViolations(results)}\n`).toBe(0)

    // A run that checked nothing reports zero violations exactly like a clean
    // page does. Asserting that axe actually examined something is what tells
    // those two apart.
    expect(results.passes.length, 'axe ran no checks at all on this page').toBeGreaterThan(0)
  })
}

test('an OPEN dialog has no axe violations', async ({ page }) => {
  // The state that matters most and the one a page-load scan structurally
  // cannot reach: while closed, the popup is not in the DOM, so scanning
  // /dialog proves nothing about the modal itself — its focus trap, its
  // labelling, or the `aria-hidden` treatment of the page behind it.
  await page.goto('/dialog')
  await waitForHydration(page)
  await page.getByRole('button', { name: 'Delete…' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  const results = await analyse(page)
  expect(results.violations.length, `\n${describeViolations(results)}\n`).toBe(0)
  expect(results.passes.length).toBeGreaterThan(0)
})

test('a field showing an error has no axe violations', async ({ page }) => {
  // Error states pair colour with an icon and wire `aria-describedby`; both are
  // rendered on load here, so this is a plain scan — but it is called out
  // separately so the coverage is legible rather than incidental.
  await page.goto('/field-input')
  await waitForHydration(page)
  await expect(page.getByText('That address is already in use.')).toBeVisible()

  const results = await analyse(page)
  expect(results.violations.length, `\n${describeViolations(results)}\n`).toBe(0)
})
