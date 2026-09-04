// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useHydrated } from './useHydrated.js'

// Record the value returned on every render pass (not just the final,
// post-effect DOM), so the first entry captures what the hook returned
// before any effect ran — the value that must match the server's render.
let seen: boolean[] = []

function Probe() {
  seen.push(useHydrated())
  return null
}

describe('useHydrated', () => {
  beforeEach(() => {
    seen = []
  })

  it('returns false on the first render and true after the hydration effect runs', () => {
    render(<Probe />)

    expect(
      seen[0],
      'the first render must return false — this is the render that has to match ' +
        "the server's output, and returning true here IS the hydration mismatch " +
        'this hook exists to prevent',
    ).toBe(false)

    expect(
      seen.at(-1),
      'after the hydration effect has flushed, the hook must have flipped to true',
    ).toBe(true)
  })
})
