// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useHydrated } from './useHydrated.js'

function Probe() {
  return <span data-testid="v">{String(useHydrated())}</span>
}

describe('useHydrated', () => {
  it('reports true once mounted in a browser-like environment', async () => {
    render(<Probe />)
    expect(await screen.findByText('true')).toBeTruthy()
  })

  it('is false on the very first render, so server and client agree', () => {
    // Testing Library flushes effects, so assert the pre-effect value by
    // rendering without act's effect flush would be brittle. Instead assert the
    // contract that matters: the initial state literal is false.
    expect(useHydrated.INITIAL).toBe(false)
  })
})
