// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useClickOutside } from './useClickOutside.js'

afterEach(() => {
  vi.restoreAllMocks()
})

function Probe({
  handler,
  enabled,
}: {
  handler: (e: PointerEvent) => void
  enabled?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, handler, enabled === undefined ? undefined : { enabled })
  return (
    <div>
      <div ref={ref} data-testid="inside">
        <button type="button">in</button>
      </div>
      <button type="button" data-testid="outside">
        out
      </button>
    </div>
  )
}

const pointerdownAdds = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.filter(([type]) => type === 'pointerdown')

describe('useClickOutside', () => {
  it('does not fire for a pointerdown inside', () => {
    const handler = vi.fn()
    const { getByText } = render(<Probe handler={handler} />)
    fireEvent.pointerDown(getByText('in'))
    expect(handler).not.toHaveBeenCalled()
  })

  it('fires for a pointerdown outside', () => {
    const handler = vi.fn()
    const { getByTestId } = render(<Probe handler={handler} />)
    fireEvent.pointerDown(getByTestId('outside'))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('attaches nothing when enabled is false', () => {
    const handler = vi.fn()
    const add = vi.spyOn(Document.prototype, 'addEventListener')
    const { getByTestId } = render(<Probe handler={handler} enabled={false} />)
    fireEvent.pointerDown(getByTestId('outside'))
    expect(handler).not.toHaveBeenCalled()
    expect(pointerdownAdds(add)).toHaveLength(0)
  })

  it('removes the listener on unmount', () => {
    const add = vi.spyOn(Document.prototype, 'addEventListener')
    const remove = vi.spyOn(Document.prototype, 'removeEventListener')
    const { unmount } = render(<Probe handler={vi.fn()} />)
    const added = add.mock.calls.find(([type]) => type === 'pointerdown')?.[1]
    expect(added).toBeTypeOf('function')
    expect(remove.mock.calls.filter(([type]) => type === 'pointerdown')).toHaveLength(0)
    unmount()
    const removed = remove.mock.calls.filter(([type]) => type === 'pointerdown')
    expect(removed).toHaveLength(1)
    expect(removed[0]![1]).toBe(added)
  })

  it('attaches before a conditionally rendered target mounts (fails if the effect returns early on a null ref)', () => {
    const handler = vi.fn()
    function Cond({ open }: { open: boolean }) {
      const ref = useRef<HTMLDivElement>(null)
      useClickOutside(ref, handler)
      return (
        <div>
          {open ? (
            <div ref={ref}>
              <button type="button">in</button>
            </div>
          ) : null}
          <button type="button">out</button>
        </div>
      )
    }
    const { getByText, rerender } = render(<Cond open={false} />)
    fireEvent.pointerDown(getByText('out'))
    expect(handler, 'no target yet: must not fire').not.toHaveBeenCalled()
    rerender(<Cond open />)
    fireEvent.pointerDown(getByText('in'))
    expect(handler).not.toHaveBeenCalled()
    fireEvent.pointerDown(getByText('out'))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('uses a changed handler without re-subscribing', () => {
    const add = vi.spyOn(Document.prototype, 'addEventListener')
    const first = vi.fn()
    const second = vi.fn()
    const { getByTestId, rerender } = render(<Probe handler={first} />)
    rerender(<Probe handler={second} />)
    expect(pointerdownAdds(add)).toHaveLength(1)
    fireEvent.pointerDown(getByTestId('outside'))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('counts an element inside an open shadow root under the ref as inside', () => {
    const handler = vi.fn()
    const { getByTestId } = render(<Probe handler={handler} />)
    const host = document.createElement('div')
    getByTestId('inside').append(host)
    const shadow = host.attachShadow({ mode: 'open' })
    const button = document.createElement('button')
    shadow.append(button)
    fireEvent(button, new Event('pointerdown', { bubbles: true, composed: true }))
    expect(handler).not.toHaveBeenCalled()
    // Non-vacuity: a pointerdown from outside the ref still fires.
    fireEvent.pointerDown(getByTestId('outside'))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('counts a click inside the ref as inside when the ref itself lives in a shadow root (fails with a target-containment check: the document sees the host)', () => {
    const handler = vi.fn()
    const host = document.createElement('div')
    document.body.append(host)
    const shadow = host.attachShadow({ mode: 'open' })
    const mountPoint = document.createElement('div')
    shadow.append(mountPoint)
    const { getByText } = render(<Probe handler={handler} />, { container: mountPoint })
    fireEvent(getByText('in'), new Event('pointerdown', { bubbles: true, composed: true }))
    expect(handler).not.toHaveBeenCalled()
    fireEvent(getByText('out'), new Event('pointerdown', { bubbles: true, composed: true }))
    expect(handler).toHaveBeenCalledTimes(1)
    host.remove()
  })
})
