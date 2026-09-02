// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './Button.js'
import { buttonRecipe } from './Button.css.js'

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
  // which a click handler on a <button> can reproduce. Those behaviours come
  // from the tag and the `href` attribute, not from the ARIA role — and
  // @base-ui/react@1.7.0's Button always advertises `role="button"` once
  // `nativeButton` is false (verified directly against BaseButton, not just
  // this wrapper), regardless of the underlying tag. So this queries by
  // role "button" (what the installed Base UI version actually produces),
  // not "link" — `getByRole('link', ...)` would find nothing here and the
  // test would fail for a reason unrelated to what it's trying to prove.
  it('becomes a real anchor through render, keeping its classes', () => {
    render(
      <Button render={<a href="/employees/42" />} variant="ghost">
        View
      </Button>,
    )
    const el = screen.getByRole('button', { name: 'View' })
    expect(el.tagName).toBe('A')
    expect(el.getAttribute('href')).toBe('/employees/42')
    expect(el.className).not.toBe('')
  })

  it('does not tell Base UI an anchor is a native button', () => {
    // Verified (against BaseButton directly, outside this component) that
    // when `render` supplies an element, `type`/`role` come only from
    // nativeButton, never from a tag-string default: nativeButton=true on
    // this same `<a href="/x" />` produces `type="button"` on the anchor;
    // nativeButton=false produces `role="button"` and no `type` at all. So
    // the absence of `type` here is a real, nativeButton-gated signal, not
    // an assertion that would pass no matter what — perturbing
    // deriveNativeButton to return `true` unconditionally makes this test
    // fail (role reverts to the anchor's implicit "link", and
    // getByRole('button', …) finds nothing).
    render(<Button render={<a href="/x" />}>View</Button>)
    const el = screen.getByRole('button', { name: 'View' })
    expect(el.tagName).toBe('A')
    expect(el.hasAttribute('type')).toBe(false)
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
})
