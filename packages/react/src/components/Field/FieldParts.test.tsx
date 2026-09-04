// @vitest-environment jsdom
import { createRef } from 'react'
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

  // `Input.css.ts` styles `&[data-invalid]` (the invalid border) and
  // `&:hover:not([data-disabled])`, so `data-invalid` and `data-disabled` are
  // a load-bearing contract between Base UI and our stylesheet, not incidental
  // debug attributes. Nothing else in the suite pins them: if Base UI renamed
  // or dropped either, every one of those rules would stop matching silently —
  // including the invalid border whose WCAG 1.4.11 rationale is the longest
  // comment in `Input.tokens.ts` — while `aria-invalid` kept passing.
  it('marks the control aria-invalid AND data-invalid when the root is invalid', () => {
    render(
      <FieldRoot invalid>
        <FieldLabel>Email</FieldLabel>
        <Input name="email" />
      </FieldRoot>,
    )
    const control = screen.getByLabelText('Email')
    expect(control.getAttribute('aria-invalid')).toBe('true')
    expect(control.hasAttribute('data-invalid'), 'Input.css.ts styles [data-invalid]').toBe(true)
  })

  it('stamps data-disabled on a disabled control, which is what the styles select on', () => {
    render(
      <FieldRoot disabled>
        <FieldLabel>Email</FieldLabel>
        <Input name="email" />
      </FieldRoot>,
    )
    const control = screen.getByLabelText('Email')
    expect(control.hasAttribute('data-disabled'), 'Input.css.ts styles [data-disabled]').toBe(true)
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
    //
    // `getByText` resolves to the message wrapper itself (testing-library
    // matches on an element's OWN text nodes), so the row is its parent — the
    // wrapper is a `<div>` rather than a `<span>` so that Base UI's multi-error
    // `<ul>` payload is legal inside it.
    const errorRow = screen.getByText('Bad address.').parentElement
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
  // No interaction happens here, so Base UI's own `validityData.error` is
  // still its initial `''` and the message TEXT cannot be asserted — the
  // populated-message case is `Field.test.tsx`'s native-validation test.
  // What is assertable, and what actually proves the wrapper did not hijack
  // the slot, is that the error element renders with its icon and an EMPTY
  // message wrapper — a wrapper injecting its own children would put
  // something in it.
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
    // The message wrapper is the icon's next sibling inside the error row.
    const message = svg!.nextElementSibling
    expect(message, 'no message wrapper beside the icon').not.toBeNull()
    expect(message!.textContent).toBe('')
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

  /**
   * The runtime witness for the `ref as Ref<HTMLElement>` casts in
   * `FieldParts.tsx`. Those casts assert something TypeScript cannot check —
   * that the element Base UI actually commits is the narrower type our public
   * props promise — so the only thing that can catch the cast being wrong is a
   * ref that receives a real node and reports its `tagName`.
   *
   * `FieldError` is the one that most needs it: its ref travels through a
   * hand-written `render` function, and forgetting to spread `elementProps`
   * onto the returned element would silently drop the ref with nothing else in
   * the suite noticing.
   *
   * Each case asserts a non-null node AND the expected tag: a bare
   * `not.toBeNull()` would pass for a ref pointed at the wrong element
   * entirely, which is precisely the failure mode a cast introduces.
   */
  describe('ref forwarding', () => {
    it('forwards a ref to the root element', () => {
      const ref = createRef<HTMLDivElement>()
      render(
        <FieldRoot ref={ref}>
          <FieldLabel>Email</FieldLabel>
          <Input name="email" />
        </FieldRoot>,
      )
      expect(ref.current).not.toBeNull()
      expect(ref.current?.tagName).toBe('DIV')
    })

    it('forwards a ref to the label element', () => {
      const ref = createRef<HTMLLabelElement>()
      render(
        <FieldRoot>
          <FieldLabel ref={ref}>Email</FieldLabel>
          <Input name="email" />
        </FieldRoot>,
      )
      expect(ref.current).not.toBeNull()
      expect(ref.current?.tagName).toBe('LABEL')
    })

    it('forwards a ref to the control element', () => {
      const ref = createRef<HTMLInputElement>()
      render(
        <FieldRoot>
          <FieldLabel>Nickname</FieldLabel>
          <FieldControl name="nickname" ref={ref} />
        </FieldRoot>,
      )
      expect(ref.current).not.toBeNull()
      expect(ref.current?.tagName).toBe('INPUT')
    })

    it('forwards a ref to the description element', () => {
      const ref = createRef<HTMLParagraphElement>()
      render(
        <FieldRoot>
          <FieldLabel>Email</FieldLabel>
          <Input name="email" />
          <FieldDescription ref={ref}>We never share this.</FieldDescription>
        </FieldRoot>,
      )
      expect(ref.current).not.toBeNull()
      expect(ref.current?.tagName).toBe('P')
    })

    // Through the hand-written `render` function — see the block comment above.
    it('forwards a ref to the error element', () => {
      const ref = createRef<HTMLDivElement>()
      render(
        <FieldRoot invalid>
          <FieldLabel>Email</FieldLabel>
          <Input name="email" />
          <FieldError match ref={ref}>
            Bad address.
          </FieldError>
        </FieldRoot>,
      )
      expect(ref.current, 'the render function dropped the forwarded ref').not.toBeNull()
      expect(ref.current?.tagName).toBe('DIV')
      // And it is the error ROW, not some other div: the icon lives inside it.
      expect(ref.current?.querySelector('svg')).not.toBeNull()
    })
  })
})
