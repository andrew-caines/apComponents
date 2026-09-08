import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Checkbox } from './Checkbox.js'

describe('Checkbox under SSR', () => {
  it('runs with no DOM at all', () => {
    expect(typeof window).toBe('undefined')
  })

  it('server-renders the hidden input carrying its name and value', () => {
    const html = renderToString(<Checkbox label="Email me" name="email" value="yes" />)
    expect(html).toContain('<input')
    expect(html).toContain('name="email"')
    expect(html).toContain('value="yes"')
  })

  it('server-renders checked on the input when defaultChecked is set, and not otherwise', () => {
    // Differential, and scoped to the <input> tag specifically: `aria-checked`
    // is rendered on the root <span> on every render regardless of state
    // (CheckboxRoot.js), and the attribute NAME `aria-checked` itself
    // contains the substring `checked` — so a bare `toContain('checked')`
    // is satisfied even with no `defaultChecked` at all and can never fail.
    // Matching only the `<input ...>` tag, and requiring the marker in the
    // defaultChecked case AND its absence in the plain case, is what makes
    // this provably fail if `defaultChecked` stops reaching the native input.
    const checkedHtml = renderToString(
      <Checkbox label="Email me" name="email" value="yes" defaultChecked />,
    )
    const uncheckedHtml = renderToString(<Checkbox label="Email me" name="email" value="yes" />)
    const checkedInputTag = checkedHtml.match(/<input[^>]*>/)?.[0] ?? ''
    const uncheckedInputTag = uncheckedHtml.match(/<input[^>]*>/)?.[0] ?? ''
    expect(checkedInputTag).toMatch(/\bchecked=/)
    expect(uncheckedInputTag).not.toMatch(/\bchecked=/)
  })

  it('server-renders aria-checked="mixed" when indeterminate is set', () => {
    const html = renderToString(<Checkbox label="All" indeterminate />)
    expect(html).toContain('aria-checked="mixed"')
  })

  // NOT asserted: `input.indeterminate`. Base UI sets that imperatively, in a
  // layout effect (CheckboxRoot.js: `inputRef.current.indeterminate =
  // computedIndeterminate`), never as a DOM attribute — `indeterminate` has
  // no HTML attribute reflection at all, only the IDL property. So it is
  // absent from server HTML by design, not by bug: the mixed state is
  // conveyed to the server-rendered markup entirely through
  // `aria-checked="mixed"` above, and the input's own `.indeterminate` flag
  // is set once the layout effect runs on the client after hydration.
})
