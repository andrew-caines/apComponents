import { afterEach, describe, expect, it, vi } from 'vitest'
import { alert, announce, banner, confirm, toast } from './api.js'
import { subscribe, type NotificationEvent } from './channel.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('with no provider mounted', () => {
  it('confirm resolves false and warns once, naming confirm', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(confirm({ title: 'Sure?' })).resolves.toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('confirm')
  })

  it('alert resolves', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(alert({ title: 'Heads up' })).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('toast returns a string id and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const id = toast({ title: 'x' })
    expect(typeof id).toBe('string')
    // Fails if the emit result is not checked: nothing would warn.
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('toast')
  })

  it('toast.promise returns the caller promise unchanged and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const p = Promise.resolve(1)
    const out = toast.promise(p, { loading: 'a', success: 'b', error: 'c' })
    expect(out).toBe(p)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('announce warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    announce('hi')
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe('with a listener', () => {
  function listen() {
    const events: NotificationEvent[] = []
    const off = subscribe((e) => events.push(e))
    return { events, off }
  }

  it('toast.error emits a toast event with severity error and no warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { events, off } = listen()
    const id = toast.error('x')
    off()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'toast', options: { title: 'x', severity: 'error', id } })
    expect(warn).not.toHaveBeenCalled()
  })

  it('a shortcut object form keeps its fields and fixes the severity', () => {
    const { events, off } = listen()
    toast.success({ title: 'y', description: 'd' })
    off()
    expect(events[0]).toMatchObject({
      options: { title: 'y', description: 'd', severity: 'success' },
    })
  })

  it('a caller id is kept', () => {
    const { events, off } = listen()
    expect(toast({ title: 'x', id: 'mine' })).toBe('mine')
    off()
    expect(events[0]).toMatchObject({ options: { id: 'mine' } })
  })

  it('toast.close() emits toast-close with no id', () => {
    const { events, off } = listen()
    toast.close()
    off()
    expect(events).toEqual([{ kind: 'toast-close' }])
  })

  it('toast.promise emits a toast-promise event and returns the caller promise', () => {
    const { events, off } = listen()
    const p = Promise.resolve(1)
    expect(toast.promise(p, { loading: 'a', success: 'b', error: 'c' })).toBe(p)
    off()
    expect(events[0]).toMatchObject({ kind: 'toast-promise', promise: p })
  })

  it('banner().close() emits banner-close with the banner id', () => {
    const { events, off } = listen()
    const b = banner({ title: 'x' })
    b.close()
    off()
    expect(events[0]).toMatchObject({ kind: 'banner', options: { id: b.id } })
    // Fails if close() emits a different id or nothing.
    expect(events[1]).toEqual({ kind: 'banner-close', id: b.id })
  })

  it('confirm emits a dialog request whose resolve settles the promise', async () => {
    const { events, off } = listen()
    const result = confirm({ title: 'Sure?' })
    off()
    const event = events[0]
    if (event?.kind !== 'dialog' || event.request.type !== 'confirm') throw new Error('no dialog')
    event.request.resolve(true)
    await expect(result).resolves.toBe(true)
  })

  it('announce defaults to polite', () => {
    const { events, off } = listen()
    announce('hi')
    announce('bad', { politeness: 'assertive' })
    off()
    expect(events).toEqual([
      { kind: 'announce', message: 'hi', politeness: 'polite' },
      { kind: 'announce', message: 'bad', politeness: 'assertive' },
    ])
  })
})
