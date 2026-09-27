import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
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
