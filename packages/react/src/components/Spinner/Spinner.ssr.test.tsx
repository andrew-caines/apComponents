import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Spinner } from './Spinner.js'

describe('Spinner renders on the server', () => {
  it('runs with no browser globals present', () => {
    expect(typeof window).toBe('undefined')
    const html = renderToString(<Spinner />)
    expect(html).toContain('<svg')
    expect(html).toContain('aria-hidden="true"')
    // The animation is CSS, so a server-rendered spinner is already spinning
    // before any JavaScript arrives.
    expect(html).toContain('<circle')
  })
})
