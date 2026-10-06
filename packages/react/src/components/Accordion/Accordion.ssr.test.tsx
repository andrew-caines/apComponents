import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Accordion, type AccordionSection } from './Accordion.js'

const items: AccordionSection[] = [
  { value: 'a', title: 'Alpha', content: 'Alpha content' },
  { value: 'b', title: 'Beta', content: 'Beta content' },
]

describe('Accordion (convenience) under SSR', () => {
  it('runs with no DOM at all', () => {
    expect(typeof window).toBe('undefined')
  })

  // Fails if `hiddenUntilFound` is dropped: the closed content leaves the HTML.
  // Fails if the attribute were `until-found`: that is set client-side only
  // (`collapsible/panel/useCollapsiblePanel.js:270-280`, spec 4.5.1), so the
  // server emits the boolean form.
  it('server-renders closed content under a boolean hidden attribute', () => {
    const html = renderToString(<Accordion items={items} />)
    expect(html).toContain('Beta content')
    expect(html).toMatch(/<div[^>]*\bhidden=""[^>]*>/)
    expect(html).not.toContain('until-found')
  })

  // Fails if the default level changes from 3.
  it('renders headers as h3', () => {
    const html = renderToString(<Accordion items={items} />)
    expect(html).toContain('<h3')
    expect(html).not.toContain('<h2')
  })
})
