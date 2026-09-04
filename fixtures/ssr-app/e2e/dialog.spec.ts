import { expect, test } from '@playwright/test'

/**
 * Phase 4d's browser checks — the half of ADR-0005 and ADR-0010 that only a
 * real browser can settle.
 *
 * `Dialog.ssr.test.tsx` covers what a string render can say and is explicit
 * that its headline claim cannot fail. Everything here can: each assertion
 * below was perturbation-proven against a specific, plausible defect.
 */

const waitForHydration = (page: import('@playwright/test').Page) =>
  page.waitForFunction(() => document.documentElement.dataset['apHydrated'] === 'true', undefined, {
    timeout: 10_000,
  })

test('the popup is absent from the server response and arrives only after hydration', async ({
  page,
}) => {
  const response = await page.goto('/dialog')
  const serverHtml = (await response?.text()) ?? ''

  // Asserted on the RAW response body, before any script runs — `page.content()`
  // would return the hydrated DOM and pass no matter what the server sent.
  expect(serverHtml).toContain('Delete…')
  expect(serverHtml).not.toContain('role="dialog"')
  expect(serverHtml).not.toContain('cannot be undone')

  await waitForHydration(page)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Delete…' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('the popup portals to <body>, escaping any stacking context on the page', async ({ page }) => {
  await page.goto('/dialog')
  await waitForHydration(page)
  await page.getByRole('button', { name: 'Delete…' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  // Base UI's dialog is a portalled <div>, NOT a native <dialog> in the top
  // layer — so its z-index only competes within its own stacking context. If it
  // rendered inside <main>, any ancestor with transform/filter/contain would
  // trap it there and no z-index could lift it. This asserts the escape.
  const parentage = await page.evaluate(() => {
    const popup = document.querySelector('[role="dialog"]')
    if (!popup) return { reachedBody: false, insideMain: true }
    let node: HTMLElement | null = popup.parentElement
    let insideMain = false
    while (node && node !== document.body) {
      if (node.tagName === 'MAIN') insideMain = true
      node = node.parentElement
    }
    return { reachedBody: node === document.body, insideMain }
  })
  expect(parentage.reachedBody).toBe(true)
  expect(parentage.insideMain).toBe(false)
})

test('focus moves into the dialog, is trapped, and returns to the trigger on close', async ({
  page,
}) => {
  await page.goto('/dialog')
  await waitForHydration(page)

  const trigger = page.getByRole('button', { name: 'Delete…' })
  await trigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()

  // Focus is inside the popup, not left behind on the trigger.
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)

  // Trapped: tab well past the number of focusable controls in the popup (there
  // are four) and confirm focus never settles on the page behind it. Tabbing
  // exactly four times would pass even with a broken trap, because the last Tab
  // would still be landing inside.
  //
  // `expect.poll`, not a bare read: the wrap is implemented with focus guards
  // that sit OUTSIDE the popup, so immediately after the final Tab the active
  // element legitimately is a guard, and JavaScript moves it back on the next
  // tick. A synchronous assertion catches that intermediate state and reports a
  // working trap as broken — which is exactly what it did on the first run
  // here. What matters is where focus comes to REST.
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab')
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const el = document.activeElement
            return !!el?.closest('[role="dialog"]')
          }),
        { message: `focus came to rest outside the dialog after Tab ${i + 1}`, timeout: 2000 },
      )
      .toBe(true)
  }

  // The negative half, and the one that actually distinguishes a trap from a
  // long tab order: nothing on the page behind the dialog is reachable.
  expect(
    await page.evaluate(() => ['before', 'open-dialog'].includes(document.activeElement?.id ?? '')),
  ).toBe(false)

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Returned to the trigger — not to <body>, which is where focus lands when
  // an element is removed without restoration, and which reads to a screen
  // reader user as being dumped at the top of the page.
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('open-dialog')
})

