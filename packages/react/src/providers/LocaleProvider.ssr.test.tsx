// Deliberately no environment docblock comment at the top of this file:
// this must run in Vitest's default node environment, with no jsdom
// present, so it actually proves LocaleProvider can render to a string
// without touching `window`/`document`. Under jsdom those globals exist and
// this assertion would pass even if the provider referenced them at module
// scope or during render.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LocaleProvider, useMessages } from './LocaleProvider.js'

function Probe() {
  const messages = useMessages()
  return <span>{messages.close}</span>
}

describe('LocaleProvider SSR', () => {
  it('renders to a string on the server without touching browser globals', () => {
    expect(typeof window).toBe('undefined')

    const html = renderToString(
      <LocaleProvider locale="de-DE" messages={{ close: 'Schließen' }}>
        <Probe />
      </LocaleProvider>,
    )

    expect(html).toContain('Schließen')
  })
})
