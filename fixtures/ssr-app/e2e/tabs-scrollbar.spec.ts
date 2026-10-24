import { expect, test, type Page } from '@playwright/test'

/**
 * The Tabs underline list with a classic (space-taking) scrollbar, as on
 * Chrome and Edge for Windows. Playwright's Chromium hides scrollbars by
 * default (`--hide-scrollbars`), and so do the Storybook browser tests and
 * gate 9, which is why this case lives here.
 */
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

const waitForHydration = (page: Page) =>
  page.waitForFunction(() => document.documentElement.dataset['apHydrated'] === 'true', undefined, {
    timeout: 10_000,
  })

/** A full-width, 1px-high screenshot strip of the list's visible area, `up` px above its padding-box bottom. */
const stripAbovePaddingEdge = async (page: Page, listName: string, up: number) => {
  const box = await page.getByRole('tablist', { name: listName }).evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.left + el.clientLeft, y: r.top + el.clientTop + el.clientHeight, width: el.clientWidth }
  })
  // The right half only: at scroll 0 the selected first tab, and its
  // indicator, are on the left.
  return page.screenshot({
    clip: { x: box.x + box.width / 2, y: box.y - 1 - up, width: box.width / 2 - 1, height: 1 },
  })
}

// An overflowing underline list shows a scrollbar under its tabs. The
// hairline must be drawn above that scrollbar, where the indicator is, so the
// indicator still covers it. Perturbation: an inset `box-shadow` hairline is
// painted at the border-box bottom, under the scrollbar, so the strip just
// above the scrollbar is plain background and matches the strip above it.
test('with a classic scrollbar the hairline sits above it, under the indicator', async ({ page }) => {
  await page.goto('/disclosure')
  await waitForHydration(page)
  const list = page.getByRole('tablist', { name: 'Employee sections' })
  await list.evaluate((el) => {
    el.style.maxInlineSize = '9rem'
  })

  const geometry = () =>
    list.evaluate((el) => {
      const indicator = el.querySelector(':scope > [role="presentation"]')!
      return {
        scrollbar: el.offsetHeight - el.clientHeight - el.clientTop * 2,
        paddingBottom: el.getBoundingClientRect().top + el.clientTop + el.clientHeight,
        indicatorBottom: indicator.getBoundingClientRect().bottom,
      }
    })

  // Not vacuous: the scrollbar really takes space.
  const g = await geometry()
  expect(g.scrollbar, 'scrollbar thickness').toBeGreaterThan(0)
  expect(Math.abs(g.indicatorBottom - g.paddingBottom)).toBeLessThanOrEqual(0.5)

  const hairline = await stripAbovePaddingEdge(page, 'Employee sections', 0)
  const plain = await stripAbovePaddingEdge(page, 'Employee sections', 3)
  expect(hairline.equals(plain), 'a hairline is drawn just above the scrollbar').toBe(false)

  // Scrolled to the end, the hairline still spans the visible list.
  await list.evaluate((el) => {
    el.scrollLeft = el.scrollWidth
  })
  const scrolledHairline = await stripAbovePaddingEdge(page, 'Employee sections', 0)
  const scrolledPlain = await stripAbovePaddingEdge(page, 'Employee sections', 3)
  expect(scrolledHairline.equals(scrolledPlain), 'hairline after scrolling').toBe(false)
})
