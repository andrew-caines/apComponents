import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Textarea } from './Textarea.js'

describe('Textarea under SSR', () => {
  it('runs with no DOM at all', () => {
    expect(typeof window).toBe('undefined')
  })

  it('server-renders a textarea carrying its name and default value', () => {
    const html = renderToString(<Textarea name="notes" defaultValue="hello" aria-label="Notes" />)
    expect(html).toContain('<textarea')
    expect(html).toContain('name="notes"')
    // A textarea's value is its child text, not an attribute.
    expect(html).toContain('hello')
    expect(html).not.toContain('<input')
  })

  it('server-renders rows, which the control does not type', () => {
    const html = renderToString(<Textarea rows={7} aria-label="Notes" />)
    expect(html).toContain('rows="7"')
  })
})
