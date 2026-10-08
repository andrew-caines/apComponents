// Deliberately no environment docblock: this runs in the node environment so
// the server pass really has no window.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { useMediaQuery } from './useMediaQuery.js'

function Probe({ ssrDefault }: { ssrDefault: boolean }) {
  return <span>{String(useMediaQuery('(min-width: 1px)', ssrDefault))}</span>
}

describe('useMediaQuery (server)', () => {
  it('renders ssrDefault for both true and false', () => {
    expect(typeof window).toBe('undefined')
    expect(renderToString(<Probe ssrDefault={true} />)).toContain('true')
    expect(renderToString(<Probe ssrDefault={false} />)).toContain('false')
  })
})
