// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RadioGroup } from './RadioGroup.js'
import { radioGroupHintRecipe, radioRecipe } from './RadioGroup.css.js'

const OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'Text message' },
  { value: 'none', label: 'Do not contact me' },
] as const

describe('RadioGroup', () => {
  it('exposes a radiogroup named by its label', () => {
    render(<RadioGroup label="How should we reach you?" name="contact" options={OPTIONS} />)
    expect(screen.getByRole('radiogroup', { name: 'How should we reach you?' })).toBeTruthy()
  })

  it('renders one radio per option, each named by its own label', () => {
    render(<RadioGroup label="Contact" name="contact" options={OPTIONS} />)
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: 'Text message' })).toBeTruthy()
  })

  it('gives every option a distinct id, which one Field.Item per option is what buys', () => {
    // Without a Field.Item wrapper per option, every hidden input resolves to
    // the same generated id from the shared labelable provider — duplicate DOM
    // ids across the whole group. This is the assertion that catches it.
    const { container } = render(<RadioGroup label="Contact" name="contact" options={OPTIONS} />)
    const ids = [...container.querySelectorAll('input[type="radio"]')].map((el) => el.id)
    expect(ids.filter(Boolean)).toHaveLength(3)
    // R8: `expect(new Set(ids)).toHaveProperty('size', 3)` in the brief is a
    // jest-dom-free matcher, but this repo asserts on plain values — the
    // equivalent-strength form is the Set's own size. Both fail if two options
    // ever share an id.
    expect(new Set(ids).size).toBe(3)
  })

  it('posts the selected value under the group name', () => {
    const seen = vi.fn()
    const { container } = render(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          seen(new FormData(e.currentTarget).get('contact'))
        }}
      >
        <RadioGroup label="Contact" name="contact" options={OPTIONS} defaultValue="sms" />
      </form>,
    )
    fireEvent.submit(container.querySelector('form')!)
    expect(seen).toHaveBeenCalledWith('sms')
  })

  // `await waitFor`, not a synchronous assertion. Base UI's composite root
  // defers the focus move to a microtask — `queueMicrotask(() =>
  // elementsRef.current[nextIndex]?.focus())` in
  // `internals/composite/root/useCompositeRoot.js`, commented there as
  // "Wait for FocusManager `returnFocus` to execute" — and selection follows
  // FOCUS, not the keypress (`RadioRoot`'s own `onFocus` clicks the hidden
  // input). So nothing at all has changed by the time `fireEvent.keyDown`
  // returns; the brief's synchronous version of this test reads the DOM one
  // microtask too early and can never pass. See the task report.
  it('moves selection with the arrow keys', async () => {
    render(<RadioGroup label="Contact" name="contact" options={OPTIONS} defaultValue="email" />)
    const first = screen.getByRole('radio', { name: 'Email' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    // `.getAttribute`, not jest-dom's `toHaveAttribute` — this repo installs no
    // jest-dom matchers (see the same note in Input.test.tsx:139).
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Text message' }).getAttribute('aria-checked')).toBe(
        'true',
      )
    })
    // MOVED, not added: a radio group has exactly one selection, so the option
    // that was selected must have given it up. Asserting only the new one
    // would still pass if arrowing turned the group into a checkbox list.
    expect(screen.getByRole('radio', { name: 'Email' }).getAttribute('aria-checked')).toBe('false')
    // And focus followed selection — roving tabindex without focus is a group
    // a keyboard user cannot actually move through.
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Text message' }))
  })

  // `size` is a group-level prop that this component MAPS onto every option
  // (RadioGroup.tsx), because Base UI's radio group publishes no context for a
  // part to read it from. Nothing asserted that mapping — `size` shipped as an
  // entirely untested variant prop, so a group-level `size` silently reverting
  // to each option's own default would have looked identical to every other
  // test in this file.
  //
  // Tied to the recipes' own output rather than to "the class is non-empty",
  // which passes for a class from the wrong variant — the pattern
  // Input.test.tsx:19-37 establishes for asserting a recipe variant with no
  // stylesheet applied. Both recipes are checked because both take `size`: the
  // control's diameter and the hint's indent, which is derived from it.
  it('maps the group-level size onto every option and every hint', () => {
    const withHints = [
      { value: 'email', label: 'Email', hint: 'Delivered instantly.' },
      { value: 'sms', label: 'Text message', hint: 'Standard rates apply.' },
    ]
    const { container, rerender } = render(
      <RadioGroup label="Contact" name="contact" options={withHints} size="lg" />,
    )
    const controlClasses = () => screen.getAllByRole('radio').map((el) => el.className)
    const hintClasses = () => [...container.querySelectorAll('p')].map((el) => el.className)

    expect(controlClasses()).toEqual([radioRecipe({ size: 'lg' }), radioRecipe({ size: 'lg' })])
    expect(hintClasses()).toEqual([
      radioGroupHintRecipe({ size: 'lg' }),
      radioGroupHintRecipe({ size: 'lg' }),
    ])

    // Differential: the classes must track the prop rather than being whatever
    // the default produces. Without this, a component that ignored `size`
    // entirely would still satisfy the assertions above whenever `lg` happened
    // to equal the default.
    rerender(<RadioGroup label="Contact" name="contact" options={withHints} />)
    expect(controlClasses()).toEqual([radioRecipe({ size: 'md' }), radioRecipe({ size: 'md' })])
    expect(controlClasses()[0]).not.toBe(radioRecipe({ size: 'lg' }))
    expect(hintClasses()[0]).not.toBe(radioGroupHintRecipe({ size: 'lg' }))
  })

  // `invalid` reaches every option's control — the group's only route to the
  // `[data-invalid]` rule and `RADIO_GROUP_TOKENS.borderInvalid`, both of
  // which were unreachable through the public API before it existed.
  // `RadioGroupParts.test.tsx` pins the attribute differentially; this asserts
  // the convenience component forwards the prop at all.
  it('forwards invalid through to every option', () => {
    render(<RadioGroup label="Contact" name="contact" options={OPTIONS} invalid />)
    expect(screen.getAllByRole('radio').map((el) => el.hasAttribute('data-invalid'))).toEqual([
      true,
      true,
      true,
    ])
  })

  it('renders an option hint as a description of that option alone', () => {
    render(
      <RadioGroup
        label="Contact"
        name="contact"
        options={[{ value: 'sms', label: 'Text message', hint: 'Standard rates apply.' }]}
      />,
    )
    const radio = screen.getByRole('radio', { name: 'Text message' })
    const ids = radio.getAttribute('aria-describedby')!.split(' ').filter(Boolean)
    expect(ids.map((id) => document.getElementById(id)!.textContent)).toContain(
      'Standard rates apply.',
    )
  })
})
