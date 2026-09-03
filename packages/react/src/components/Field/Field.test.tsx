// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  // The error SLOT is always in the tree; Base UI mounts nothing into it while
  // the field is valid. This asserts the observable half of that: a valid
  // field shows no error row and no icon.
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
   * WCAG 1.4.1 / ADR-0011 §5, on the path a consumer is most likely to take.
   *
   * `<Field label="Email"><Input required /></Field>` supplies no `error`
   * prop, so the browser's own validation is what decides. When it fails, the
   * control gets `aria-invalid` and — through `Input.css.ts`'s
   * `&[data-invalid]` rule — a red border. If nothing renders a message beside
   * them, that red border is the entire signal: colour alone, on the
   * recommended API, which is exactly the state ADR-0011 §5 exists to forbid.
   *
   * WHAT MAKES THIS GO RED: rendering the error slot conditionally in
   * `Field.tsx` — `{hasError ? <FieldError match>{error}</FieldError> : null}`
   * instead of the unconditional `<FieldError {...} />`. With no `Field.Error`
   * in the tree there is nothing for Base UI to render the native validity
   * message into, so the field reaches `aria-invalid` + border with no text and
   * no icon, and the two message assertions below both fail. Passing
   * `children={undefined}` rather than spreading it conditionally fails the
   * same way for a different reason: Base UI's `for...in` prop merge lets an
   * explicit `undefined` win over its own message.
   */
  it('renders a readable message, not colour alone, when native validation fails', async () => {
    const { container } = render(
      // `onChange` so the failure is observable without a real form submit;
      // the constraint itself (`required`, emptied) is the browser's, and the
      // message text below is the browser's too — nothing here supplies one.
      <Field label="Email" validationMode="onChange">
        <Input name="email" required defaultValue="someone@example.com" />
      </Field>,
    )
    const control = screen.getByLabelText('Email')
    fireEvent.change(control, { target: { value: '' } })

    await waitFor(() => {
      expect(control.getAttribute('aria-invalid')).toBe('true')
    })

    // Reached through the control's own `aria-describedby`, so this is the
    // message a screen-reader user actually gets, not merely some text
    // somewhere in the container.
    const ids = (control.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
    const messages = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    expect(
      messages.some((el) => (el.textContent ?? '').trim() !== ''),
      'the field is invalid but describes the control by no non-empty message',
    ).toBe(true)

    // And the non-colour indicator ADR-0011 §5 requires alongside it.
    expect(
      container.querySelector('svg'),
      'the field is invalid with no error icon — colour is carrying the state alone',
    ).not.toBeNull()
  })

  /**
   * `normaliseIds` below rewrites the whole `aria-describedby` value, so the
   * equivalence test cannot see a regression that collapses a two-id list to
   * one. This resolves both ids to their elements, the way
   * `FieldParts.test.tsx` does for the compound path.
   */
  it('describes the control by BOTH the hint and the error', () => {
    render(
      <Field label="Email" hint="We never share this." error="That address is already in use.">
        <Input name="email" />
      </Field>,
    )
    const control = screen.getByLabelText('Email')
    const ids = control.getAttribute('aria-describedby')!.split(' ').filter(Boolean)
    const texts = ids.map((id) => document.getElementById(id)?.textContent ?? null)
    expect(texts).toContain('We never share this.')
    expect(texts.some((t) => t?.includes('That address is already in use.'))).toBe(true)
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

  /**
   * The same rule for the OTHER shape of the component — every optional prop
   * omitted. The all-props-supplied case above cannot see a divergence that
   * only exists when `hint` and `error` are absent, which is the shape most
   * fields in a real product actually have.
   *
   * The compound half renders `<Field.Error />` unconditionally on purpose:
   * that is what the convenience component does now (see `Field.tsx`), and the
   * two must be the same assembly for this test to mean anything. Base UI
   * mounts nothing for it while the field is valid, so both sides emit no
   * error element at all — which is why this reads as "identical and empty"
   * rather than "identical because both render a stray empty div".
   */
  it('produces exactly its compound parts DOM with hint and error omitted too', () => {
    const convenience = render(
      <Field label="Email">
        <Input name="email" defaultValue="a@b.c" />
      </Field>,
    ).container.innerHTML

    const compound = render(
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <Input name="email" defaultValue="a@b.c" />
        <Field.Error />
      </Field.Root>,
    ).container.innerHTML

    expect(normaliseIds(convenience)).toBe(normaliseIds(compound))
    // Guard against the pair matching because BOTH regressed into rendering an
    // empty error row: an always-mounted empty row would be an announced,
    // styled element with nothing in it.
    expect(convenience).not.toContain('svg')
  })

  it('exposes every compound part on the namespace', () => {
    for (const part of ['Root', 'Label', 'Control', 'Description', 'Error'] as const) {
      expect(Field[part], `Field.${part} is missing`).toBeTypeOf('object')
    }
  })
})
