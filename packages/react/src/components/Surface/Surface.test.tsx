// @vitest-environment jsdom
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Surface } from './Surface.js'
import { surfaceRecipe } from './Surface.css.js'

describe('Surface', () => {
  it('renders its children in a div', () => {
    render(<Surface>hello</Surface>)
    expect(screen.getByText('hello').tagName).toBe('DIV')
  })

  it('exposes tone and pad as data attributes for styling hooks', () => {
    render(
      <Surface tone="raised" pad="lg">
        x
      </Surface>,
    )
    const el = screen.getByText('x')
    expect(el.getAttribute('data-ap-tone')).toBe('raised')
    expect(el.getAttribute('data-ap-pad')).toBe('lg')
  })

  it('defaults to tone=surface and pad=md', () => {
    render(<Surface>y</Surface>)
    const el = screen.getByText('y')
    expect(el.getAttribute('data-ap-tone')).toBe('surface')
    expect(el.getAttribute('data-ap-pad')).toBe('md')
  })

  it("surfaceRecipe's own defaults match the component's defaults", () => {
    // Surface.tsx resolves tone/pad via JS default parameters before ever
    // calling surfaceRecipe, so the recipe's defaultVariants never fire
    // through the component. surfaceRecipe is exported for direct use
    // though, so its own no-arg defaults are a separate contract that must
    // stay in sync with the component's defaults, not just look similar.
    expect(surfaceRecipe()).toBe(surfaceRecipe({ tone: 'surface', pad: 'md' }))

    render(<Surface>defaults</Surface>)
    const el = screen.getByText('defaults')
    expect(el.className).toBe(surfaceRecipe())
  })

  it('merges className rather than replacing the recipe class', () => {
    const { unmount } = render(<Surface>bare</Surface>)
    const bareClasses = screen.getByText('bare').className
    unmount()

    render(<Surface className="mine">z</Surface>)
    const el = screen.getByText('z')
    expect(el.classList.contains('mine')).toBe(true)
    expect(el.className).toBe(`${bareClasses} mine`)
  })

  it('forwards refs and spreads unknown props', () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <Surface ref={ref} id="s1" aria-label="panel">
        w
      </Surface>,
    )
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(ref.current?.id).toBe('s1')
    expect(ref.current?.getAttribute('aria-label')).toBe('panel')
  })

  it('keeps its own data-ap-tone in sync with the applied variant even if a caller spreads a conflicting one', () => {
    render(
      <Surface tone="raised" {...({ 'data-ap-tone': 'canvas' } as object)}>
        v
      </Surface>,
    )
    const el = screen.getByText('v')
    expect(el.getAttribute('data-ap-tone')).toBe('raised')
  })
})