test('the entrance animates translate at full motion (ADR-0010)', async ({ page }) => {
  await page.goto('/dialog')
  await waitForHydration(page)
  await page.getByRole('button', { name: 'Delete…' }).click()

  const props = await page.evaluate(() => {
    const popup = document.querySelector('[role="dialog"]') as HTMLElement | null
    if (!popup) return []
    const names = new Set<string>()
    for (const a of popup.getAnimations()) {
      for (const frame of (a.effect as KeyframeEffect).getKeyframes()) {
        for (const key of Object.keys(frame)) names.add(key)
      }
    }
    return [...names]
  })

  // Read off the RESOLVED keyframes rather than the stylesheet text: this is
  // the only way to know the `var(--ap-motion-enter-fade-rise)` binding
  // actually resolved. With motion.css unlinked the animation list is empty and
  // this fails, which is the failure mode that is otherwise invisible.
  expect(props, 'the popup has no running animation — motion.css is probably not linked').not.toEqual(
    [],
  )
  expect(props).toContain('translate')
  expect(props).toContain('opacity')
})

/**
 * An explicit `browser.newContext({ reducedMotion })` rather than
 * `test.use({ reducedMotion: 'reduce' })`. The declarative form silently did
 * not apply here — `matchMedia('(prefers-reduced-motion: reduce)')` stayed
 * `false` inside the test while the same option on a hand-built context worked
 * — and the symptom was a popup that "still animates translate under reduced
 * motion", i.e. it looked exactly like a component defect. The emulation is
 * therefore asserted before the keyframes are read, so a harness that stops
 * emulating can never again be mistaken for a library that stopped degrading.
 */
test('the entrance degrades to opacity under reduced motion, with no component change (spec gate 14)', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    await page.goto(`${baseURL}/dialog`)
    await waitForHydration(page)
    await page.getByRole('button', { name: 'Delete…' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    expect(
      await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
      'prefers-reduced-motion is not being emulated — everything below would be meaningless',
    ).toBe(true)

    const props = await page.evaluate(() => {
      const popup = document.querySelector('[role="dialog"]') as HTMLElement | null
      if (!popup) return []
      const names = new Set<string>()
      for (const a of popup.getAnimations()) {
        for (const frame of (a.effect as KeyframeEffect).getKeyframes()) {
          for (const key of Object.keys(frame)) names.add(key)
        }
      }
      return [...names]
    })

    // The whole ADR-0010 claim in one pair of assertions: same component, same
    // class, same stylesheet — only the media query differs, and the movement
    // is gone while the state change stays perceivable.
    expect(props).toContain('opacity')
    expect(props, 'the popup still animates translate under reduced motion').not.toContain(
      'translate',
    )
  } finally {
    await context.close()
  }
})

test('each size caps the popup, and `fit` never collapses around a form', async ({ page }) => {
  await page.goto('/dialog')
  await waitForHydration(page)

  const measure = async (size: string) => {
    await page.getByRole('button', { name: `open ${size}` }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    const box = await page.evaluate(() => {
      const popup = document.querySelector('[role="dialog"]') as HTMLElement
      const cs = getComputedStyle(popup)
      return {
        width: popup.getBoundingClientRect().width,
        min: cs.minInlineSize,
        max: cs.maxInlineSize,
      }
    })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    return box
  }

  const sm = await measure('sm')
  const md = await measure('md')
  const lg = await measure('lg')
  const xl = await measure('xl')

  // Read off computed style, so this tracks the Tier 3 tokens rather than
  // repeating their values here — a retheme moves both together.
  const caps = [sm, md, lg, xl].map((b) => parseFloat(b.max))
  expect(caps.every((c) => c > 0)).toBe(true)
  expect(caps, 'the four size caps must be strictly increasing').toEqual([...caps].sort((a, b) => a - b))
  expect(new Set(caps).size, 'two sizes resolved to the same cap').toBe(4)

  // The one that matters. This popup wraps a Field and an Input, and Input is
  // `inline-size: 100%` — a percentage-width child contributes nothing to
  // max-content, so a bare `fit-content` collapses to the width of the label
  // and renders the input as a sliver. The floor is what prevents it.
  const fit = await measure('fit')
  expect(parseFloat(fit.min), '`fit` has no min-inline-size floor').toBeGreaterThan(0)
  expect(
    fit.width,
    '`fit` collapsed below its floor — the shrink-to-fit failure the floor exists to prevent',
  ).toBeGreaterThanOrEqual(parseFloat(fit.min))
})
