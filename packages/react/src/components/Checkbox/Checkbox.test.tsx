// @vitest-environment jsdom
import { createRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox } from './Checkbox.js'
import { checkboxIndeterminateBar, checkboxRecipe } from './Checkbox.css.js'

describe('Checkbox', () => {
  it('exposes the checkbox role with its label as the accessible name', () => {
    render(<Checkbox label="Email me" />)
    expect(screen.getByRole('checkbox', { name: 'Email me' })).toBeTruthy()
  })

  it('renders a real hidden input, which is what a form posts', () => {
    const { container } = render(<Checkbox label="Email me" name="email" value="yes" />)
    const input = container.querySelector('input[type="checkbox"]')!
    expect(input).toBeTruthy()
    // `.getAttribute`, not a jest-dom matcher — this repo does not install one
    // (see the same note in Input.test.tsx / Textarea.test.tsx).
    expect(input.getAttribute('name')).toBe('email')
    expect(input.getAttribute('value')).toBe('yes')
  })

  it('reports indeterminate as mixed rather than as a third checked value', () => {
    render(<Checkbox label="All" indeterminate />)
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('mixed')
  })

  it('submits uncontrolled when checked by default', () => {
    const seen = vi.fn()
    const { container } = render(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          seen(new FormData(e.currentTarget).get('email'))
        }}
      >
        <Checkbox label="Email me" name="email" value="yes" defaultChecked />
      </form>,
    )
    fireEvent.submit(container.querySelector('form')!)
    expect(seen).toHaveBeenCalledWith('yes')
  })

  it('toggles on click and reports the new state', () => {
    render(<Checkbox label="Email me" />)
    const box = screen.getByRole('checkbox')
    expect(box.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(box)
    expect(box.getAttribute('aria-checked')).toBe('true')
  })

  it('shows a check glyph rather than relying on colour alone', () => {
    const { container } = render(<Checkbox label="Email me" defaultChecked />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  // Base UI's CheckboxIndicator mounts when `checked || indeterminate`
  // (CheckboxIndicator.js:31) — so an indicator that unconditionally renders
  // the check glyph gives an INDETERMINATE box a tick too. The indeterminate
  // state must read as its own distinct state, not as "checked with extra
  // steps", so the check glyph must not appear here — only the bar that
  // signals "mixed" without relying on colour (ADR-0011 §5).
  it('does not show the check glyph while indeterminate, only the mixed-state bar', () => {
    const { container } = render(<Checkbox label="All" indeterminate />)
    expect(container.querySelector('svg')).toBeFalsy()
    expect(container.getElementsByClassName(checkboxIndeterminateBar).length).toBe(1)
  })

  // The whole point of the wrapping `<label>` is that the TEXT is clickable,
  // and it has a plausible double-toggle failure mode: the click lands on the
  // label, the browser forwards it to the hidden input natively, AND the click
  // also bubbles to `Checkbox.Root`. If both paths toggled, the control would
  // land back where it started and look inert. Base UI prevents that today —
  // the hidden input's own `onClick` calls `stopPropagation()` and the root's
  // calls `preventDefault()` (CheckboxRoot.js) — but that is an
  // implementation detail of a dependency this branch depends on and did not
  // pin, so this pins the OBSERVABLE behaviour instead. Asserting the state
  // actually flipped is what catches a double toggle: a net-zero pair leaves
  // `aria-checked` at 'false'.
  it('toggles once, not twice, when the label text is clicked', () => {
    render(<Checkbox label="Email me" />)
    const box = screen.getByRole('checkbox')
    const text = screen.getByText('Email me')
    expect(text).not.toBe(box)
    expect(box.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(text)
    expect(box.getAttribute('aria-checked')).toBe('true')
    // And back again, so this cannot pass for a control that latches on.
    fireEvent.click(text)
    expect(box.getAttribute('aria-checked')).toBe('false')
  })

  // Tied to the recipe's own output rather than a bare "className is
  // non-empty" check, matching Input.test.tsx:19-37: a non-empty check passes
  // for a class from the wrong variant, so it could not catch a default being
  // changed. Nothing asserted `size` at all before — it shipped as an
  // untested variant prop.
  it('applies the recipe class for the default size, on the box', () => {
    render(<Checkbox label="Email me" />)
    expect(screen.getByRole('checkbox').className).toBe(checkboxRecipe({ size: 'md' }))
  })

  it('gives different sizes different classes', () => {
    const { rerender } = render(<Checkbox label="Email me" size="sm" />)
    const sm = screen.getByRole('checkbox').className
    rerender(<Checkbox label="Email me" size="lg" />)
    expect(screen.getByRole('checkbox').className).not.toBe(sm)
  })

  // `size` on our API is a recipe variant, not an HTML attribute. Leaking
  // `size="lg"` onto any of the three elements would be invalid HTML — same
  // assertion, same reason, as Input.test.tsx:42-45.
  it('does not leak the size variant onto the DOM as an attribute', () => {
    const { container } = render(<Checkbox label="Email me" size="lg" />)
    expect(screen.getByRole('checkbox').hasAttribute('size')).toBe(false)
    expect(container.querySelector('label')!.hasAttribute('size')).toBe(false)
    expect(container.querySelector('input[type="checkbox"]')!.hasAttribute('size')).toBe(false)
  })

  it('merges a consumer className onto the label row rather than replacing it', () => {
    const { container } = render(<Checkbox label="Email me" className="mine" />)
    const row = container.querySelector('label')!
    expect(row.classList.contains('mine')).toBe(true)
    expect(row.className.trim().split(/\s+/).length).toBeGreaterThan(1)
  })

  /**
   * This component renders two boxes a caller could plausibly mean — the
   * `<label>` row and the inner `<span role="checkbox">` — so "which box does
   * this prop land on" is a real question with a real wrong answer, and the
   * wrong answer shipped: `className` and `style` went to the inner box while
   * the `<label>` that carries the row layout was unreachable. Nothing caught
   * it, because there was no className test at all and a className test only
   * ever looks at className.
   *
   * Both halves of the documented split are asserted here, and both
   * DIFFERENTIALLY — the presentation props are on the label AND not on the
   * control, the passthrough is on the control AND not on the label. A
   * one-sided assertion would still pass if a prop were applied to both.
   * Same shape as `RadioGroupParts.test.tsx`'s equivalent test.
   */
  describe('props land on the elements this component documents', () => {
    it('puts className, style and ref on the label, and everything else on Checkbox.Root', () => {
      const ref = createRef<HTMLLabelElement>()
      const { container } = render(
        <Checkbox
          label="Email me"
          ref={ref}
          className="mine"
          style={{ marginBlockStart: '8px' }}
          id="my-checkbox"
          data-passthrough="control"
        />,
      )
      const row = container.querySelector('label')!
      const box = screen.getByRole('checkbox')
      const input = container.querySelector('input[type="checkbox"]')!
      // Sanity: three genuinely different elements, so none of the "and not
      // on the other one" assertions can pass by comparing an element with
      // itself.
      expect(new Set([row, box, input]).size).toBe(3)

      expect(row.classList.contains('mine')).toBe(true)
      expect(row.style.marginBlockStart).toBe('8px')
      expect(ref.current).toBe(row)
      expect(box.classList.contains('mine')).toBe(false)
      expect(box.style.marginBlockStart).toBe('')

      expect(box.getAttribute('data-passthrough')).toBe('control')
      expect(row.hasAttribute('data-passthrough')).toBe(false)
      // `id` routes to the hidden input, which is what Base UI registers as
      // the control's identity (`useLabelableId`) — not to the label and not
      // to the styled span.
      expect(input.id).toBe('my-checkbox')
      // The label DOES end up with an id, and it is not ours: Base UI's
      // `useAriaLabelledBy` finds the wrapping `<label>` and, only when it has
      // no id of its own, assigns `${controlId}-label` to it imperatively
      // inside a layout effect (`internals/labelable-provider/useAriaLabelledBy.js`
      // — `if (!label.id && generatedLabelId) { label.id = generatedLabelId }`),
      // so the control's `aria-labelledby` has something to point at. Pinned
      // here because it is easy to mistake for our `id` having leaked onto the
      // wrong element, and because it is the mechanism the accessible name
      // rests on.
      expect(row.id).toBe('my-checkbox-label')
      expect(box.getAttribute('aria-labelledby')).toBe(row.id)
    })

    // `ref` travels to a plain host `<label>`, so nothing here is a cast —
    // but the ref TARGET is the contract, and only a ref that receives a real
    // node and reports its `tagName` can catch it pointing at the wrong
    // element. A bare `not.toBeNull()` would pass for a ref on the box.
    it('forwards its ref to the label row, which is the element it renders at its root', () => {
      const ref = createRef<HTMLLabelElement>()
      render(<Checkbox label="Email me" ref={ref} />)
      expect(ref.current).not.toBeNull()
      expect(ref.current?.tagName).toBe('LABEL')
      // And it is the ROW, not some other label: the control lives inside it.
      expect(ref.current?.querySelector('[role="checkbox"]')).not.toBeNull()
    })

    // Base UI's own escape hatch to the element a form actually posts, and
    // proof the rest of the props reach `Checkbox.Root` untouched.
    it('forwards inputRef to the hidden input, which is what a form posts', () => {
      const ref = createRef<HTMLInputElement>()
      render(<Checkbox label="Email me" name="email" inputRef={ref} />)
      expect(ref.current).not.toBeNull()
      expect(ref.current?.tagName).toBe('INPUT')
      expect(ref.current?.type).toBe('checkbox')
      expect(ref.current?.name).toBe('email')
    })
  })
})
