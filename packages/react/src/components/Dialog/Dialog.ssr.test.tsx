import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Dialog } from './Dialog.js'
import { Button } from '../Button/Button.js'
import { LocaleProvider } from '../../providers/LocaleProvider.js'

/**
 * What this file can and cannot prove — stated up front, because the headline
 * claim here is one that CANNOT FAIL, and an assertion that cannot fail reads
 * like coverage while providing none.
 *
 * "Portal content is absent from server HTML" is guaranteed twice over, by two
 * mechanisms that are both outside our code:
 *
 * 1. `react-dom/server` has no way to emit a portal's children at all. Adding
 *    `keepMounted` to the portal — the obvious way to get this wrong — leaves
 *    every assertion below green.
 * 2. Base UI refuses to render a popup outside a portal: dropping
 *    `Dialog.Portal` throws `Base UI: <Dialog.Portal> is missing.` before any
 *    markup exists to assert on.
 *
 * Both perturbations were run. Neither turns these assertions red, so this file
 * is a REGRESSION GUARD against those two guarantees changing under us, not
 * evidence that our composition is what keeps the popup out of the page.
 *
 * The parts below that are genuinely ours and genuinely falsifiable: that
 * rendering touches no browser global, and that the trigger survives into the
 * server markup. The hydration half of ADR-0005 is not knowable from a string
 * at all — it is asserted over a real HTTP response by `test:ssr` and in a real
 * browser by `test:hydration`, which is where spec gate 10 actually has teeth.
 *
 * The dialog is opened here deliberately: a closed dialog renders nothing for
 * reasons that have nothing to do with portalling.
 */
describe('Dialog renders on the server', () => {
  const html = renderToString(
    <LocaleProvider>
      <Dialog
        title="Delete employee"
        description="This cannot be undone."
        trigger={<Button>Open</Button>}
        footer={<Button>Confirm</Button>}
        defaultOpen
      >
        body copy
      </Dialog>
    </LocaleProvider>,
  )

  it('runs with no browser globals present', () => {
    expect(typeof window).toBe('undefined')
  })

  it('renders the trigger', () => {
    expect(html).toContain('Open')
  })

  it('keeps the whole popup subtree out of the server markup, even when open', () => {
    // Each of these is a different part of the surface. A popup that escaped
    // its portal would drag all of them into the page at once, but they are
    // asserted separately so the failure names which part leaked.
    expect(html).not.toContain('Delete employee')
    expect(html).not.toContain('This cannot be undone.')
    expect(html).not.toContain('body copy')
    expect(html).not.toContain('Confirm')
  })

  it('emits no dialog role and no scrim', () => {
    // The structural half: a backdrop rendered server-side paints an
    // undismissable scrim over a page whose JavaScript has not arrived yet.
    expect(html).not.toContain('role="dialog"')
    expect(html).not.toContain('aria-modal')
  })
})
