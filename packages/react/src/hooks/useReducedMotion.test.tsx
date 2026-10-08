// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { useReducedMotion } from './useReducedMotion.js'

function Probe() {
  return <span>{String(useReducedMotion())}</span>
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>)['matchMedia']
})

describe('useReducedMotion', () => {
  it('queries exactly the reduce preference and reflects its match', () => {
    const queries: string[] = []
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => {
        queries.push(query)
        return { matches: true, addEventListener() {}, removeEventListener() {} }
      },
    })
    const { container } = render(<Probe />)
    expect(container.textContent).toBe('true')
    expect(new Set(queries)).toEqual(new Set(['(prefers-reduced-motion: reduce)']))
  })

  it('defaults to false on the server pass', () => {
    expect(renderToString(<Probe />)).toContain('false')
  })
})
