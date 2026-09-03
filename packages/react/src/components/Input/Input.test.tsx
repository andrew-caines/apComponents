// @vitest-environment jsdom
import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Input } from './Input.js'
import { inputRecipe } from './Input.css.js'

describe('Input', () => {
  it('renders a real <input>', () => {
    render(<Input aria-label="Email" />)
    const el = screen.getByRole('textbox', { name: 'Email' })
    expect(el.tagName).toBe('INPUT')
  })

  // Tied to the recipe's own output for the default size rather than a bare
  // "className is non-empty" check: a non-empty check passes for a class from
  // the wrong variant, so it could not catch a default being changed.
  it('applies the recipe class for the default size', () => {
    render(<Input aria-label="Email" />)
    expect(screen.getByRole('textbox').className).toBe(inputRecipe({ size: 'md' }))
  })

  it('merges className rather than replacing it', () => {
    render(<Input aria-label="Email" className="mine" />)
    const cls = screen.getByRole('textbox').className
    expect(cls).toContain('mine')
    expect(cls.trim().split(/\s+/).length).toBeGreaterThan(1)
  })

  it('gives different sizes different classes', () => {
    const { rerender } = render(<Input aria-label="Email" size="sm" />)
    const sm = screen.getByRole('textbox').className
    rerender(<Input aria-label="Email" size="lg" />)
    expect(screen.getByRole('textbox').className).not.toBe(sm)
  })

  // `size` on our API is a recipe variant, not the legacy HTML width-in-
  // characters attribute. Assert the attribute is NOT emitted: leaking
  // size="sm" onto the element would be invalid HTML and would silently
  // change the field's intrinsic width.
  it('does not leak the size variant onto the DOM as an attribute', () => {
    render(<Input aria-label="Email" size="lg" />)
    expect(screen.getByRole('textbox').hasAttribute('size')).toBe(false)
  })

  it('forwards a ref to the input element', () => {
    const ref = createRef<HTMLInputElement>()
    render(<Input aria-label="Email" ref={ref} />)
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe('INPUT')
  })

  it('spreads id, data-* and aria-* through to the element', () => {
    render(<Input aria-label="Email" id="email" data-testid="email-input" aria-describedby="hint" />)
    const el = screen.getByTestId('email-input')
    expect(el.id).toBe('email')
    expect(el.getAttribute('aria-describedby')).toBe('hint')
  })

  // The uncontrolled path is the one ADR-0011 §4 exists for: the value must
  // live in the DOM, so a native form submit carries it with no React state.
  it('submits its value from a native form with no React state (uncontrolled)', () => {
    const seen = vi.fn()
    const { container } = render(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          seen(new FormData(e.currentTarget).get('email'))
        }}
      >
        <Input aria-label="Email" name="email" defaultValue="a@b.c" />
        <button type="submit">Go</button>
      </form>,
    )
    // The value is read out of the DOM by FormData, not out of React state —
    // which is the whole claim: a browser submitting this form before any
    // JavaScript has hydrated carries the same value (ADR-0011 §4).
    fireEvent.submit(container.querySelector('form')!)
    expect(seen).toHaveBeenCalledWith('a@b.c')
  })

  it('reports changes through onValueChange when controlled', () => {
    const onValueChange = vi.fn()
    render(<Input aria-label="Email" value="" onValueChange={onValueChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x' } })
    expect(onValueChange).toHaveBeenCalled()
    expect(onValueChange.mock.calls[0]?.[0]).toBe('x')
  })
})
