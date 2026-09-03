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

describe('Input adornments render on the server', () => {
  it('emits the decorative icon and the actionable button in the server markup', () => {
    expect(typeof window).toBe('undefined')
    const html = renderToString(
      <Input
        aria-label="Amount"
        name="amount"
        startIcon={{ icon: <span>€</span> }}
        endIcon={{ icon: <span>x</span>, onClick: () => {}, label: 'Clear amount' }}
      />,
    )
    expect(html).toContain('€')
    // The button is server-rendered with its name and its type, so it is
    // labelled and non-submitting before any JavaScript has run — the handler
    // is the only part that waits for hydration.
    expect(html).toContain('type="button"')
    expect(html).toContain('aria-label="Clear amount"')
    expect(html).toContain('aria-hidden="true"')
  })

  it('emits no wrapper element when there is no adornment', () => {
    const html = renderToString(<Input aria-label="Amount" name="amount" />)
    expect(html.startsWith('<input')).toBe(true)
    expect(html).not.toContain('<span')
  })
})
