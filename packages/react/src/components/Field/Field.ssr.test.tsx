import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Field } from './Field.js'
import { Input } from '../Input/Input.js'

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
})
