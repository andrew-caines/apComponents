// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './Button.js'
import { buttonRecipe } from './Button.css.js'

// Local stand-in for a router Link (React Router's, specifically — the
// component ADR-0011 §3 names by hand). Deliberately NOT imported from
// react-router: @ap/react must not depend on it (enforced by the
// ssr-safety gate's package.json check), and this component only needs to
// reproduce the one thing that matters here — an opaque component that
// accepts `to` and forwards it to a rendered `<a href>` — to prove the
// render.props-based detection works through a component, not just a
// literal anchor.
function FakeLink({ to, ...rest }: { to: string; children?: ReactNode }) {
  return <a href={to} {...rest} />
}

describe('Button', () => {
  it('renders a real <button> by default', () => {
    render(<Button>Save</Button>)
    const el = screen.getByRole('button', { name: 'Save' })
    expect(el.tagName).toBe('BUTTON')
    // NOTE: this does not, by itself, prove nativeButton was derived true.
    // Base UI's `renderTag` helper stamps `type="button"` onto ANY element
    // it resolves from the plain string tag 'button' (the render-absent
    // path), unconditionally, regardless of nativeButton — verified against
    // BaseButton directly. It is only for a `render`-supplied element (the
    // two tests below) that `type`/`role` are gated by nativeButton at all.
    expect(el.getAttribute('type')).toBe('button')
  })

  // The brief's version of this test only checked `className !== ''`, which
  // passes for any non-empty string, including a class from the wrong
  // variant. Tying it to `buttonRecipe`'s own output for the exact default
  // combination (solid/md/action) catches that: change Button.tsx's
  // defaults, or apply them to the wrong recipe args, and this fails while
  // a bare non-empty check would not.
  it('applies recipe classes for the default variants', () => {
    render(<Button>Save</Button>)
    const el = screen.getByRole('button')
    expect(el.className).not.toBe('')
    expect(el.className).toBe(buttonRecipe({ variant: 'solid', size: 'md', tone: 'action' }))
  })

  it('merges className rather than replacing it', () => {
    render(<Button className="mine">Save</Button>)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('mine')
    expect(cls.trim().split(/\s+/).length).toBeGreaterThan(1)
  })

  it('gives different variants different classes', () => {
    const { rerender } = render(<Button variant="solid">A</Button>)
    const solid = screen.getByRole('button').className
    rerender(<Button variant="ghost">A</Button>)
    expect(screen.getByRole('button').className).not.toBe(solid)
  })

  it('gives different tones different classes', () => {
    const { rerender } = render(<Button tone="action">A</Button>)
    const action = screen.getByRole('button').className
    rerender(<Button tone="danger">A</Button>)
    expect(screen.getByRole('button').className).not.toBe(action)
  })

  // ADR-0011 §3: this is the whole routing story. A real <a href> means
  // middle-click, right-click-copy-link and browser history all work, none of
  // which a click handler on a <button> can reproduce. @base-ui/react@1.7.0's
  // Button always advertises `role="button"` once `nativeButton` is false
  // (verified directly against BaseButton) *unless* the wrapper overrides it
  // — which Button.tsx now does for exactly this case (a literal `<a href>`
  // render element). So this queries by role "link", not "button": querying
  // "button" here would mean the fix regressed and Base UI's forced role is
  // back.
  it('becomes a real anchor through render, keeping its classes', () => {
    render(
      <Button render={<a href="/employees/42" />} variant="ghost">
        View
      </Button>,
    )
    const el = screen.getByRole('link', { name: 'View' })
    expect(el.tagName).toBe('A')
    expect(el.getAttribute('href')).toBe('/employees/42')
    expect(el.className).not.toBe('')
  })

  it('does not tell Base UI an anchor is a native button', () => {
    // Verified (against BaseButton directly, outside this component) that
    // when `render` supplies an element, `type`/`role` come only from
    // nativeButton, never from a tag-string default: nativeButton=true on
    // this same `<a href="/x" />` produces `type="button"` on the anchor;
    // nativeButton=false produces no `type` at all. So the absence of
    // `type` here is a real, nativeButton-gated signal, not an assertion
    // that would pass no matter what — perturbing deriveNativeButton to
    // return `true` unconditionally makes this test fail (the element
    // gains `type="button"`).
    render(<Button render={<a href="/x" />}>View</Button>)
    const el = screen.getByRole('link', { name: 'View' })
    expect(el.tagName).toBe('A')
    expect(el.hasAttribute('type')).toBe(false)
  })

  // WCAG 4.1.2 (name, role, value): a `<Button render={<a href>}>` must be
  // announced as a link, since it navigates like one (middle-click,
  // right-click-copy-link, browser history) rather than triggering an
  // in-page action. Base UI forces `role="button"` and `tabIndex={0}` on any
  // non-native-button element — correct for a genuinely-a-button element
  // rendered as another tag, wrong for a real link. Button.tsx detects the
  // literal anchor-with-href case and suppresses both.
  it('gives an anchor render element the implicit link role and no redundant tabindex', () => {
    render(<Button render={<a href="/x" />}>View</Button>)
    const el = screen.getByRole('link', { name: 'View' })
    expect(el.tagName).toBe('A')
    expect(el.hasAttribute('role')).toBe(false)
    expect(el.hasAttribute('tabindex')).toBe(false)
  })

  // ADR-0011 §3's own canonical example uses a router `<Link>`, not a
  // literal `<a>` — the tag-only detection this replaces would still emit
  // `role="button"` here, because `<Link>` is opaque and its rendered tag
  // is unknowable ahead of render. Detection now keys off `render.props`
  // (a non-empty `to`, here) instead, so this must resolve to the `link`
  // role with no `role`/`tabindex` attributes, exactly like a literal
  // anchor. `getByRole('link', …)` is the real proof: if the fix regressed
  // to tag-only detection, this element would carry `role="button"` and no
  // `link` role would exist to find.
  it('gives a Link-style render element (to prop) the implicit link role, no override needed', () => {
    render(<Button render={<FakeLink to="/x" />}>View</Button>)
    const el = screen.getByRole('link', { name: 'View' })
    expect(el.tagName).toBe('A')
    expect(el.hasAttribute('role') && el.getAttribute('role') !== 'link').toBe(false)
    expect(el.hasAttribute('tabindex')).toBe(false)
    expect(el.getAttribute('href')).toBe('/x')
  })

  // The counterpart to the anchor case: Base UI's forced role/tabindex is
  // *right* for a render element that is genuinely a button wearing a
  // different tag (no href, no native interactivity of its own). Button.tsx
  // must not suppress the override for this case.
  it('keeps Base UI role="button" and tabindex="0" for a non-anchor render element', () => {
    render(<Button render={<span />}>View</Button>)
    const el = screen.getByRole('button', { name: 'View' })
    expect(el.tagName).toBe('SPAN')
    expect(el.getAttribute('role')).toBe('button')
    expect(el.getAttribute('tabindex')).toBe('0')
  })

  it('keeps native button semantics when render is itself a button', () => {
    render(<Button render={<button data-x="1" />}>Save</Button>)
    const el = screen.getByRole('button', { name: 'Save' })
    expect(el.tagName).toBe('BUTTON')
    expect(el.getAttribute('data-x')).toBe('1')
    // Unlike the render-absent default case above, this path goes through
    // React.cloneElement, not Base UI's renderTag default, so `type` here
    // is NOT applied unconditionally — it only appears because nativeButton
    // was correctly derived true for a `render={<button />}` element.
    // Verified: forcing deriveNativeButton's button-element branch to
    // return false makes this assertion fail (`type` comes back null).
    expect(el.getAttribute('type')).toBe('button')
  })

  it('forwards a ref to the rendered element', () => {
    let node: HTMLElement | null = null
    render(
      <Button
        ref={(n) => {
          node = n
        }}
      >
        Save
      </Button>,
    )
    expect(node).not.toBeNull()
    expect(node!.tagName).toBe('BUTTON')
  })

  it('preserves Base UI state attributes for styling', () => {
    render(<Button disabled>Save</Button>)
    expect(screen.getByRole('button').hasAttribute('data-disabled')).toBe(true)
  })

  it('spreads unknown props onto the root element', () => {
    render(
      <Button data-testid="x" aria-describedby="hint">
        Save
      </Button>,
    )
    const el = screen.getByTestId('x')
    expect(el.getAttribute('aria-describedby')).toBe('hint')
  })

  // F2: the navigation-render-element override must clear only Base UI's
  // *forced* role/tabIndex, never a value the consumer supplied themselves.
  // Before the fix, `{...rest}` was spread BEFORE the unconditional
  // `{ role: undefined, tabIndex: undefined }`, so a consumer's own `role`
  // (needed by every Tabs/menu-item/toolbar composite that pairs an explicit
  // ARIA role with a roving tabIndex — ADR-0011 §6) was silently dropped the
  // moment the render element was a navigation target.
  it('keeps a consumer-supplied role on a navigation render element', () => {
    render(
      <Button role="menuitem" render={<a href="/x" />}>
        View
      </Button>,
    )
    const el = screen.getByRole('menuitem', { name: 'View' })
    expect(el.tagName).toBe('A')
    expect(el.getAttribute('role')).toBe('menuitem')
  })

  it('keeps a consumer-supplied tabIndex on a navigation render element', () => {
    render(
      <Button tabIndex={-1} render={<a href="/x" />}>
        View
      </Button>,
    )
    const el = screen.getByRole('link', { name: 'View' })
    expect(el.getAttribute('tabindex')).toBe('-1')
  })

  it('still emits neither role nor tabindex on a plain navigation render element', () => {
    render(<Button render={<a href="/x" />}>View</Button>)
    const el = screen.getByRole('link', { name: 'View' })
    expect(el.hasAttribute('role')).toBe(false)
    expect(el.hasAttribute('tabindex')).toBe(false)
  })
})
