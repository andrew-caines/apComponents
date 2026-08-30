// @vitest-environment jsdom
import { createRef } from 'react'
import { renderToString } from 'react-dom/server'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Surface } from './Surface.js'

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

  it('merges className rather than replacing the recipe class', () => {
    render(<Surface className="mine">z</Surface>)
    const el = screen.getByText('z')
    expect(el.classList.contains('mine')).toBe(true)
    expect(el.classList.length).toBeGreaterThan(1)
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

  it('renders to a string on the server without touching browser globals', () => {
    const html = renderToString(<Surface tone="canvas">ssr</Surface>)
    expect(html).toContain('ssr')
    expect(html).toContain('data-ap-tone="canvas"')
  })
})
