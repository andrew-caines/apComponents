import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Button } from './Button.js'

describe('Button renders on the server', () => {
  it('runs with no browser globals present', () => {
    // Asserted first: without it the rest of this file could be silently
    // passing under jsdom and proving nothing about SSR.
    expect(typeof window).toBe('undefined')
    const html = renderToString(<Button>Save</Button>)
    expect(html).toContain('<button')
    expect(html).toContain('Save')
  })

  it('renders an anchor through render on the server too', () => {
    const html = renderToString(<Button render={<a href="/x" />}>View</Button>)
    expect(html).toContain('<a')
    expect(html).toContain('href="/x"')
  })
})
