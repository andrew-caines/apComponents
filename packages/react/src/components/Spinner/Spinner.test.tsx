// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Spinner } from './Spinner.js'
import { spinnerClass } from './Spinner.css.js'

describe('Spinner', () => {
  it('is decorative by default', () => {
    const { container } = render(<Spinner />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('role')).toBeNull()
  })

  it('takes an accessible name when it is the only indication', () => {
    render(<Spinner label="Checking availability" />)
    const svg = screen.getByRole('img', { name: 'Checking availability' })
    // Named and hidden at once would be a contradiction — assert it never is.
    expect(svg.getAttribute('aria-hidden')).toBeNull()
  })

  it('carries the animation class, so reduced motion is handled at the token layer', () => {
    const { container } = render(<Spinner />)
    expect(container.querySelector('svg')!.className.baseVal).toContain(spinnerClass)
  })

  it('sizes through style, not through width/height attributes', () => {
    // A `var()` cannot resolve in a presentation attribute — see Icon.tsx.
    const { container } = render(<Spinner />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBeNull()
    expect(svg.style.width).not.toBe('')
  })

  it('accepts a numeric size as a pixel escape hatch', () => {
    const { container } = render(<Spinner size={32} />)
    expect(container.querySelector('svg')!.style.width).toBe('32px')
  })

  it('draws an open arc, or the rotation would be invisible', () => {
    const { container } = render(<Spinner />)
    const circle = container.querySelector('circle')!
    expect(circle.getAttribute('stroke-dasharray')).not.toBeNull()
    expect(circle.getAttribute('stroke')).toBe('currentColor')
  })

  it('merges className rather than replacing it', () => {
    const { container } = render(<Spinner className="mine" />)
    const cls = container.querySelector('svg')!.className.baseVal
    expect(cls).toContain('mine')
    expect(cls.trim().split(/\s+/).length).toBeGreaterThan(1)
  })
})
