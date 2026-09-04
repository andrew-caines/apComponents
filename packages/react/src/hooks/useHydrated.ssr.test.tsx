// Deliberately no environment docblock at the top of this file: this must
// run in Vitest's default node environment, with no jsdom present, so it
// actually proves the hook produces server-safe output with no window or
// document available. Under jsdom this proof would be worthless — those
// globals would exist regardless of what the hook returns.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { useHydrated } from './useHydrated.js'

function Probe() {
  return <span>{String(useHydrated())}</span>
}

describe('useHydrated (server)', () => {
  it('renders false when rendered to a string on the server', () => {
    // F8: the file-level comment says this must run under node, but nothing
    // asserted it — the test passed identically under jsdom, where `window`
    // exists and the proof is worthless. Assert the environment directly.
    expect(typeof window).toBe('undefined')
    const html = renderToString(<Probe />)
    expect(html).toContain('false')
  })
})
