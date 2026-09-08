import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RadioGroup } from './RadioGroup.js'

const OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'Text message' },
  { value: 'none', label: 'Do not contact me' },
] as const

const markup = (defaultValue?: string) =>
  renderToString(
    <RadioGroup
      label="How should we reach you?"
      name="contact"
      options={OPTIONS}
      {...(defaultValue !== undefined ? { defaultValue } : {})}
    />,
  )

/** Every `<input …>` tag in the document, in source order. */
const inputTags = (html: string): string[] => html.match(/<input[^>]*>/g) ?? []

/**
 * Every assertion below is SCOPED, and most are differential.
 *
 * That is not stylistic. The strings this test cares about — `checked`,
 * `name`, `value`, `radio` — are all substrings of attribute NAMES that Base
 * UI renders unconditionally: `aria-checked` contains "checked",
 * `aria-labelledby` and `role="radiogroup"` contain "radio", and
 * `value`/`name` appear on the hidden inputs whatever their content. A bare
 * `expect(html).toContain('checked')` against the whole document is satisfied
 * by markup with nothing selected at all and therefore can never fail — the
 * exact defect found in Task 2's SSR test (see the review note in
 * `Checkbox.ssr.test.tsx` and the differential test in
 * `Switch.ssr.test.tsx`). So: match inside the `<input …>` tag rather than the
 * document, require presence AND absence, and resolve every id to the element
 * that carries it.
 */
describe('RadioGroup under SSR', () => {
  it('runs with no DOM at all', () => {
    expect(typeof window).toBe('undefined')
  })

  it('server-renders one hidden radio input per option, each under the group name', () => {
    const tags = inputTags(markup())
    expect(tags).toHaveLength(OPTIONS.length)
    for (const tag of tags) {
      expect(tag).toMatch(/\btype="radio"/)
      expect(tag).toMatch(/\bname="contact"/)
    }
    // One input per option value, and no others — a scoped, per-tag match, so
    // this fails if an option's value stops reaching its input rather than
    // passing on the word "value" appearing anywhere in the document.
    const values = tags.map((tag) => /\bvalue="([^"]*)"/.exec(tag)?.[1])
    expect(values).toEqual(['email', 'sms', 'none'])
  })

  it('server-renders checked on exactly the input matching defaultValue', () => {
    const tags = inputTags(markup('sms'))
    const checked = tags.filter((tag) => /\bchecked=/.test(tag))
    // Exactly ONE, and it is the right one: a radio group with two checked
    // inputs, or with the wrong one checked, both fail here. Asserting only
    // "the sms input is checked" would pass with all three checked.
    expect(checked).toHaveLength(1)
    expect(checked[0]).toMatch(/\bvalue="sms"/)
  })

  it('server-renders no checked input at all when no defaultValue is given', () => {
    // The other half of the differential. Without this, `\bchecked=` could be
    // an attribute Base UI renders on every input regardless and the test
    // above would still pass.
    const tags = inputTags(markup())
    expect(tags.filter((tag) => /\bchecked=/.test(tag))).toHaveLength(0)
  })

  // This attribute is in the server HTML only because `RadioGroupRoot`
  // generates the legend's id itself and passes it to both ends. Base UI's own
  // registration path would NOT put it here: `Fieldset.Legend` registers its
  // id from a layout effect and `Fieldset.Root` holds it in state
  // (`utils/useRegisteredLabelId.js`), so the reference appears only after
  // hydration and the group would be nameless until then. This test is what
  // holds that decision in place — remove the generated id and it fails.
  it('server-renders role="radiogroup" labelled by the legend element', () => {
    const html = markup('sms')
    const groupTag = /<div[^>]*role="radiogroup"[^>]*>/.exec(html)?.[0]
    expect(groupTag, 'no element with role="radiogroup" in the server HTML').toBeDefined()

    const labelledBy = /\baria-labelledby="([^"]+)"/.exec(groupTag!)?.[1]
    expect(labelledBy, 'the radiogroup carries no aria-labelledby').toBeDefined()

    // RESOLVED, not merely present: an aria-labelledby naming an id that is on
    // no element reads as no accessible name at all, and there is no DOM here
    // to resolve it for us. Matching the element that carries that exact id
    // AND capturing its text is what makes this fail if the legend's id and
    // the group's reference ever come apart.
    const legend = new RegExp(`<([a-z]+)[^>]*\\bid="${labelledBy!}"[^>]*>([^<]*)</\\1>`).exec(html)
    expect(legend, `nothing in the server HTML carries id="${labelledBy!}"`).not.toBeNull()
    expect(legend![2]).toBe('How should we reach you?')

    // `Fieldset.Legend` renders a `<div>`, not a `<legend>`
    // (`fieldset/legend/FieldsetLegend.js` calls `useRenderElement('div', …)`),
    // so `aria-labelledby` above is the WHOLE association — pinned here so a
    // Base UI change to real <fieldset>/<legend> semantics surfaces as a
    // decision to revisit rather than as silently different markup.
    expect(legend![1]).toBe('div')
    expect(html).not.toContain('<legend')
    // The group's own outer element is a real <fieldset>, though — ours.
    expect(html).toContain('<fieldset')
  })

  // NOT asserted: `aria-describedby` for an option's hint. `Field.Description`
  // registers its id from a layout effect, so the attribute is absent from
  // server HTML and appears after hydration — both passes agree, so it is not
  // a hydration mismatch, but it must never be asserted against server markup
  // (see the note at the top of `FieldParts.tsx`). The hint's TEXT is still in
  // the server output, which is what a no-JS reader gets, so that is what is
  // asserted here instead.
  it('server-renders an option hint as text, even though its ARIA wiring lands after hydration', () => {
    const html = renderToString(
      <RadioGroup
        label="Contact"
        name="contact"
        options={[{ value: 'sms', label: 'Text message', hint: 'Standard rates apply.' }]}
      />,
    )
    expect(html).toContain('Standard rates apply.')
    expect(html).not.toContain('aria-describedby')
  })
})
