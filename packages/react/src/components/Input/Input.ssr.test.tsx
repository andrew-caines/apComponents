import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Input } from './Input.js'

describe('Input renders on the server', () => {
  it('runs with no browser globals present', () => {
    // Asserted first: without it the rest of this file could be silently
    // passing under jsdom and proving nothing about SSR.
    expect(typeof window).toBe('undefined')
    const html = renderToString(<Input name="email" defaultValue="a@b.c" aria-label="Email" />)
    expect(html).toContain('<input')
    expect(html).toContain('name="email"')
    // The value is in the markup, which is what makes a pre-hydration native
    // submit carry it (ADR-0011 §4).
    expect(html).toContain('value="a@b.c"')
  })

  it('does not emit the size variant as an HTML attribute on the server either', () => {
    const html = renderToString(<Input size="lg" aria-label="Email" />)
    expect(html).not.toContain('size="lg"')
  })
})
