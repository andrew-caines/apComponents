import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Field } from './Field.js'
import { NON_NATIVE_LABEL } from './nonNativeLabel.js'
import { Input } from '../Input/Input.js'

// Same stand-in as Field.test.tsx (kept local rather than shared, as that
// file's own comment explains): an opaque function component carrying the
// protocol's marker, standing in for Select's trigger before Task 5 exists.
function Fake(props: { 'aria-labelledby'?: string }) {
  return <button {...props} />
}
Object.assign(Fake, { [NON_NATIVE_LABEL]: true })

describe('Field renders on the server', () => {
  it('runs with no browser globals present', () => {
    expect(typeof window).toBe('undefined')
    const html = renderToString(
      <Field label="Email" hint="We never share this.">
        <Input name="email" defaultValue="a@b.c" />
      </Field>,
    )
    expect(html).toContain('<label')
    expect(html).toContain('Email')
    expect(html).toContain('<input')
    expect(html).toContain('name="email"')
    expect(html).toContain('We never share this.')
  })

  // The label-to-control association is computed during render, so unlike
  // aria-describedby it IS present in server markup — a keyboard or screen
  // reader user gets a working label before any JavaScript runs.
  it("wires the label's for to the control's id in the server markup", () => {
    const html = renderToString(
      <Field label="Email">
        <Input name="email" />
      </Field>,
    )
    const labelFor = /<label[^>]*\sfor="([^"]+)"/.exec(html)?.[1]
    const inputId = /<input[^>]*\sid="([^"]+)"/.exec(html)?.[1]
    expect(labelFor, 'no for attribute on the server-rendered label').toBeDefined()
    expect(inputId).toBe(labelFor)
  })

  it('renders an externally supplied error server-side, with its icon', () => {
    const html = renderToString(
      <Field label="Email" error="Already in use.">
        <Input name="email" />
      </Field>,
    )
    expect(html).toContain('Already in use.')
    expect(html).toContain('<svg')
  })

  /**
   * R16: this buys a named control in streamed and pre-hydration markup for
   * assistive technology. It does NOT make the control operable with
   * JavaScript off — Select's trigger (Task 5) still needs hydration to open
   * its popup either way. What it prevents is the gap the global constraints'
   * Base UI probe found: the trigger's `aria-labelledby` otherwise comes from
   * an effect-registered id and is absent from server HTML entirely.
   */
  it("gives a non-native-label control a server-rendered id and a matching aria-labelledby, scoped to its own tag", () => {
    const html = renderToString(
      <Field label="Choice">
        <Fake />
      </Field>,
    )

    const labelDivId = /<div[^>]*\sid="([^"]+)"[^>]*>Choice<\/div>/.exec(html)?.[1]
    expect(labelDivId, 'no server-rendered <div id=…>Choice</div> label').toBeDefined()

    const buttonTag = /<button\b[^>]*>/.exec(html)?.[0]
    expect(buttonTag, 'no <button> in the server markup').toBeDefined()
    const buttonLabelledBy = /\saria-labelledby="([^"]+)"/.exec(buttonTag!)?.[1]
    expect(buttonLabelledBy, 'the button has no aria-labelledby in server markup').toBeDefined()
    expect(buttonLabelledBy).toBe(labelDivId)
  })
})
