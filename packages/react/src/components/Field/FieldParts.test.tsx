// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Input } from '../Input/Input.js'
import {
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
} from './FieldParts.js'

describe('Field parts', () => {
  // ADR-0011 §4: "Nobody passes an id by hand, and the ARIA wiring cannot be
  // forgotten." Every assertion in this block is about wiring that appears
  // WITHOUT any id being written in the markup above it.
  it('associates the label with the control with no id passed by hand', () => {
    render(
      <FieldRoot>
        <FieldLabel>Email</FieldLabel>
        <Input name="email" />
      </FieldRoot>,
    )
    const control = screen.getByLabelText('Email')
    expect(control.tagName).toBe('INPUT')
    expect(control.id).not.toBe('')
  })

  it('points aria-describedby at the description, with real resolvable ids', () => {
    render(
      <FieldRoot>
        <FieldLabel>Email</FieldLabel>
        <Input name="email" />
        <FieldDescription>We never share this.</FieldDescription>
      </FieldRoot>,
    )
    const control = screen.getByLabelText('Email')
    const described = control.getAttribute('aria-describedby')
    expect(described).not.toBeNull()
    // Resolve every id to a real element: an aria-describedby naming an id
    // that does not exist reads as no description at all, and a bare
    // "attribute is present" check cannot tell the two apart.
    const ids = described!.split(' ').filter(Boolean)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      expect(document.getElementById(id), `no element with id ${id}`).not.toBeNull()
    }
    expect(ids.map((id) => document.getElementById(id)!.textContent)).toContain(
      'We never share this.',
    )
  })

  it('describes the control by BOTH the description and the error when invalid', () => {
    render(
      <FieldRoot invalid>
        <FieldLabel>Email</FieldLabel>
        <Input name="email" />
        <FieldDescription>We never share this.</FieldDescription>
        <FieldError match>That address is already in use.</FieldError>
      </FieldRoot>,
    )
    const control = screen.getByLabelText('Email')
    const ids = control.getAttribute('aria-describedby')!.split(' ').filter(Boolean)
    const texts = ids.map((id) => document.getElementById(id)!.textContent)
    expect(texts).toContain('We never share this.')
    expect(texts.some((t) => t?.includes('That address is already in use.'))).toBe(true)
  })

  it('marks the control aria-invalid when the root is invalid', () => {
    render(
      <FieldRoot invalid>
        <FieldLabel>Email</FieldLabel>
        <Input name="email" />
      </FieldRoot>,
    )
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true')
  })

  it('renders no error element when the field is valid', () => {
    render(
      <FieldRoot>
        <FieldLabel>Email</FieldLabel>
        <Input name="email" />
        <FieldError>Bad address.</FieldError>
      </FieldRoot>,
    )
    expect(screen.queryByText('Bad address.')).toBeNull()
  })

  // ADR-0011 §5 / WCAG 1.4.1: the error state must not be carried by colour
  // alone. The icon is structural, not decoration a consumer can forget.
  it('renders an icon alongside the error text, and hides it from assistive tech', () => {
    render(
      <FieldRoot invalid>
        <FieldLabel>Email</FieldLabel>
        <Input name="email" />
        <FieldError match>Bad address.</FieldError>
      </FieldRoot>,
    )
    // Reached FROM the message, not from a document-wide `querySelector('svg')`:
    // a document-wide search would pass on any icon anywhere on the page, which
    // is precisely the assertion that cannot fail.
    const errorRow = screen.getByText('Bad address.').closest('div')
    expect(errorRow, 'the error message is not inside an error row').not.toBeNull()
    const svg = errorRow!.querySelector('svg')
    expect(svg, 'no icon rendered beside the error text').not.toBeNull()
    // Decorative: the adjacent text already says what it means, so a second
    // announcement would be noise.
    expect(svg!.getAttribute('aria-hidden')).toBe('true')
  })

  // Omitting children must leave Base UI's own message slot in charge — that is
  // the free half of its error behaviour, and it breaks the moment a wrapper
  // starts passing children of its own through unconditionally.
  //
  // jsdom does not populate `validationMessage`, so the message TEXT cannot be
  // asserted here; the browser-level version of this assertion is Task 4's
  // e2e. What is assertable, and what actually proves the wrapper did not
  // hijack the slot, is that the error element renders with its icon and an
  // EMPTY message span — a wrapper injecting its own children would put
  // something in that span.
  it('leaves the message slot to Base UI when given no children', () => {
    const { container } = render(
      <FieldRoot invalid>
        <FieldLabel>Email</FieldLabel>
        <Input name="email" required />
        <FieldError match />
      </FieldRoot>,
    )
    const svg = container.querySelector('svg')
    expect(svg, 'the error element did not render its icon').not.toBeNull()
    const span = svg!.parentElement!.querySelector('span')
    expect(span, 'no message span beside the icon').not.toBeNull()
    expect(span!.textContent).toBe('')
  })

  it('merges className on every part rather than replacing it', () => {
    const { container } = render(
      <FieldRoot invalid className="root-mine">
        <FieldLabel className="label-mine">Email</FieldLabel>
        <Input name="email" />
        <FieldDescription className="desc-mine">Hint</FieldDescription>
        <FieldError match className="error-mine">
          Bad
        </FieldError>
      </FieldRoot>,
    )
    for (const own of ['root-mine', 'label-mine', 'desc-mine', 'error-mine']) {
      const el = container.querySelector(`.${own}`)
      expect(el, `no element carried ${own}`).not.toBeNull()
      expect(el!.className.trim().split(/\s+/).length).toBeGreaterThan(1)
    }
  })

  it('still wires up a bare FieldControl, for a field with no Input', () => {
    render(
      <FieldRoot>
        <FieldLabel>Nickname</FieldLabel>
        <FieldControl name="nickname" />
      </FieldRoot>,
    )
    expect(screen.getByLabelText('Nickname').tagName).toBe('INPUT')
  })
})
