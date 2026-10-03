// @vitest-environment jsdom
import { createRef } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { tooltipPopupClass } from './Tooltip.css.js'
import { TooltipPopup, TooltipRoot, TooltipTrigger } from './TooltipParts.js'

function describedBy(el: Element): string[] {
  return (el.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
}

describe('Tooltip parts', () => {
  // Fails if the trigger's description stops depending on `state.open` being
  // true: with the `state.open` branch dropped, the attribute never appears.
  it('gives an open popup role=tooltip and an id the trigger is described by', async () => {
    render(
      <TooltipRoot>
        <TooltipTrigger>Save</TooltipTrigger>
        <TooltipPopup>Saves the draft</TooltipPopup>
      </TooltipRoot>,
    )
    const trigger = screen.getByRole('button', { name: 'Save' })
    fireEvent.focus(trigger)
    const popup = await waitFor(() => screen.getByRole('tooltip'))
    const id = popup.getAttribute('id')
    expect(id, 'the popup carries the Root-scoped id').toBeTruthy()
    await waitFor(() => expect(describedBy(trigger)).toContain(id))
  })

  // Fails if `role="tooltip"` is set before the consumer's props: their `role`
  // would then win and the popup would stop being a tooltip.
  it('keeps role=tooltip when the consumer passes another role', async () => {
    render(
      <TooltipRoot defaultOpen>
        <TooltipTrigger>Save</TooltipTrigger>
        {/* @ts-expect-error `role` is pinned, so it is not a TooltipPopup prop. */}
        <TooltipPopup role="nonsense">Saves the draft</TooltipPopup>
      </TooltipRoot>,
    )
    const popup = await waitFor(() => screen.getByText('Saves the draft'))
    expect(popup.getAttribute('role')).toBe('tooltip')
  })

  // Fails if `positioner.ref` is dropped before it reaches the positioner (for
  // example if the overrides were filtered to the placement keys only).
  it("forwards positioner.ref to the positioner, the popup's parent", async () => {
    const positionerRef = createRef<HTMLDivElement>()
    render(
      <TooltipRoot defaultOpen>
        <TooltipTrigger>Save</TooltipTrigger>
        <TooltipPopup positioner={{ ref: positionerRef }}>Saves the draft</TooltipPopup>
      </TooltipRoot>,
    )
    const popup = await waitFor(() => screen.getByRole('tooltip'))
    expect(positionerRef.current).toBeInstanceOf(HTMLDivElement)
    expect(positionerRef.current).toBe(popup.parentElement)
  })

  // Fails if the id is appended unconditionally: a closed tooltip has no
  // popup in the DOM, so the reference would dangle.
  it('leaves a closed trigger with no aria-describedby', () => {
    render(
      <TooltipRoot>
        <TooltipTrigger>Save</TooltipTrigger>
        <TooltipPopup>Saves the draft</TooltipPopup>
      </TooltipRoot>,
    )
    const trigger = screen.getByRole('button', { name: 'Save' })
    expect(trigger.getAttribute('aria-describedby')).toBeNull()
  })

  // Review Focus 1. Fails if the popup id overwrites the consumer's own
  // description instead of being appended to it.
  it("appends to the trigger's own aria-describedby, and restores it on close", async () => {
    render(
      <>
        <p id="hint">Needs a title first</p>
        <TooltipRoot>
          <TooltipTrigger render={<button type="button" aria-describedby="hint" />}>
            Save
          </TooltipTrigger>
          <TooltipPopup>Saves the draft</TooltipPopup>
        </TooltipRoot>
      </>,
    )
    const trigger = screen.getByRole('button', { name: 'Save' })
    fireEvent.focus(trigger)
    const popup = await waitFor(() => screen.getByRole('tooltip'))
    await waitFor(() =>
      expect(trigger.getAttribute('aria-describedby')).toBe(`hint ${popup.getAttribute('id')}`),
    )
    fireEvent.blur(trigger)
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
    expect(trigger.getAttribute('aria-describedby')).toBe('hint')
  })

  // Review Focus 2. Fails if the default trigger is a `<button>` with no type:
  // inside a form it would be a submit button.
  it('renders a type=button trigger by default, which does not submit a form', () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <TooltipRoot>
          <TooltipTrigger>Save</TooltipTrigger>
          <TooltipPopup>Saves the draft</TooltipPopup>
        </TooltipRoot>
      </form>,
    )
    const trigger = screen.getByRole('button', { name: 'Save' })
    expect(trigger.getAttribute('type')).toBe('button')
    fireEvent.click(trigger)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // Review Focus 3. Fails if the clone drops `ref: props.ref`: the element's
  // own ref would then win alone, and the ref passed to TooltipTrigger (with
  // Base UI's own refs) would never receive the node.
  it("keeps the render element's ref and handler, and the trigger's own ref", () => {
    const elementRef = createRef<HTMLButtonElement>()
    const triggerRef = createRef<HTMLElement>()
    const onClick = vi.fn()
    render(
      <TooltipRoot>
        <TooltipTrigger ref={triggerRef} render={<button ref={elementRef} onClick={onClick} />}>
          Save
        </TooltipTrigger>
        <TooltipPopup>Saves the draft</TooltipPopup>
      </TooltipRoot>,
    )
    const trigger = screen.getByRole('button', { name: 'Save' })
    expect(elementRef.current).toBeInstanceOf(HTMLButtonElement)
    expect(elementRef.current).toBe(trigger)
    expect(triggerRef.current).toBe(trigger)
    fireEvent.click(trigger)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  // Fails if the id is hoisted out of the Root into one module constant: two
  // open tooltips would then share an id, and each trigger would point at both.
  //
  // Both Roots are controlled. With two uncontrolled `defaultOpen` Roots, Base
  // UI closes the first on mount with reason `none`: every trigger calls
  // `useDelayGroup` (`tooltip/trigger/TooltipTrigger.js:106`); with no provider
  // its default context's `currentIdRef`/`currentContextRef` are module-level
  // objects shared by every tooltip (`floating-ui-react/components/
  // FloatingDelayGroup.js:17-33`), and the group closes the previously open
  // tooltip (`FloatingDelayGroup.js:144-166`). Controlled `open` turns that close
  // into an `onOpenChange` request we ignore, so this pair stays open together.
  it('gives two open tooltips distinct ids, each trigger pointing at its own', async () => {
    render(
      <>
        <TooltipRoot open>
          <TooltipTrigger>Save</TooltipTrigger>
          <TooltipPopup>Saves the draft</TooltipPopup>
        </TooltipRoot>
        <TooltipRoot open>
          <TooltipTrigger>Delete</TooltipTrigger>
          <TooltipPopup>Deletes the draft</TooltipPopup>
        </TooltipRoot>
      </>,
    )
    const save = await waitFor(() => screen.getByText('Saves the draft'))
    const del = await waitFor(() => screen.getByText('Deletes the draft'))
    const saveId = save.getAttribute('id')
    const deleteId = del.getAttribute('id')
    expect(saveId).toBeTruthy()
    expect(deleteId).toBeTruthy()
    expect(saveId).not.toBe(deleteId)
    await waitFor(() => {
      expect(describedBy(screen.getByRole('button', { name: 'Save' }))).toEqual([saveId])
      expect(describedBy(screen.getByRole('button', { name: 'Delete' }))).toEqual([deleteId])
    })
  })

  // Fails if `className` replaces the recipe class instead of joining it.
  it('merges className on the popup with the recipe class', async () => {
    render(
      <TooltipRoot open>
        <TooltipTrigger>Save</TooltipTrigger>
        <TooltipPopup className="extra">Saves the draft</TooltipPopup>
      </TooltipRoot>,
    )
    const popup = await waitFor(() => screen.getByRole('tooltip'))
    const classes = (popup.getAttribute('class') ?? '').split(' ')
    expect(classes).toContain(tooltipPopupClass)
    expect(classes).toContain('extra')
  })

  // Fails if the consumer's render function is called with Base UI's raw
  // props instead of the described ones: the attribute would never appear.
  it('hands a render function props that carry the description while open', async () => {
    render(
      <TooltipRoot>
        <TooltipTrigger
          render={(props, state) => <button {...props} data-open={String(state.open)} />}
        >
          Save
        </TooltipTrigger>
        <TooltipPopup>Saves the draft</TooltipPopup>
      </TooltipRoot>,
    )
    const trigger = screen.getByRole('button', { name: 'Save' })
    expect(trigger.getAttribute('aria-describedby')).toBeNull()
    expect(trigger.getAttribute('data-open')).toBe('false')
    fireEvent.focus(trigger)
    const popup = await waitFor(() => screen.getByRole('tooltip'))
    await waitFor(() => {
      expect(describedBy(trigger)).toContain(popup.getAttribute('id'))
      expect(trigger.getAttribute('data-open')).toBe('true')
    })
  })

  // Fails if the description is driven by a "hovered or focused" flag rather
  // than Base UI's `state.open`: a controlled open with no interaction would
  // leave the trigger undescribed.
  it('describes the single trigger of a programmatically opened tooltip', async () => {
    render(
      <TooltipRoot open>
        <TooltipTrigger>Save</TooltipTrigger>
        <TooltipPopup>Saves the draft</TooltipPopup>
      </TooltipRoot>,
    )
    const popup = await waitFor(() => screen.getByRole('tooltip'))
    const trigger = screen.getByRole('button', { name: 'Save' })
    await waitFor(() => expect(describedBy(trigger)).toEqual([popup.getAttribute('id')]))
  })
})
