// @vitest-environment jsdom
import { act } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Tooltip } from './Tooltip.js'

/** As in Select.test.tsx: generated ids differ between renders, nothing else may. */
function normaliseIds(html: string): string {
  return html
    .replace(/\bid="[^"]*"/g, 'id="ID"')
    .replace(/\baria-describedby="[^"]*"/g, 'aria-describedby="ID"')
}

/** Open and past Base UI's enter transition, whose transient attributes differ run to run. */
async function settled() {
  const popup = await waitFor(() => screen.getByRole('tooltip'))
  await waitFor(() => expect(popup.hasAttribute('data-starting-style')).toBe(false))
  await waitFor(() => expect(document.querySelector('[style*="transition"]')).toBeNull())
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Tooltip (convenience)', () => {
  // Fails if `content` is rendered as the trigger's `aria-label`: the name
  // would become "Delete" and there would be no description.
  it('describes the trigger without renaming it', async () => {
    render(
      <Tooltip content="Delete">
        <button type="button" aria-label="Delete row" />
      </Tooltip>,
    )
    const trigger = screen.getByRole('button', { name: 'Delete row' })
    fireEvent.focus(trigger)
    const popup = await waitFor(() => screen.getByRole('tooltip'))
    await waitFor(() =>
      expect(trigger.getAttribute('aria-describedby')?.split(' ')).toContain(
        popup.getAttribute('id'),
      ),
    )
    expect(popup.textContent).toBe('Delete')
    expect(trigger.getAttribute('aria-label')).toBe('Delete row')
  })

  // Fails if the convenience adds, drops or reorders any element, attribute
  // or class relative to the parts assembled by hand.
  it('renders the same DOM as the hand-assembled parts', async () => {
    render(
      <Tooltip content="Delete" side="bottom">
        <button type="button" aria-label="Delete row" data-x="1" />
      </Tooltip>,
    )
    fireEvent.focus(screen.getByRole('button', { name: 'Delete row' }))
    await settled()
    const a = normaliseIds(document.body.innerHTML)
    cleanup()

    render(
      <Tooltip.Root>
        <Tooltip.Trigger render={<button type="button" aria-label="Delete row" data-x="1" />} />
        <Tooltip.Popup positioner={{ side: 'bottom' }}>Delete</Tooltip.Popup>
      </Tooltip.Root>,
    )
    fireEvent.focus(screen.getByRole('button', { name: 'Delete row' }))
    await settled()
    const b = normaliseIds(document.body.innerHTML)

    expect(a).toBe(b)
    expect(a).toContain('role="tooltip"')
  })

  // Fails if `delay` is routed to the Root, where Base UI ignores it: hover
  // would then wait the default 600 ms. (Focus ignores delay, so hover it is.)
  it('passes delay to the trigger', async () => {
    vi.useFakeTimers()
    render(
      <Tooltip content="Delete" delay={0}>
        <button type="button" aria-label="Delete row" />
      </Tooltip>,
    )
    const trigger = screen.getByRole('button', { name: 'Delete row' })
    fireEvent.mouseEnter(trigger)
    fireEvent.mouseMove(trigger)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.queryByRole('tooltip')).not.toBeNull()
  })

  // The counterpart: without `delay`, the default 600 ms applies for hover.
  it('waits the default delay on hover when none is given', async () => {
    vi.useFakeTimers()
    render(
      <Tooltip content="Delete">
        <button type="button" aria-label="Delete row" />
      </Tooltip>,
    )
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Delete row' }))
    fireEvent.mouseMove(screen.getByRole('button', { name: 'Delete row' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
