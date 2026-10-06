import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Tabs, type TabsItem } from './Tabs.js'

const items: TabsItem[] = [
  { value: 'a', label: 'Alpha', content: 'Alpha content' },
  { value: 'b', label: 'Beta', content: 'Beta content' },
]

describe('Tabs (convenience) under SSR', () => {
  it('runs with no DOM at all', () => {
    expect(typeof window).toBe('undefined')
  })

  // Fails if the selected panel is not rendered, or inactive panels are.
  it('server-renders the selected panel and not the others', () => {
    const html = renderToString(<Tabs aria-label="x" items={items} defaultValue="b" />)
    expect(html).toContain('Beta content')
    expect(html).not.toContain('Alpha content')
  })

  // Review Focus 1. Fails if no default is passed: Base UI's client-only
  // fallback leaves the panel out of the server HTML.
  it('server-renders the first enabled panel with no value or defaultValue', () => {
    const html = renderToString(
      <Tabs aria-label="x" items={[{ ...items[0]!, disabled: true }, items[1]!]} />,
    )
    expect(html).toContain('Beta content')
    expect(html).not.toContain('Alpha content')
  })

  // Fails if the indicator is given `renderBeforeHydration`, which injects an
  // inline script into the server HTML.
  it('emits no <script', () => {
    const html = renderToString(<Tabs aria-label="x" items={items} />)
    expect(html).not.toContain('<script')
  })
})
