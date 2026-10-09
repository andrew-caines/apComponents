// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { type Disclosure, type UseDisclosureOptions, useDisclosure } from './useDisclosure.js'

let d: Disclosure
function Probe(props: UseDisclosureOptions) {
  d = useDisclosure(props)
  return null
}

describe('useDisclosure', () => {
  it('defaults to closed and defaultOpen opens it', () => {
    render(<Probe />)
    expect(d.open).toBe(false)
    render(<Probe defaultOpen />)
    expect(d.open).toBe(true)
  })

  it('onOpen, onClose, onToggle and setOpen each change state, firing onOpenChange once per change', () => {
    const onOpenChange = vi.fn()
    render(<Probe onOpenChange={onOpenChange} />)
    act(() => d.onOpen())
    expect(d.open).toBe(true)
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    act(() => d.onOpen())
    expect(onOpenChange, 'opening an open disclosure is not a change').toHaveBeenCalledTimes(1)
    act(() => d.onClose())
    expect(d.open).toBe(false)
    act(() => d.onToggle())
    expect(d.open).toBe(true)
    act(() => d.setOpen(false))
    expect(d.open).toBe(false)
    expect(onOpenChange.mock.calls.map((c) => c[0])).toEqual([true, false, true, false])
  })

  it('controlled: open follows the prop', () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(<Probe open={false} onOpenChange={onOpenChange} />)
    act(() => d.onOpen())
    expect(d.open).toBe(false)
    expect(onOpenChange).toHaveBeenCalledWith(true)
    rerender(<Probe open={true} onOpenChange={onOpenChange} />)
    expect(d.open).toBe(true)
  })
})
