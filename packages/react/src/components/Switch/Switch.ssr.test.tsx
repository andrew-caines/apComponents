import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Switch } from './Switch.js'

describe('Switch under SSR', () => {
  it('runs with no DOM at all', () => {
    expect(typeof window).toBe('undefined')
  })

  it('server-renders the hidden input carrying its name and value', () => {
    const html = renderToString(<Switch label="Notifications" name="notify" value="on" />)
    // Scoped to the <input> tag specifically, not the whole document — see
    // the note below on why a bare `toContain` is unsafe for short strings
    // like "value" here.
    const inputTag = html.match(/<input[^>]*>/)?.[0] ?? ''
    expect(inputTag).toContain('<input')
    expect(inputTag).toMatch(/\bname="notify"/)
    expect(inputTag).toMatch(/\bvalue="on"/)
  })

  // `role="switch"` and `aria-checked` are rendered unconditionally on the
  // root <span>, so this only proves they are PRESENT in server HTML — that
  // is exactly what the brief asks for, distinct from the differential
  // checked/unchecked assertion below.
  it('server-renders role="switch" with aria-checked present', () => {
    const html = renderToString(<Switch label="Notifications" />)
    expect(html).toContain('role="switch"')
    expect(html).toMatch(/aria-checked="(true|false)"/)
  })

  // Differential, and scoped to the <input> tag specifically: the attribute
  // NAME `aria-checked` itself contains the substring `checked`, and the
  // word `value` appears elsewhere in server HTML too (e.g. as part of other
  // attribute names) — see the review note on Checkbox's SSR test
  // (Checkbox.ssr.test.tsx) and Task 2's finding on `value`. A bare
  // `toContain('checked')` or `toContain('value')` against the whole
  // document is satisfied unconditionally and can never fail. Matching only
  // the `<input ...>` tag, and requiring the marker in the defaultChecked
  // case AND its absence in the plain case, is what makes this provably
  // fail if `defaultChecked`/`value` stop reaching the native input.
  it('server-renders checked on the input when defaultChecked is set, and not otherwise', () => {
    const checkedHtml = renderToString(
      <Switch label="Notifications" name="notify" value="on" defaultChecked />,
    )
    const uncheckedHtml = renderToString(
      <Switch label="Notifications" name="notify" value="on" />,
    )
    const checkedInputTag = checkedHtml.match(/<input[^>]*>/)?.[0] ?? ''
    const uncheckedInputTag = uncheckedHtml.match(/<input[^>]*>/)?.[0] ?? ''
    expect(checkedInputTag).toMatch(/\bchecked=/)
    expect(uncheckedInputTag).not.toMatch(/\bchecked=/)
  })

  it('server-renders aria-checked="true" only once defaultChecked is set', () => {
    const checkedHtml = renderToString(<Switch label="Notifications" defaultChecked />)
    const uncheckedHtml = renderToString(<Switch label="Notifications" />)
    expect(checkedHtml).toContain('aria-checked="true"')
    expect(uncheckedHtml).toContain('aria-checked="false"')
  })
})
