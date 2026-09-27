// @vitest-environment jsdom
import { createRef } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FieldDescription, FieldLabel, FieldRoot } from '../Field/FieldParts.js'
import { selectTriggerRecipe } from './Select.css.js'
import {
  SelectIcon,
  SelectItem,
  SelectList,
  SelectPopup,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from './SelectParts.js'

function Items() {
  return (
    <SelectList>
      <SelectItem value="ca">Canada</SelectItem>
      <SelectItem value="fr">France</SelectItem>
    </SelectList>
  )
}

describe('Select parts', () => {
  // The Field protocol's shape, written by hand (Task 5 attaches the marker
  // that makes Field write it): a `<div>` label with a server-renderable id,
  // pointed at by the trigger's `aria-labelledby`. Everything ELSE — the
  // description link and the invalid state — must arrive from Base UI's
  // labelable context with no id written below (§4.1.3).
  it('is named by a div label and described by the Field, with no describedby id written', () => {
    render(
      <FieldRoot>
        <FieldLabel nativeLabel={false} render={<div />} id="l">
          Country
        </FieldLabel>
        <SelectRoot>
          <SelectTrigger aria-labelledby="l">
            <SelectValue />
          </SelectTrigger>
        </SelectRoot>
        <FieldDescription>Where you pay tax.</FieldDescription>
      </FieldRoot>,
    )
    const trigger = screen.getByRole('combobox', { name: 'Country' })
    const described = trigger.getAttribute('aria-describedby')
    expect(described, 'Field.Description registers its id through the labelable context').not.toBeNull()
    const texts = described!
      .split(' ')
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent)
    expect(texts).toContain('Where you pay tax.')
  })

  it('reports aria-invalid from an invalid Field.Root', () => {
    render(
      <FieldRoot invalid>
        <FieldLabel nativeLabel={false} render={<div />} id="l">
          Country
        </FieldLabel>
        <SelectRoot>
          <SelectTrigger aria-labelledby="l">
            <SelectValue />
          </SelectTrigger>
        </SelectRoot>
      </FieldRoot>,
    )
    expect(screen.getByRole('combobox', { name: 'Country' }).getAttribute('aria-invalid')).toBe(
      'true',
    )
  })

  // §4.1.1: `nativeButton` is derived from `render`. Base UI hard-sets
  // `role="combobox"` last, so the role alone cannot tell the two apart; what
  // a wrongly native anchor DOES carry is the `type="button"` Base UI stamps
  // on a native button. The `type` assertion is the one that fails if
  // `nativeButton` is forced true.
  it('treats a rendered anchor as a non-native button', () => {
    render(
      <SelectRoot>
        <SelectTrigger render={<a href="#" />} aria-label="Country">
          <SelectValue />
        </SelectTrigger>
      </SelectRoot>,
    )
    const trigger = screen.getByRole('combobox', { name: 'Country' })
    expect(trigger.tagName).toBe('A')
    // Documents Base UI's behaviour and guards nothing of ours: Base UI
    // hard-sets `role="combobox"` after all merging (SelectTrigger.js), so no
    // change to SelectParts.tsx can make this line fail.
    expect(trigger.getAttribute('role')).toBe('combobox')
    // The `nativeButton` guard: a trigger wrongly treated as native gets
    // Base UI's `type="button"` stamped on the anchor.
    expect(trigger.getAttribute('type')).toBeNull()
  })

  // The bottom-side placement (`alignItemWithTrigger={false}`, §4.1.7) is NOT
  // asserted here: jsdom has no layout, every rect is zero, and Base UI's
  // popup then falls back to non-aligned placement on its own
  // (`SelectPopup.js`, `fallbackToAlignPopupToTrigger`) — so `data-side`
  // reads `bottom` with or without our prop, and the assertion could not
  // fail. It lives in Task 6's placement `play`, in real Chromium.
  //
  // What jsdom CAN pin is that the composed portal/positioner/popup mounts a
  // listbox inside the positioner on open. Fails if SelectPopup stops
  // rendering Base UI's popup. The pre-click check is what makes the
  // post-click one depend on the click at all.
  it('mounts the listbox on open, and not before', async () => {
    render(
      <SelectRoot>
        <SelectTrigger aria-label="Country">
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          <Items />
        </SelectPopup>
      </SelectRoot>,
    )
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.click(screen.getByRole('combobox', { name: 'Country' }))
    const listbox = await waitFor(() => screen.getByRole('listbox'))
    expect(listbox.closest('[data-side]')).not.toBeNull()
  })

  // §4.1.4: selection is a glyph, never colour alone. SelectItem owns its
  // indicator, so a selected item always carries the check `svg`. Fails if
  // the indicator is removed from SelectItem.
  it('renders the indicator glyph inside the selected item', async () => {
    render(
      <SelectRoot defaultValue="fr" defaultOpen>
        <SelectTrigger aria-label="Country">
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          <Items />
        </SelectPopup>
      </SelectRoot>,
    )
    const selected = await waitFor(() => {
      const el = document.querySelector('[role="option"][data-selected]')
      expect(el).not.toBeNull()
      return el!
    })
    expect(selected.textContent).toContain('France')
    expect(selected.querySelector('svg')).not.toBeNull()
  })

  // Tied to the recipe's own output, the way RadioGroup.test.tsx asserts
  // `size`: a class that is merely non-empty passes for the wrong variant.
  it('maps size onto the trigger recipe', () => {
    const { rerender } = render(
      <SelectRoot>
        <SelectTrigger size="sm" aria-label="Country" />
      </SelectRoot>,
    )
    const trigger = () => screen.getByRole('combobox', { name: 'Country' })
    expect(trigger().className).toBe(selectTriggerRecipe({ size: 'sm' }))
    rerender(
      <SelectRoot>
        <SelectTrigger size="lg" aria-label="Country" />
      </SelectRoot>,
    )
    expect(trigger().className).toBe(selectTriggerRecipe({ size: 'lg' }))
    expect(selectTriggerRecipe({ size: 'sm' })).not.toBe(selectTriggerRecipe({ size: 'lg' }))
  })

  it('forwards the ref to the button and merges className after the recipe class', () => {
    const ref = createRef<HTMLButtonElement>()
    render(
      <SelectRoot>
        <SelectTrigger ref={ref} className="mine" aria-label="Country">
          <SelectIcon />
        </SelectTrigger>
      </SelectRoot>,
    )
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    expect(ref.current!.className).toBe(`${selectTriggerRecipe({ size: 'md' })} mine`)
  })
})
