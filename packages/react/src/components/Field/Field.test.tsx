// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Field } from './Field.js'
import { Input } from '../Input/Input.js'

/**
 * Generated ids differ between two renders of the same tree, so they are
 * normalised away before comparison. Everything else — tag names, class
 * names, attribute presence, text, ordering — is compared verbatim.
 */
function normaliseIds(html: string): string {
  return html
    .replace(/\bid="[^"]*"/g, 'id="ID"')
    .replace(/\bfor="[^"]*"/g, 'for="ID"')
    .replace(/\baria-describedby="[^"]*"/g, 'aria-describedby="ID"')
    .replace(/\baria-labelledby="[^"]*"/g, 'aria-labelledby="ID"')
}

describe('Field (convenience)', () => {
  it('labels the control', () => {
    render(
      <Field label="Email">
        <Input name="email" />
      </Field>,
    )
    expect(screen.getByLabelText('Email').tagName).toBe('INPUT')
  })

  it('renders the hint as the field description', () => {
    render(
      <Field label="Email" hint="We never share this.">
        <Input name="email" />
      </Field>,
    )
    const ids = screen
      .getByLabelText('Email')
      .getAttribute('aria-describedby')!
      .split(' ')
      .filter(Boolean)
    expect(ids.map((id) => document.getElementById(id)!.textContent)).toContain(
      'We never share this.',
    )
  })

  it('shows an externally supplied error and marks the control invalid', () => {
    render(
      <Field label="Email" error="That address is already in use.">
        <Input name="email" />
      </Field>,
    )
    const control = screen.getByLabelText('Email')
    expect(control.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('That address is already in use.')).not.toBeNull()
  })

  it('renders no error element when no error is given', () => {
    render(
      <Field label="Email" hint="Hint">
        <Input name="email" />
      </Field>,
    )
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).not.toBe('true')
    expect(document.querySelector('svg')).toBeNull()
  })

  /**
   * ADR-0011 §2: "a convenience component must be implementable purely through
   * the public compound API. If it cannot be, the compound API is incomplete —
   * and that is the bug to fix, not to work around internally."
   *
   * This is that rule as a test. It is the reason the two APIs cannot drift
   * into a fast path and a real path with different behaviour: any structure,
   * class, attribute or ordering the convenience component produces that the
   * compound assembly below cannot produce fails right here.
   */
  it('produces exactly the DOM its own compound parts produce', () => {
    const convenience = render(
      <Field label="Email" hint="We never share this." error="Already in use.">
        <Input name="email" defaultValue="a@b.c" />
      </Field>,
    ).container.innerHTML

    const compound = render(
      <Field.Root invalid>
        <Field.Label>Email</Field.Label>
        <Input name="email" defaultValue="a@b.c" />
        <Field.Description>We never share this.</Field.Description>
        <Field.Error match>Already in use.</Field.Error>
      </Field.Root>,
    ).container.innerHTML

    expect(normaliseIds(convenience)).toBe(normaliseIds(compound))
  })

  it('exposes every compound part on the namespace', () => {
    for (const part of ['Root', 'Label', 'Control', 'Description', 'Error'] as const) {
      expect(Field[part], `Field.${part} is missing`).toBeTypeOf('object')
    }
  })
})
