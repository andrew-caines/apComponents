// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox } from './Checkbox.js'
import { checkboxIndeterminateBar } from './Checkbox.css.js'

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
})
