import { describe, expect, it, vi } from 'vitest'
import { emit, nextId, subscribe } from './channel.js'

describe('channel', () => {
  it('emit with no listener returns false', () => {
    expect(emit({ kind: 'toast-close' })).toBe(false)
  })

  it('emit with a listener returns true and delivers the event', () => {
    const listener = vi.fn()
    const off = subscribe(listener)
    const event = { kind: 'toast-close', id: 'a' } as const
    expect(emit(event)).toBe(true)
    expect(listener).toHaveBeenCalledWith(event)
    off()
  })

  it('unsubscribe stops delivery and emit goes back to false', () => {
    const listener = vi.fn()
    const off = subscribe(listener)
    off()
    // Fails if the returned function does not remove the listener.
    expect(emit({ kind: 'toast-close' })).toBe(false)
    expect(listener).not.toHaveBeenCalled()
  })

  it('nextId values are distinct and carry the prefix', () => {
    const a = nextId('toast')
    const b = nextId('toast')
    expect(a).not.toBe(b)
    expect(a).toMatch(/^ap-toast-\d+$/)
    expect(nextId('banner')).toMatch(/^ap-banner-\d+$/)
  })
})
