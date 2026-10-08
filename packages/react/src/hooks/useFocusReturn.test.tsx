// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useFocusReturn } from './useFocusReturn.js'

afterEach(() => {
  vi.restoreAllMocks()
})

/** Moves focus to the input in its own passive effect, as real content does. */
function Content() {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return <input data-testid="input" ref={ref} />
}

function Owner({ active }: { active: boolean }) {
  useFocusReturn(active)
  return active ? <Content /> : null
}

function focusedButton() {
  const button = document.createElement('button')
  document.body.append(button)
  button.focus()
  return button
}

describe('useFocusReturn', () => {
  it('restores focus to the prior element when active turns false', () => {
    const button = focusedButton()
    const { rerender, getByTestId, queryByTestId } = render(<Owner active={false} />)
    rerender(<Owner active />)
    expect(document.activeElement).toBe(getByTestId('input'))
    rerender(<Owner active={false} />)
    expect(queryByTestId('input')).toBeNull()
    expect(document.activeElement).toBe(button)
    button.remove()
  })

  it('restores focus on unmount while active', () => {
    const button = focusedButton()
    const { rerender, unmount } = render(<Owner active={false} />)
    rerender(<Owner active />)
    expect(document.activeElement).not.toBe(button)
    unmount()
    expect(document.activeElement).toBe(button)
    button.remove()
  })

  it('does not focus a recorded element that was removed, and does not throw', () => {
    const button = focusedButton()
    const focus = vi.spyOn(button, 'focus')
    const { rerender } = render(<Owner active={false} />)
    rerender(<Owner active />)
    button.remove()
    expect(() => rerender(<Owner active={false} />)).not.toThrow()
    expect(focus).not.toHaveBeenCalled()
  })
})
