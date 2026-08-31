// Deliberately no environment docblock comment at the top of this file:
// this must run in Vitest's default node environment, with no jsdom
// present, so it actually proves Surface can render to a string without
// touching `window`/`document`. Under jsdom those globals exist and this
// assertion would pass even if Surface referenced them at module scope or
// during render.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Surface } from './Surface.js'

describe('Surface SSR', () => {
  it('renders to a string on the server without touching browser globals', () => {
    const html = renderToString(<Surface tone="canvas">ssr</Surface>)
    expect(html).toContain('ssr')
    expect(html).toContain('data-ap-tone="canvas"')
  })
})
