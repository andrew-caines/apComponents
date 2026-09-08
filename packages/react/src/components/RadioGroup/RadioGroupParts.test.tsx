// @vitest-environment jsdom
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RadioGroupItem, RadioGroupRoot } from './RadioGroupParts.js'

/**
 * The compound API on its own, with no `RadioGroup` convenience component
 * anywhere in the tree.
 *
 * The first test is the one that matters most: `Field.Item` and
 * `Field.Description` call `useFieldRootContext(false)` — the non-optional
 * form, which THROWS when there is no `<Field.Root>` ancestor. `RadioGroupRoot`
 * carries that `Field.Root` internally for exactly this reason, and a
 * refactor that moved it up into `RadioGroup.tsx` would leave the documented
 * escape hatch throwing on render with every convenience-component test still
 * green.
 */
describe('RadioGroup parts', () => {
  it('renders on their own, with no convenience component and no Field.Root supplied', () => {
    render(
      <RadioGroupRoot label="How should we reach you?" name="contact" defaultValue="sms">
        <RadioGroupItem value="email" label="Email" />
        <RadioGroupItem value="sms" label="Text message" hint="Standard rates apply." />
      </RadioGroupRoot>,
    )
    expect(screen.getByRole('radiogroup', { name: 'How should we reach you?' })).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(screen.getByRole('radio', { name: 'Text message' }).getAttribute('aria-checked')).toBe(
      'true',
    )
  })

  // ADR-0011 §4: "Nobody passes an id by hand, and the ARIA wiring cannot be
  // forgotten." Nothing below writes an id, and the association still exists.
  it('names the group through the legend, which is a <div> and not a <legend>', () => {
    const { container } = render(
      <RadioGroupRoot label="Contact" name="contact">
        <RadioGroupItem value="email" label="Email" />
      </RadioGroupRoot>,
    )
    const group = screen.getByRole('radiogroup')
    const labelledBy = group.getAttribute('aria-labelledby')
    expect(labelledBy).not.toBeNull()
    // Resolve the id to a real element: an aria-labelledby naming an id that
    // does not exist reads as NO name at all, and "the attribute is present"
    // cannot tell the two apart.
    const legend = document.getElementById(labelledBy!)
    expect(legend, `aria-labelledby names ${labelledBy}, which is on no element`).not.toBeNull()
    expect(legend!.textContent).toBe('Contact')
    // Base UI's `Fieldset.Legend` renders a `<div>`
    // (`fieldset/legend/FieldsetLegend.js` calls `useRenderElement('div', …)`),
    // so `aria-labelledby` is the WHOLE association here — there is no native
    // <fieldset>/<legend> naming underneath it to fall back on. Pinned both
    // ways so a Base UI change to a real <legend> shows up as a decision to
    // revisit rather than as silently different semantics.
    expect(legend!.tagName).toBe('DIV')
    expect(container.querySelector('legend')).toBeNull()
    // The outer element IS a real fieldset, though — that is our own markup.
    expect(container.querySelector('fieldset')).not.toBeNull()
  })

  it('gives each option its own hint, describing that option and no other', () => {
    render(
      <RadioGroupRoot label="Contact" name="contact">
        <RadioGroupItem value="email" label="Email" hint="Delivered instantly." />
        <RadioGroupItem value="sms" label="Text message" hint="Standard rates apply." />
      </RadioGroupRoot>,
    )
    const describedTexts = (name: string) => {
      const radio = screen.getByRole('radio', { name })
      const described = radio.getAttribute('aria-describedby')
      expect(described, `${name} has no aria-describedby`).not.toBeNull()
      const ids = described!.split(' ').filter(Boolean)
      expect(ids.length).toBeGreaterThan(0)
      return ids.map((id) => {
        const el = document.getElementById(id)
        expect(el, `no element with id ${id}`).not.toBeNull()
        return el!.textContent
      })
    }
    // Differential in BOTH directions: each option's hint reaches it, and the
    // other option's hint does not. A single-option test cannot distinguish
    // "one Field.Item per option" from "one shared description scope", which
    // is the failure mode the Field.Item wrapper exists to prevent.
    expect(describedTexts('Email')).toContain('Delivered instantly.')
    expect(describedTexts('Email')).not.toContain('Standard rates apply.')
    expect(describedTexts('Text message')).toContain('Standard rates apply.')
    expect(describedTexts('Text message')).not.toContain('Delivered instantly.')
  })

  it('renders no hint element for an option that has none', () => {
    const { container } = render(
      <RadioGroupRoot label="Contact" name="contact">
        <RadioGroupItem value="email" label="Email" />
      </RadioGroupRoot>,
    )
    // `Field.Description` renders a <p>; omitting `hint` must render nothing
    // at all rather than an empty paragraph taking up a row.
    expect(container.querySelector('p')).toBeNull()
    expect(screen.getByRole('radio', { name: 'Email' }).hasAttribute('aria-describedby')).toBe(
      false,
    )
  })

  // `RadioGroup.css.ts` styles `&[data-checked]`, `&[data-invalid]` and
  // `&:hover:not([data-disabled])`, so these are a load-bearing contract
  // between Base UI and our stylesheet, not incidental debug attributes. If
  // Base UI renamed or dropped one, every rule keyed on it would stop matching
  // silently while `aria-checked` kept passing — the same reasoning as
  // `FieldParts.test.tsx`'s data-invalid/data-disabled test.
  describe("Base UI's own state attributes, which the stylesheet selects on", () => {
    it('stamps data-checked on the selected control and data-unchecked on the rest', () => {
      render(
        <RadioGroupRoot label="Contact" name="contact" defaultValue="sms">
          <RadioGroupItem value="email" label="Email" />
          <RadioGroupItem value="sms" label="Text message" />
        </RadioGroupRoot>,
      )
      const selected = screen.getByRole('radio', { name: 'Text message' })
      const unselected = screen.getByRole('radio', { name: 'Email' })
      expect(
        selected.hasAttribute('data-checked'),
        'RadioGroup.css.ts styles [data-checked]',
      ).toBe(true)
      expect(selected.hasAttribute('data-unchecked')).toBe(false)
      expect(unselected.hasAttribute('data-checked')).toBe(false)
      expect(unselected.hasAttribute('data-unchecked')).toBe(true)
    })

    it('stamps data-disabled on a disabled option, which is what the styles select on', () => {
      render(
        <RadioGroupRoot label="Contact" name="contact">
          <RadioGroupItem value="email" label="Email" disabled />
          <RadioGroupItem value="sms" label="Text message" />
        </RadioGroupRoot>,
      )
      expect(
        screen.getByRole('radio', { name: 'Email' }).hasAttribute('data-disabled'),
        'RadioGroup.css.ts styles :hover:not([data-disabled]) and [data-disabled]',
      ).toBe(true)
      // Differential: the attribute must track the prop, not be present on
      // every control regardless.
      expect(screen.getByRole('radio', { name: 'Text message' }).hasAttribute('data-disabled')).toBe(
        false,
      )
    })

    it('disables the hidden input too, not only the styled span', () => {
      const { container } = render(
        <RadioGroupRoot label="Contact" name="contact">
          <RadioGroupItem value="email" label="Email" disabled />
          <RadioGroupItem value="sms" label="Text message" />
        </RadioGroupRoot>,
      )
      const inputs = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
      expect(inputs.map((i) => i.disabled)).toEqual([true, false])
    })
  })

  it('shows the selected indicator only on the selected option', () => {
    const { container } = render(
      <RadioGroupRoot label="Contact" name="contact" defaultValue="sms">
        <RadioGroupItem value="email" label="Email" />
        <RadioGroupItem value="sms" label="Text message" />
      </RadioGroupRoot>,
    )
    // `Radio.Indicator` returns null unless mounted (see the note in
    // RadioGroup.css.ts) — so exactly one indicator element exists, and it is
    // inside the selected control. Reached FROM the selected radio rather than
    // counted document-wide, so this cannot pass on the wrong element.
    const selected = screen.getByRole('radio', { name: 'Text message' })
    const unselected = screen.getByRole('radio', { name: 'Email' })
    expect(selected.children.length).toBe(1)
    expect(unselected.children.length).toBe(0)
    expect(container.querySelectorAll('[role="radio"] > span')).toHaveLength(1)
  })

  it('merges className on every part rather than replacing it', () => {
    const { container } = render(
      <RadioGroupRoot label="Contact" name="contact" className="root-mine">
        <RadioGroupItem value="email" label="Email" className="item-mine" hint="Hint" />
      </RadioGroupRoot>,
    )
    for (const own of ['root-mine', 'item-mine']) {
      const el = container.querySelector(`.${own}`)
      expect(el, `no element carried ${own}`).not.toBeNull()
      expect(el!.className.trim().split(/\s+/).length).toBeGreaterThan(1)
    }
  })

  /**
   * `RadioGroupRoot`'s ref travels through a `ref as Ref<HTMLElement>` cast —
   * Base UI types `Fieldset.Root`'s ref as `HTMLElement` while rendering a
   * real `<fieldset>`. A cast asserts something TypeScript cannot check, so
   * the only thing that can catch it being wrong is a ref that receives a real
   * node and reports its `tagName`. Each case asserts a non-null node AND the
   * expected tag: a bare `not.toBeNull()` would pass for a ref pointed at the
   * wrong element entirely, which is precisely what a cast can cause.
   */
  describe('ref forwarding', () => {
    it('forwards the root ref to the fieldset element', () => {
      const ref = createRef<HTMLFieldSetElement>()
      render(
        <RadioGroupRoot label="Contact" name="contact" ref={ref}>
          <RadioGroupItem value="email" label="Email" />
        </RadioGroupRoot>,
      )
      expect(ref.current).not.toBeNull()
      expect(ref.current?.tagName).toBe('FIELDSET')
    })

    it('forwards the item ref to its Field.Item element, the option wrapper', () => {
      const ref = createRef<HTMLDivElement>()
      render(
        <RadioGroupRoot label="Contact" name="contact">
          <RadioGroupItem value="email" label="Email" ref={ref} />
        </RadioGroupRoot>,
      )
      expect(ref.current).not.toBeNull()
      expect(ref.current?.tagName).toBe('DIV')
      // And it is the OPTION wrapper, not some other div: the row lives in it.
      expect(ref.current?.querySelector('label')).not.toBeNull()
      expect(ref.current?.querySelector('[role="radio"]')).not.toBeNull()
    })

    // Base UI's own escape hatch to the element a form actually posts. The
    // item spreads the rest of its props onto `Radio.Root` untouched, and this
    // is what proves that pass-through reaches the hidden input.
    it('forwards inputRef to the hidden input, which is what a form posts', () => {
      const ref = createRef<HTMLInputElement>()
      render(
        <RadioGroupRoot label="Contact" name="contact">
          <RadioGroupItem value="email" label="Email" inputRef={ref} />
        </RadioGroupRoot>,
      )
      expect(ref.current).not.toBeNull()
      expect(ref.current?.tagName).toBe('INPUT')
      expect(ref.current?.type).toBe('radio')
      expect(ref.current?.name).toBe('contact')
    })
  })
})
