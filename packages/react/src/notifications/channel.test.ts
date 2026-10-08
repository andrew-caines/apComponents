import { describe, expect, it, vi } from 'vitest'
import { emit, nextId, subscribe } from './channel.js'

describe('channel', () => {
  describe('duplicate subscriber warning', () => {
    // The flag is module-level, so each case loads a fresh copy of the module.
    async function fresh() {
      vi.resetModules()
      return import('./channel.js')
    }

    it('warns once when a second listener subscribes while the first is live (fails if the size check is dropped or it warns every time)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { subscribe: sub } = await fresh()
      const offs = [sub(vi.fn()), sub(vi.fn()), sub(vi.fn())]
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]![0])).toContain('separate trees')
      for (const off of offs) off()
      warn.mockRestore()
    })

    it("stays silent for StrictMode's subscribe, unsubscribe, subscribe replay (fails if the warning keys on subscribe count, not live listeners)", async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { subscribe: sub } = await fresh()
      const first = sub(vi.fn())
      first()
      const second = sub(vi.fn())
      expect(warn).not.toHaveBeenCalled()
      second()
      warn.mockRestore()
    })
  })

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
