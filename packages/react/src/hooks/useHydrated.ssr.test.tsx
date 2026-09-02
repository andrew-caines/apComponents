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
    const html = renderToString(<Probe />)
    expect(html).toContain('false')
  })
})
