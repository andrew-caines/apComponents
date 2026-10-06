// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from '../Button/Button.js'
import {
  accordionChevronClass,
  accordionHeaderClass,
  accordionItemClass,
  accordionPanelClass,
  accordionTriggerClass,
} from './Accordion.css.js'
import {
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  AccordionRoot,
  type AccordionRootProps,
  AccordionTrigger,
  type AccordionTriggerProps,
} from './AccordionParts.js'

afterEach(cleanup)

function assembly(rootProps: Partial<AccordionRootProps> = {}) {
  return (
    <AccordionRoot {...rootProps}>
      <AccordionItem value="a">
        <AccordionHeader>
          <AccordionTrigger>Alpha</AccordionTrigger>
        </AccordionHeader>
        <AccordionPanel>Alpha content</AccordionPanel>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionHeader>
          <AccordionTrigger>Beta</AccordionTrigger>
        </AccordionHeader>
        <AccordionPanel>Beta content</AccordionPanel>
      </AccordionItem>
    </AccordionRoot>
  )
}

function single(triggerProps: Partial<AccordionTriggerProps> = {}) {
  return (
    <AccordionRoot>
      <AccordionItem value="a">
        <AccordionHeader>
          <AccordionTrigger {...triggerProps}>Alpha</AccordionTrigger>
        </AccordionHeader>
        <AccordionPanel>Alpha content</AccordionPanel>
      </AccordionItem>
    </AccordionRoot>
  )
}

const classes = (el: Element): string[] => (el.getAttribute('class') ?? '').split(' ')
const trigger = (name: string) => screen.getByRole('button', { name })
const expanded = (name: string) => trigger(name).getAttribute('aria-expanded')

