/**
 * Runs in the `node` environment — NO jsdom. A test under jsdom cannot detect a
 * browser-global access, because the globals are all present. This file has no
 * `@vitest-environment` docblock precisely so it inherits the node default from
 * the root config.
 */
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ApProvider } from './ApProvider.js'
import { ThemeScript } from './ThemeScript.js'
import { Icon } from '../icons/index.js'
import { useMessages } from './LocaleProvider.js'

function Strings() {
  const m = useMessages()
  return <span>{m.close}</span>
}

describe('the provider stack renders on the server', () => {
  it('renders with no browser globals available', () => {
    expect(typeof window).toBe('undefined')
    const html = renderToString(
      <ApProvider locale="de-DE" messages={{ close: 'Schließen' }}>
        <Strings />
        <Icon name="check" />
      </ApProvider>,
    )
    expect(html).toContain('Schließen')
    expect(html).toContain('<svg')
  })

  it('sets no scheme attribute during server render, so CSS decides', () => {
    // ThemeProvider must not touch document during render; if it did, this
    // would throw rather than return markup.
    const html = renderToString(
      <ApProvider>
        <span>ok</span>
      </ApProvider>,
    )
    expect(html).toContain('ok')
  })

  it('ThemeScript serialises to an inline script with the storage key escaped', () => {
    const html = renderToString(<ThemeScript storageKey={'we"ird'} />)
    expect(html).toContain('<script')
    // The quote in the key must be escaped, or it breaks out of the literal.
    expect(html).not.toContain('"we"ird"')
  })
})
