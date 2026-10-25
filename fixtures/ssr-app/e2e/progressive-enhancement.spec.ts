import { expect, test, type Page } from '@playwright/test'

/**
 * ADR-0011 §4: uncontrolled-first exists so that "an RR8 `<Form method="post">`
 * submits and the action runs BEFORE hydration completes, because the browser
 * is submitting a real form".
 *
 * Proving that with a race — click fast enough and hope hydration hasn't
 * finished — is a flaky test that passes for the wrong reason on a fast
 * machine. So this blocks every client JavaScript bundle instead: hydration
 * cannot complete because the code to do it never arrives. If the submitted
 * value still reaches the server action, the form worked as HTML, which is
 * strictly stronger than "worked before hydration finished".
 */
async function blockClientJavaScript(page: Page): Promise<void> {
  await page.route('**/*.js', (route) => route.abort())
}

test('the form submits and the action runs with client JavaScript blocked', async ({ page }) => {
  await blockClientJavaScript(page)
  await page.goto('/form')

  // Guard the guard: if hydration DID happen, this test would be proving
  // nothing, so assert the marker root.tsx sets from its effect is absent.
  //
  // Located by ROLE + accessible name, not `#email-input`, deliberately: Base
  // UI's Field seeds the control's id from its own internal `useId()` on first
  // render and only reconciles it to the caller's explicit `id` prop from a
  // client effect (`useLabelableId`, @base-ui/react/internals/labelable-provider)
  // — confirmed by fetching this route's raw SSR HTML directly, with no
  // browser involved at all: the server markup carries a `base-ui-…`
  // generated id, never the literal `"email-input"`, until that effect runs
  // post-hydration. With client JS genuinely blocked that effect never
  // fires, so `#email-input` never matches. `for`/`id` association is still
  // real and still present pre-hydration (`Field.ssr.test.tsx` and the SSR
  // gate's `serves the form route...` test both assert exactly this
  // pairing), and the accessible name resolves through it.
  //
  // `getByRole('textbox', { name })`, not `getByLabel('Email')`, and the
  // difference is load-bearing rather than stylistic. `getByLabel` is a
  // case-insensitive SUBSTRING match, and Playwright treats every `<input>`
  // whose `type !== 'hidden'` as labelable — including the visually hidden
  // `<input type="radio">` each `RadioGroup` option renders inside its own
  // `<label>`. So the moment this route gained a radio option whose text
  // merely CONTAINED "Email", `getByLabel('Email')` resolved to two elements
  // and strict mode failed every assertion and `fill()` below. The role
  // filter is still name-derived (the accessible name comes from the same
  // `for`/`id` label association) but it cannot match a `role="radio"`
  // element at all, so the whole class of collision is gone rather than
  // dodged once. Prefer this form for any control in a form that also holds
  // checkboxes, switches or radios.
  await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible()
  const hydrated = await page.evaluate(() => document.documentElement.dataset['apHydrated'])
  expect(hydrated, 'client JS was not actually blocked — this test proves nothing').toBeUndefined()

  await page.getByRole('textbox', { name: 'Email' }).fill('a@b.c')
  await page.locator('button[type="submit"]').click()

  await expect(page.locator('#submitted')).toHaveText('received: a@b.c')
})

test('a server-side validation error renders with an icon, not colour alone', async ({ page }) => {
  await blockClientJavaScript(page)
  await page.goto('/form')
  // Guard the guard, same as the first test — without this, a silently
  // ineffective `blockClientJavaScript` would let RR8 submit this via a
  // client-side fetch instead of a real POST, and the test would still go
  // green while proving nothing about the JS-free path.
  const hydrated = await page.evaluate(() => document.documentElement.dataset['apHydrated'])
  expect(hydrated, 'client JS was not actually blocked — this test proves nothing').toBeUndefined()
  // See the id/name note in the first test above — `#email-input` does not
  // exist in server-only markup, so this fills by role + accessible name the
  // same way, for the same two reasons.
  await page.getByRole('textbox', { name: 'Email' }).fill('not-an-email')
  await page.locator('button[type="submit"]').click()

  const errorText = page.getByText('That is not an email address.')
  await expect(errorText).toBeVisible()
  // ADR-0011 §5 / WCAG 1.4.1 — the error must carry a non-colour cue. Located
  // FROM the message as its immediate preceding sibling, never as a page-wide
  // `locator('svg')` count: that would pass on any icon anywhere on the page.
  //
  // `*[1][local-name()='svg']`, not the bare `svg` node test: the browser
  // parses an `<svg>` tag through HTML's foreign-content algorithm into the
  // real SVG namespace (confirmed directly: `el.namespaceURI` is
  // `http://www.w3.org/2000/svg`), and XPath's unprefixed name test only
  // matches the *null* namespace — `preceding-sibling::svg` silently matches
  // nothing for a real `<svg>` regardless of hydration state, so it would
  // never distinguish an icon actually being there from one that isn't. The
  // `[1]` is what makes this the *immediate* preceding sibling, matching
  // the comment above — `preceding-sibling::*` alone would count every
  // element before the message, not just the one right next to it.
  await expect(errorText.locator("xpath=preceding-sibling::*[1][local-name()='svg']")).toHaveCount(1)
})

test('the same form still works after hydration, with no console noise', async ({ page }) => {
  const messages: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') messages.push(m.text())
  })
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`))

  await page.goto('/form')
  await page.waitForFunction(
    () => document.documentElement.dataset['apHydrated'] === 'true',
    undefined,
    { timeout: 10_000 },
  )
  await page.fill('#email-input', 'x@y.z')
  await page.locator('button[type="submit"]').click()
  await expect(page.locator('#submitted')).toHaveText('received: x@y.z')

  const noise = messages.filter((m) => !/Download the React DevTools|favicon/i.test(m))
  expect(noise, `unexpected console output:\n${noise.join('\n')}`).toEqual([])
})

test("the Getting started form posts to its action, as the guide's reader will", async ({ page }) => {
  // routes/start.tsx is quoted by the guide and posts to /subscribe. With client
  // JavaScript blocked the browser submits it as plain HTML.
  // Perturbation: delete the `subscribe` route, and the post lands on a 404.
  await blockClientJavaScript(page)
  await page.goto('/start')
  await page.getByRole('textbox', { name: 'Email' }).fill('reader@example.com')
  await page.getByRole('button', { name: 'Subscribe' }).click()
  await expect(page).toHaveURL(/\/subscribe$/)
  await expect(page.getByTestId('subscribed')).toHaveText('Subscribed reader@example.com.')
})
