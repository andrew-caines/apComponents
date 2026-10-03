import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Popover } from './Popover.js'

function ssr() {
  return renderToString(
    <Popover title="Filters" trigger={<button type="button">Open</button>}>
      body
    </Popover>,
  )
}

describe('Popover (convenience) under SSR', () => {
  it('runs with no DOM at all', () => {
    expect(typeof window).toBe('undefined')
  })

  // §4.1.9. Base UI's portal mounts client-side only, so `keepMounted` on it
  // still yields no server HTML (verified: the perturbation does not fail).
  // This is a regression guard: it catches a popup rendered outside the
  // portal, which Base UI rejects, failing the render.
  it('server-renders no dialog', () => {
    expect(ssr()).not.toContain('role="dialog"')
  })

  // Scoped to the trigger tag. Fails if the trigger loses its closed state.
  it('server-renders the trigger closed', () => {
    const tag = /<button[^>]*>/.exec(ssr())
    expect(tag).not.toBeNull()
    expect(tag![0]).toContain('aria-expanded="false"')
  })
})
