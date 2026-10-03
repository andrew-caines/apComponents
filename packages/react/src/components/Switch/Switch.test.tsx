// @vitest-environment jsdom
import { createRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FieldRoot } from '../Field/FieldParts.js'
import { Switch, SWITCH_TOKENS } from './Switch.js'
import { switchTrackRecipe } from './Switch.css.js'

describe('Switch', () => {
  it('exposes the switch role with its label as the accessible name', () => {
    render(<Switch label="Notifications" />)
    expect(screen.getByRole('switch', { name: 'Notifications' })).toBeTruthy()
  })

  it('reports aria-checked as true/false — a switch has no third state', () => {
    render(<Switch label="Notifications" />)
    const sw = screen.getByRole('switch')
    expect(sw.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(sw)
    expect(sw.getAttribute('aria-checked')).toBe('true')
  })

  // The runtime half of "never mixed" was previously written as
  // `expect(...).not.toBe('mixed')` one line after asserting the same value IS
  // 'true' — an assertion that cannot fail, so it asserted nothing. The claim
  // it was reaching for is a TYPE claim, and this is the only kind of test
  // that can make it: `Checkbox` reaches `aria-checked="mixed"` through its
  // `indeterminate` prop, and a `Switch` has no such prop to reach it with.
  // If one is ever added — by widening the props or by Base UI adding it to
  // `SwitchRootProps` — `@ts-expect-error` becomes an unused suppression and
  // `npm run typecheck` fails on THIS line, which is exactly the alarm we
  // want. Same mechanism as Input.test.tsx:188.
  it('has no prop that could ask for a third state, at compile time', () => {
    render(
      <Switch
        label="Notifications"
        // @ts-expect-error a switch has no mixed state, so no `indeterminate`
        indeterminate
      />,
    )
    // The switch still renders; the point of this test is the type error
    // above. Asserted at runtime too, so the two agree.
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false')
  })

  it('renders a real hidden input, which is what a form posts', () => {
    const { container } = render(<Switch label="Notifications" name="notify" value="on" />)
    const input = container.querySelector('input[type="checkbox"]')!
    expect(input).toBeTruthy()
    // `.getAttribute`, not a jest-dom matcher — this repo does not install one
    // (see the same note in Input.test.tsx / Checkbox.test.tsx).
    expect(input.getAttribute('name')).toBe('notify')
    expect(input.getAttribute('value')).toBe('on')
  })

  it('submits uncontrolled when checked by default', () => {
    const seen = vi.fn()
    const { container } = render(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          seen(new FormData(e.currentTarget).get('notify'))
        }}
      >
        <Switch label="Notifications" name="notify" value="on" defaultChecked />
      </form>,
    )
    fireEvent.submit(container.querySelector('form')!)
    expect(seen).toHaveBeenCalledWith('on')
  })

  it('toggles on click and reports the new state', () => {
    render(<Switch label="Notifications" />)
    const sw = screen.getByRole('switch')
    expect(sw.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(sw)
    expect(sw.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(sw)
    expect(sw.getAttribute('aria-checked')).toBe('false')
  })

  it('renders a thumb element carrying data-checked when on', () => {
    render(<Switch label="Notifications" defaultChecked />)
    const sw = screen.getByRole('switch')
    const thumb = sw.querySelector('[data-checked]')
    expect(thumb).toBeTruthy()
  })

  it('does not put data-checked on the thumb when off', () => {
    render(<Switch label="Notifications" />)
    const sw = screen.getByRole('switch')
    const thumb = sw.querySelector('[data-unchecked]')
    expect(thumb).toBeTruthy()
    expect(sw.querySelector('[data-checked]')).toBeFalsy()
  })

  // The whole point of the wrapping `<label>` is that the TEXT is clickable,
  // and it has a plausible double-toggle failure mode: the click lands on the
  // label, the browser forwards it to the hidden input natively, AND the click
  // also bubbles to `Switch.Root`. If both paths toggled, the switch would
  // land back where it started and look inert. Base UI prevents that today
  // (the hidden input's `onClick` stops propagation and the root's calls
  // `preventDefault` — SwitchRoot.js), but that is an implementation detail of
  // a dependency this branch depends on and did not pin. Asserting the state
  // actually flipped is what catches a double toggle: a net-zero pair leaves
  // `aria-checked` at 'false'.
  it('toggles once, not twice, when the label text is clicked', () => {
    render(<Switch label="Notifications" />)
    const sw = screen.getByRole('switch')
    const text = screen.getByText('Notifications')
    expect(text).not.toBe(sw)
    expect(sw.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(text)
    expect(sw.getAttribute('aria-checked')).toBe('true')
    // And back again, so this cannot pass for a control that latches on.
    fireEvent.click(text)
    expect(sw.getAttribute('aria-checked')).toBe('false')
  })

  // Tied to the recipe's own output rather than a bare "className is
  // non-empty" check, matching Input.test.tsx:19-37. Nothing asserted `size`
  // at all before — it shipped as an untested variant prop.
  it('applies the track recipe class for the default size', () => {
    render(<Switch label="Notifications" />)
    expect(screen.getByRole('switch').className).toBe(switchTrackRecipe({ size: 'md' }))
  })

  it('gives different sizes different classes', () => {
    const { rerender } = render(<Switch label="Notifications" size="sm" />)
    const sm = screen.getByRole('switch').className
    rerender(<Switch label="Notifications" size="lg" />)
    expect(screen.getByRole('switch').className).not.toBe(sm)
  })

  // `size` on our API is a recipe variant, not an HTML attribute — same
  // assertion, same reason, as Input.test.tsx:42-45.
  it('does not leak the size variant onto the DOM as an attribute', () => {
    const { container } = render(<Switch label="Notifications" size="lg" />)
    expect(screen.getByRole('switch').hasAttribute('size')).toBe(false)
    expect(container.querySelector('label')!.hasAttribute('size')).toBe(false)
    expect(container.querySelector('input[type="checkbox"]')!.hasAttribute('size')).toBe(false)
  })

  // Switch gets no `invalid` prop of its own — invalidity reaches the track
  // ambiently through Base UI's Field context, the same mechanism `Input` and
  // `Checkbox` already rely on, so `data-invalid` was landing on the track
  // before task 8 (see the comment this test replaces in
  // `Switch.stories.tsx`'s `Invalid` story). What did NOT exist before task 8
  // is `SWITCH_TOKENS.borderInvalid` and `Switch.css.ts`'s `&[data-invalid]`
  // rule reading it (spec §4.1.10) — that assertion is the one that is RED
  // before the token exists and GREEN after. The recipe-class and
  // `data-invalid` checks stay in the same test, in `Checkbox.test.tsx`'s own
  // assertion style (recipe class identity, plain `hasAttribute`), and are
  // differential in both directions — matching `FieldParts.test.tsx`'s and
  // `RadioGroupParts.test.tsx`'s data-invalid tests — so this still fails if
  // the state ever stopped reaching the track at all.
  it('marks the track data-invalid inside an invalid Field, and carries the invalid role token', () => {
    const { rerender } = render(
      <FieldRoot invalid>
        <Switch label="Notifications" />
      </FieldRoot>,
    )
    const track = screen.getByRole('switch')
    expect(track.className).toBe(switchTrackRecipe({ size: 'md' }))
    expect(track.hasAttribute('data-invalid'), 'Switch.css.ts styles [data-invalid]').toBe(true)

    rerender(
      <FieldRoot>
        <Switch label="Notifications" />
      </FieldRoot>,
    )
    expect(screen.getByRole('switch').hasAttribute('data-invalid')).toBe(false)

    expect(
      SWITCH_TOKENS.borderInvalid,
      'spec §4.1.10 requires every control to carry a borderInvalid role',
    ).not.toBeUndefined()
  })

  it('merges a consumer className onto the label row rather than replacing it', () => {
    const { container } = render(<Switch label="Notifications" className="mine" />)
    const row = container.querySelector('label')!
    expect(row.classList.contains('mine')).toBe(true)
    expect(row.className.trim().split(/\s+/).length).toBeGreaterThan(1)
  })

  /**
   * The same split as `Checkbox`, asserted the same way and for the same
   * reason — see the longer note on `Checkbox.test.tsx`. Both halves are
   * differential: the presentation props are on the label AND not on the
   * track, the passthrough is on the track AND not on the label.
   */
  describe('props land on the elements this component documents', () => {
    it('puts className, style and ref on the label, and everything else on Switch.Root', () => {
      const ref = createRef<HTMLLabelElement>()
      const { container } = render(
        <Switch
          label="Notifications"
          ref={ref}
          className="mine"
          style={{ marginBlockStart: '8px' }}
          id="my-switch"
          data-passthrough="control"
        />,
      )
      const row = container.querySelector('label')!
      const track = screen.getByRole('switch')
      const input = container.querySelector('input[type="checkbox"]')!
      // Sanity: three genuinely different elements, so none of the "and not on
      // the other one" assertions can pass by comparing an element with itself.
      expect(new Set([row, track, input]).size).toBe(3)

      expect(row.classList.contains('mine')).toBe(true)
      expect(row.style.marginBlockStart).toBe('8px')
      expect(ref.current).toBe(row)
      expect(track.classList.contains('mine')).toBe(false)
      expect(track.style.marginBlockStart).toBe('')

      expect(track.getAttribute('data-passthrough')).toBe('control')
      expect(row.hasAttribute('data-passthrough')).toBe(false)
      expect(input.id).toBe('my-switch')
      // The label's own id is Base UI's, not ours — see the same assertion in
      // Checkbox.test.tsx for the mechanism.
      expect(row.id).toBe('my-switch-label')
      expect(track.getAttribute('aria-labelledby')).toBe(row.id)
    })

    // The ref TARGET is the contract, and only a ref that receives a real node
    // and reports its `tagName` can catch it pointing at the wrong element.
    it('forwards its ref to the label row, which is the element it renders at its root', () => {
      const ref = createRef<HTMLLabelElement>()
      render(<Switch label="Notifications" ref={ref} />)
      expect(ref.current).not.toBeNull()
      expect(ref.current?.tagName).toBe('LABEL')
      // And it is the ROW, not some other label: the track lives inside it.
      expect(ref.current?.querySelector('[role="switch"]')).not.toBeNull()
    })

    it('forwards inputRef to the hidden input, which is what a form posts', () => {
      const ref = createRef<HTMLInputElement>()
      render(<Switch label="Notifications" name="notify" inputRef={ref} />)
      expect(ref.current).not.toBeNull()
      expect(ref.current?.tagName).toBe('INPUT')
      expect(ref.current?.type).toBe('checkbox')
      expect(ref.current?.name).toBe('notify')
    })
  })
})
