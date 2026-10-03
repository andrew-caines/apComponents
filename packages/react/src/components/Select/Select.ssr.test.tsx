import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Field } from '../Field/Field.js'
import { LocaleProvider } from '../../providers/LocaleProvider.js'
import { Select } from './Select.js'
import { SelectItem, SelectList, SelectPopup, SelectRoot, SelectTrigger, SelectValue } from './SelectParts.js'

function Parts({ name, defaultValue }: { name?: string; defaultValue?: string }) {
  return (
    <SelectRoot
      {...(name !== undefined ? { name } : {})}
      {...(defaultValue !== undefined ? { defaultValue } : {})}
    >
      <SelectTrigger aria-label="Country">
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        <SelectList>
          <SelectItem value="ca">Canada</SelectItem>
          <SelectItem value="fr">France</SelectItem>
        </SelectList>
      </SelectPopup>
    </SelectRoot>
  )
}

describe('Select parts under SSR', () => {
  it('runs with no DOM at all', () => {
    expect(typeof window).toBe('undefined')
  })

  it('server-renders the trigger', () => {
    const html = renderToString(<Parts />)
    expect(html).toContain('role="combobox"')
  })

  // §4.1.9: the popup is portal content and is absent from server HTML.
  // `Select.Portal` has no `keepMounted` prop in Base UI 1.7.0 (it renders
  // only once `mounted || forceMount`), so the way this breaks is the popup
  // being rendered outside the portal — which is what makes this fail.
  it('server-renders no listbox', () => {
    const html = renderToString(<Parts />)
    expect(html).not.toContain('role="listbox"')
  })

  // Scoped to the named `<input …>` tag, not the whole document: `value` and
  // `name` occur as substrings of other attributes, so a whole-document
  // `toContain` could never fail (see Switch.ssr.test.tsx).
  it('server-renders the hidden input carrying its name and value', () => {
    const html = renderToString(<Parts name="country" defaultValue="fr" />)
    const inputTag = html.match(/<input[^>]*\bname="country"[^>]*>/)?.[0] ?? ''
    expect(inputTag).toContain('<input')
    expect(inputTag).toMatch(/\bvalue="fr"/)
  })
})

const ssr = (ui: ReactElement) => renderToString(<LocaleProvider>{ui}</LocaleProvider>)

const COUNTRIES = [
  { value: 'ca', label: 'Canada' },
  { value: 'fr', label: 'France' },
]

/** The trigger's opening tag, found by its role. */
function triggerTag(html: string): string {
  const tag = /<button[^>]*role="combobox"[^>]*>/.exec(html)
  expect(tag).not.toBeNull()
  return tag![0]
}

/** Everything between the trigger's opening and closing tag. */
function triggerBody(html: string): string {
  const body = /<button[^>]*role="combobox"[^>]*>([\s\S]*?)<\/button>/.exec(html)
  expect(body).not.toBeNull()
  return body![1]!
}

/** Every opening tag of an input carrying `name`, in document order. */
function namedInputs(html: string, name: string): string[] {
  return html.match(new RegExp(`<input[^>]*\\bname="${name}"[^>]*>`, 'g')) ?? []
}

describe('Select (convenience) under SSR', () => {
  // §4.3: the label, not the value, is in the server HTML. Fails if `items`
  // is dropped from Root and the trigger uses a plain `Select.Value`: the
  // trigger then reads `ca`.
  it('server-renders the selected label in the trigger', () => {
    const html = ssr(<Select aria-label="Country" options={COUNTRIES} defaultValue="ca" />)
    const body = triggerBody(html)
    expect(body).toContain('>Canada<')
    expect(body).not.toContain('>ca<')
  })

  // R16, as corrected: this names the control in streamed and pre-hydration
  // markup for assistive technology. It does not make the control operable
  // with JavaScript off. Fails if Field stops passing its explicit `useId`
  // to the label, because Base UI's own id then lands only after an effect.
  it('carries aria-labelledby equal to the Field label div id', () => {
    const html = ssr(
      <Field label="Country">
        <Select options={COUNTRIES} />
      </Field>,
    )
    const label = /<div[^>]*\bid="([^"]+)"[^>]*>Country<\/div>/.exec(html)
    expect(label).not.toBeNull()
    expect(triggerTag(html)).toContain(`aria-labelledby="${label![1]}"`)
  })

  // Fails if `id` stops reaching the trigger.
  it('server-renders a caller-supplied id on the trigger outside a Field', () => {
    const html = ssr(<Select id="x" aria-label="Country" options={COUNTRIES} />)
    expect(triggerTag(html)).toMatch(/\sid="x"/)
  })

  // Inside a `Field`, Base UI's labelable provider renders its own generated
  // id for a control whose caller id reaches only the root (docs/CONTRIBUTING.md,
  // "Base UI's Field discards a caller-supplied `id` from server markup"), and
  // for Select the trigger's own registration then keeps that generated id
  // for good. `Select` passes `id` to the trigger, which renders it directly.
  // Fails if it goes to the root instead.
  it('server-renders a caller-supplied id on the trigger inside a Field', () => {
    const html = ssr(
      <Field label="Country">
        <Select id="x" options={COUNTRIES} />
      </Field>,
    )
    expect(triggerTag(html)).toMatch(/\sid="x"/)
  })

  // Fails if the data attributes are dropped or spread onto the root.
  it('server-renders data attributes on the trigger', () => {
    const html = ssr(<Select data-testid="s" aria-label="Country" options={COUNTRIES} />)
    expect(triggerTag(html)).toContain('data-testid="s"')
    expect(html.match(/data-testid=/g)).toHaveLength(1)
  })

  // Gate 6's shape: a pre-hydration post carries every selected value.
  it('emits one hidden input per default value when multiple', () => {
    const html = ssr(
      <Select
        multiple
        aria-label="Countries"
        name="countries"
        options={COUNTRIES}
        defaultValue={['ca', 'fr']}
      />,
    )
    const inputs = namedInputs(html, 'countries')
    expect(inputs).toHaveLength(2)
    expect(inputs.every((tag) => /\btype="hidden"/.test(tag))).toBe(true)
    expect(inputs.map((tag) => /\bvalue="([^"]*)"/.exec(tag)?.[1])).toEqual(['ca', 'fr'])
  })

  // Review Focus 3: nothing selected posts nothing — not one empty value.
  it('emits no named input for a multiple Select with no default', () => {
    const html = ssr(<Select multiple aria-label="Countries" name="countries" options={COUNTRIES} />)
    expect(html).toContain('role="combobox"')
    expect(namedInputs(html, 'countries')).toHaveLength(0)
  })

  // Fails if `itemToStringValue` stops reaching Root: Base UI then
  // serialises the object as JSON into the post.
  it('posts the itemToStringValue string for an object value', () => {
    const html = ssr(
      <Select
        aria-label="Country"
        name="country"
        options={[{ value: { code: 'ca' }, label: 'Canada' }]}
        itemToStringValue={(v) => v.code}
        defaultValue={{ code: 'ca' }}
      />,
    )
    const inputs = namedInputs(html, 'country')
    expect(inputs).toHaveLength(1)
    expect(inputs[0]).toMatch(/\bvalue="ca"/)
  })
})
