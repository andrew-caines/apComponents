// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LocaleProvider } from '../../providers/LocaleProvider.js'
import { popoverDescriptionClass, popoverPopupClass, popoverTitleClass } from './Popover.css.js'
import {
  PopoverDescription,
  PopoverDismiss,
  PopoverPopup,
  PopoverRoot,
  PopoverTitle,
  PopoverTrigger,
} from './PopoverParts.js'

function assembly(withTitle = true) {
  return (
    <LocaleProvider>
      <PopoverRoot>
        <PopoverTrigger>Filters</PopoverTrigger>
        <PopoverPopup>
          {withTitle ? <PopoverTitle>Filter options</PopoverTitle> : null}
          <PopoverDescription>Narrow the list</PopoverDescription>
          <button type="button">Apply</button>
        </PopoverPopup>
      </PopoverRoot>
    </LocaleProvider>
  )
}

const accessibleName = (el: Element): string => {
  const ids = (el.getAttribute('aria-labelledby') ?? '').split(' ').filter(Boolean)
  return ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim()
}
const accessibleDescription = (el: Element): string => {
  const ids = (el.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
  return ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim()
}

describe('Popover parts', () => {
  // Fails if PopoverTitle is dropped: Base UI then sets no aria-labelledby
  // target, and the name is empty.
  it('opens a dialog named by its title and described by its description', async () => {
    render(assembly())
    const trigger = screen.getByRole('button', { name: 'Filters' })
    fireEvent.click(trigger)
    const popup = await waitFor(() => screen.getByRole('dialog'))
    expect(accessibleName(popup)).toBe('Filter options')
    expect(accessibleDescription(popup)).toBe('Narrow the list')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
  })

  it('has no name when no title is rendered', async () => {
    render(assembly(false))
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    const popup = await waitFor(() => screen.getByRole('dialog'))
    expect(accessibleName(popup)).toBe('')
  })

  // Fails if `modal` were defaulted on: the popup would trap focus and Escape
  // handling/return would differ; and fails if the focus manager were removed.
  it('is non-modal: focus moves in on click, and Escape returns it to the trigger', async () => {
    render(assembly())
    const trigger = screen.getByRole('button', { name: 'Filters' })
    fireEvent.click(trigger)
    const popup = await waitFor(() => screen.getByRole('dialog'))
    await waitFor(() => expect(popup.contains(document.activeElement)).toBe(true))
    fireEvent.keyDown(document.activeElement ?? popup, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  // Fails if nativeButton is forced to true: Base UI would then put
  // type="button" on the anchor, which is only valid on a real button.
  it('does not tell Base UI an anchor trigger is a native button', () => {
    render(
      <PopoverRoot>
        <PopoverTrigger render={<a href="#more" />}>More</PopoverTrigger>
        <PopoverPopup>
          <PopoverTitle>More</PopoverTitle>
        </PopoverPopup>
      </PopoverRoot>,
    )
    const el = screen.getByText('More')
    expect(el.tagName).toBe('A')
    expect(el.hasAttribute('type')).toBe(false)
  })

  it('keeps a native button trigger native', () => {
    render(assembly())
    expect(screen.getByRole('button', { name: 'Filters' }).getAttribute('type')).toBe('button')
  })

  it('names the dismiss from messages.close, and a LocaleProvider override changes it', async () => {
    render(
      <LocaleProvider messages={{ close: 'Fermer' }}>
        <PopoverRoot open>
          <PopoverTrigger>Filters</PopoverTrigger>
          <PopoverPopup>
            <PopoverTitle>Filter options</PopoverTitle>
            <PopoverDismiss />
          </PopoverPopup>
        </PopoverRoot>
      </LocaleProvider>,
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fermer' })).toBeDefined())
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })

  it('names the dismiss "Close" by default and closing works', async () => {
    render(
      <LocaleProvider>
        <PopoverRoot>
          <PopoverTrigger>Filters</PopoverTrigger>
          <PopoverPopup>
            <PopoverTitle>Filter options</PopoverTitle>
            <PopoverDismiss />
          </PopoverPopup>
        </PopoverRoot>
      </LocaleProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    fireEvent.click(await waitFor(() => screen.getByRole('button', { name: 'Close' })))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  // Fails if className replaces a recipe class instead of joining it.
  it('merges className on the popup, title and description', async () => {
    render(
      <LocaleProvider>
        <PopoverRoot open>
          <PopoverTrigger>Filters</PopoverTrigger>
          <PopoverPopup className="x-popup">
            <PopoverTitle className="x-title">Filter options</PopoverTitle>
            <PopoverDescription className="x-desc">Narrow the list</PopoverDescription>
          </PopoverPopup>
        </PopoverRoot>
      </LocaleProvider>,
    )
    const popup = await waitFor(() => screen.getByRole('dialog'))
    const classes = (el: Element) => (el.getAttribute('class') ?? '').split(' ')
    expect(classes(popup)).toEqual(expect.arrayContaining([popoverPopupClass, 'x-popup']))
    const title = screen.getByText('Filter options')
    expect(classes(title)).toEqual(expect.arrayContaining([popoverTitleClass, 'x-title']))
    const desc = screen.getByText('Narrow the list')
    expect(classes(desc)).toEqual(expect.arrayContaining([popoverDescriptionClass, 'x-desc']))
  })
})
