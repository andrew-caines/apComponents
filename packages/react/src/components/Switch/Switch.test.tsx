// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from './Switch.js'

describe('Switch', () => {
  it('exposes the switch role with its label as the accessible name', () => {
    render(<Switch label="Notifications" />)
    expect(screen.getByRole('switch', { name: 'Notifications' })).toBeTruthy()
  })

  it('reports aria-checked as true/false, never mixed — a switch has no third state', () => {
    render(<Switch label="Notifications" />)
    const sw = screen.getByRole('switch')
    expect(sw.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(sw)
    expect(sw.getAttribute('aria-checked')).toBe('true')
    expect(sw.getAttribute('aria-checked')).not.toBe('mixed')
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
})
