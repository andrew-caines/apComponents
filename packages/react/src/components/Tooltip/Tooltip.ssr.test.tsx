import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Tooltip } from './Tooltip.js'

function ssr() {
  return renderToString(
    <Tooltip content="Delete">
      <button type="button" aria-label="Delete row" />
    </Tooltip>,
  )
}

describe('Tooltip (convenience) under SSR', () => {
  it('runs with no DOM at all', () => {
    expect(typeof window).toBe('undefined')
  })

  it('server-renders the trigger', () => {
    expect(ssr()).toContain('aria-label="Delete row"')
  })

  // §4.1.9. Base UI's portal mounts client-side only, so `keepMounted` on it
  // still yields no server HTML (verified: the perturbation does not fail).
  // What this does catch: a popup rendered outside the portal, which Base UI
  // rejects ("Tooltip.Portal is missing"), failing the render.
  it('server-renders no tooltip', () => {
    expect(ssr()).not.toContain('role="tooltip"')
  })

  // Scoped to the trigger tag. Fails if the description is added while closed.
  it('server-renders no aria-describedby on the trigger', () => {
    const tag = /<button[^>]*aria-label="Delete row"[^>]*>/.exec(ssr())
    expect(tag).not.toBeNull()
    expect(tag![0]).not.toContain('aria-describedby')
  })
})
