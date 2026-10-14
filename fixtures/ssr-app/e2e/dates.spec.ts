import { expect, test } from '@playwright/test'

// The server renders in Node's zone; the browser runs in the zone set here.
// A PlainDate and a ZonedDateTime must read the same in both zones. The
// Instant is the positive control: it must follow the browser zone, which
// proves the zone setting took effect, so the two equalities cannot pass
// vacuously.
// Perturbation: in routes/dates.tsx pass `new Date('1990-05-12T00:00:00Z')` instead of
// hireDate; Los Angeles then reads May 11, 1990 and this spec fails.
const CASES = [
  { timezoneId: 'America/Los_Angeles', instant: 'Mar 4, 2026, 4:00 PM' },
  { timezoneId: 'Asia/Tokyo', instant: 'Mar 5, 2026, 9:00 AM' },
]

for (const { timezoneId, instant } of CASES) {
  test.describe(`browser zone ${timezoneId}`, () => {
    test.use({ timezoneId })

    test('a PlainDate and a ZonedDateTime render the same; an Instant follows the zone', async ({ page }) => {
      await page.goto('/dates')
      await page.waitForFunction(() => document.documentElement.dataset['apHydrated'] === 'true')
      await expect(page.locator('#plain-date')).toHaveText('May 12, 1990')
      await expect(page.locator('#plain-date')).toHaveAttribute('datetime', '1990-05-12')
      await expect(page.locator('#zoned')).toHaveText('Mar 5, 2026, 9:00 AM')
      await expect(page.locator('#zoned')).toHaveAttribute('datetime', '2026-03-05T09:00:00+09:00')
      await expect(page.locator('#instant')).toHaveText(instant)
    })
  })
}