describe('Accordion parts', () => {
  // Regression guard: none of our code sets these. It pins Base UI's wiring
  // (`accordion/trigger/AccordionTrigger.js:62-63`,
  // `accordion/panel/AccordionPanel.js:106-107`), which we rely on for ARIA.
  it('wires the trigger to aria-expanded and labels the open panel as a region', async () => {
    render(assembly())
    expect(expanded('Alpha')).toBe('false')
    expect(expanded('Beta')).toBe('false')
    fireEvent.click(trigger('Alpha'))
    await waitFor(() => expect(expanded('Alpha')).toBe('true'))
    const region = screen.getByRole('region', { name: 'Alpha' })
    expect(region.textContent).toBe('Alpha content')
    expect(region.getAttribute('aria-labelledby')).toBe(trigger('Alpha').id)
    expect(trigger('Alpha').getAttribute('aria-controls')).toBe(region.id)
  })

  // Regression guard on Base UI's `multiple = false` default
  // (`accordion/root/AccordionRoot.js:36`). Fails if AccordionRoot stops
  // passing `multiple` through, or sets it itself.
  it('keeps one item open by default, and several with multiple', async () => {
    render(assembly())
    fireEvent.click(trigger('Alpha'))
    await waitFor(() => expect(expanded('Alpha')).toBe('true'))
    fireEvent.click(trigger('Beta'))
    await waitFor(() => expect(expanded('Beta')).toBe('true'))
    await waitFor(() => expect(expanded('Alpha')).toBe('false'))
    cleanup()

    render(assembly({ multiple: true }))
    fireEvent.click(trigger('Alpha'))
    await waitFor(() => expect(expanded('Alpha')).toBe('true'))
    fireEvent.click(trigger('Beta'))
    await waitFor(() => expect(expanded('Beta')).toBe('true'))
    expect(expanded('Alpha')).toBe('true')
  })

  // The first half pins Base UI's `h3` default
  // (`accordion/header/AccordionHeader.js:29`). The second fails if
  // AccordionHeader drops or replaces the consumer's `render`, which is how
  // the heading level changes.
  it('renders the header as an h3, and render swaps the heading level', () => {
    render(single())
    expect(trigger('Alpha').parentElement?.tagName).toBe('H3')
    cleanup()
    render(
      <AccordionRoot>
        <AccordionItem value="a">
          <AccordionHeader render={<h2 />}>
            <AccordionTrigger>Alpha</AccordionTrigger>
          </AccordionHeader>
        </AccordionItem>
      </AccordionRoot>,
    )
    expect(trigger('Alpha').parentElement?.tagName).toBe('H2')
  })

  // Fails if Button loses its `[NATIVE_BUTTON_DERIVABLE]` marker: the derived
  // `nativeButton` becomes false, so Base UI drops `type`, adds
  // `role="button"` and logs an error. (Dropping the derivation does NOT fail
  // this test: Base UI's own default, `nativeButton = true`, is right for a
  // Button. The span test below covers that.)
  it('renders a Button trigger as a native button, and logs nothing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(single({ render: <Button variant="ghost" /> }))
      const el = trigger('Alpha')
      expect(el.tagName).toBe('BUTTON')
      expect(el.getAttribute('type')).toBe('button')
      expect(el.hasAttribute('role')).toBe(false)
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  // Fails if the `nativeButton` derivation is dropped: Base UI's default
  // `true` (`accordion/trigger/AccordionTrigger.js:29`) would then put
  // `type="button"` on a span and give it no button role.
  it('does not tell Base UI a span trigger is a native button', () => {
    render(single({ render: <span /> }))
    const el = trigger('Alpha')
    expect(el.tagName).toBe('SPAN')
    expect(el.hasAttribute('type')).toBe(false)
    expect(el.getAttribute('role')).toBe('button')
  })

  // Fails if the chevron is rendered outside the trigger (for example as a
  // sibling of BaseAccordion.Trigger), or only when `render` is absent: the
  // trigger owns it, so no `render` override can remove it.
  it('owns a decorative chevron inside the trigger, whatever render is', () => {
    const renders = [undefined, <Button variant="ghost" />, <span />]
    for (const r of renders) {
      render(single(r === undefined ? {} : { render: r }))
      const el = trigger('Alpha')
      const chevrons = el.querySelectorAll(`.${accordionChevronClass}`)
      expect(chevrons).toHaveLength(1)
      const chevron = chevrons[0] as Element
      expect(chevron.tagName.toLowerCase()).toBe('svg')
      expect(chevron.getAttribute('aria-hidden')).toBe('true')
      // The chevron follows the label, and adds nothing to the name.
      expect(el.lastElementChild).toBe(chevron)
      expect(el.textContent).toBe('Alpha')
      cleanup()
    }
  })

  // Regression guard: the chevron's rotation keys on `[data-panel-open]`,
  // which Base UI's trigger sets only while open
  // (`utils/collapsibleOpenStateMapping.js:15-23`, applied at
  // `accordion/trigger/AccordionTrigger.js:71`).
  it('marks the trigger data-panel-open only while its panel is open', async () => {
    render(single())
    expect(trigger('Alpha').hasAttribute('data-panel-open')).toBe(false)
    fireEvent.click(trigger('Alpha'))
    await waitFor(() => expect(trigger('Alpha').hasAttribute('data-panel-open')).toBe(true))
  })

  // Fails if className replaces a recipe class instead of joining it, or if
  // a part drops its class. The panel class is the one that declares
  // `--panel-height`; jsdom cannot see that declaration (vanilla-extract
  // injects no CSS in the unit project), so the declaration itself is pinned
  // by the Task 6 story.
  it('merges className on every styled part', async () => {
    const { container } = render(
      <AccordionRoot defaultValue={['a']}>
        <AccordionItem value="a" className="x-item">
          <AccordionHeader className="x-header">
            <AccordionTrigger className="x-trigger">Alpha</AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel className="x-panel">Alpha content</AccordionPanel>
        </AccordionItem>
      </AccordionRoot>,
    )
    const item = (container.firstElementChild as Element).firstElementChild as Element
    expect(classes(item)).toEqual(expect.arrayContaining([accordionItemClass, 'x-item']))
    const el = trigger('Alpha')
    expect(classes(el.parentElement as Element)).toEqual(
      expect.arrayContaining([accordionHeaderClass, 'x-header']),
    )
    expect(classes(el)).toEqual(expect.arrayContaining([accordionTriggerClass, 'x-trigger']))
    const region = await screen.findByRole('region', { name: 'Alpha' })
    expect(classes(region)).toEqual(expect.arrayContaining([accordionPanelClass, 'x-panel']))
  })
})
