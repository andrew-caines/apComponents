import { describe, expect, it } from 'vitest'
import { toBaseToast, toPromiseOptions } from './severity.js'
import type { NotificationSeverity } from './types.js'

const PRIORITY: Record<NotificationSeverity, 'low' | 'high'> = {
  info: 'low',
  success: 'low',
  warning: 'low',
  error: 'high',
}

describe('toBaseToast', () => {
  for (const severity of ['info', 'success', 'warning', 'error'] as const) {
    it(`${severity} sets type to the severity and the right priority`, () => {
      const out = toBaseToast({ title: 't', severity })
      expect(out.type).toBe(severity)
      // Fails if priority is not derived from severity (e.g. always 'low').
      expect(out.priority).toBe(PRIORITY[severity])
    })
  }

  it('defaults to info', () => {
    expect(toBaseToast({ title: 't' }).type).toBe('info')
  })

  it('error is never auto-dismissed, even when the caller gives a timeout', () => {
    // Fails if the caller's timeout is allowed to win for errors.
    expect(toBaseToast({ title: 't', severity: 'error', timeout: 9000 }).timeout).toBe(0)
  })

  it('a non-error honours the caller timeout and defaults to 5000', () => {
    expect(toBaseToast({ title: 't', severity: 'info', timeout: 9000 }).timeout).toBe(9000)
    expect(toBaseToast({ title: 't', severity: 'info' }).timeout).toBe(5000)
  })

  it('maps an action to actionProps', () => {
    const onClick = () => {}
    // Fails if the label is not passed as `children` or onClick is dropped.
    expect(toBaseToast({ title: 't', action: { label: 'Undo', onClick } }).actionProps).toEqual({
      children: 'Undo',
      onClick,
    })
  })

  it('omits id and description when absent, and carries them when present', () => {
    expect('id' in toBaseToast({ title: 't' })).toBe(false)
    expect(toBaseToast({ title: 't', id: 'x', description: 'd' })).toMatchObject({
      id: 'x',
      description: 'd',
    })
  })
})

describe('toPromiseOptions', () => {
  it('maps a string to { title }, not a description', () => {
    const out = toPromiseOptions({ loading: 'Saving', success: 'Saved', error: 'Failed' })
    // Fails if the string is passed through (Base UI would make it a description).
    expect(out.loading).toEqual({ title: 'Saving' })
    expect(out.success).toMatchObject({ title: 'Saved', type: 'success' })
  })

  it('drops an explicit undefined description from the loading branch', () => {
    const out = toPromiseOptions({
      loading: { title: 'Saving', description: undefined },
      success: 'Saved',
      error: 'Failed',
    })
    // Fails if the loading branch passes its rest through, key and all, to Base UI.
    expect(Object.keys(out.loading as object)).toEqual(['title'])
  })

  it('forces the error branch to priority high and timeout 0 for a string', () => {
    const out = toPromiseOptions({ loading: 'a', success: 'b', error: 'Failed' })
    expect(out.error).toMatchObject({ title: 'Failed', type: 'error', priority: 'high', timeout: 0 })
  })

  it('forces the error branch for an object, ignoring its severity and timeout', () => {
    const out = toPromiseOptions({
      loading: 'a',
      success: 'b',
      error: { title: 'Failed', severity: 'info', timeout: 9000 },
    })
    expect(out.error).toMatchObject({ type: 'error', priority: 'high', timeout: 0 })
  })

  it('forces the error branch for a function', () => {
    const out = toPromiseOptions({
      loading: 'a',
      success: 'b',
      error: (e) => `Failed: ${String(e)}`,
    })
    // Fails if only the object form is mapped.
    expect(typeof out.error).toBe('function')
    const resolved = (out.error as (e: unknown) => unknown)('boom')
    expect(resolved).toMatchObject({
      title: 'Failed: boom',
      type: 'error',
      priority: 'high',
      timeout: 0,
    })
  })

  it('maps the success function with the resolved value', () => {
    const out = toPromiseOptions<number>({
      loading: 'a',
      success: (n) => ({ title: `Got ${n}` }),
      error: 'e',
    })
    expect((out.success as (n: number) => unknown)(3)).toMatchObject({
      title: 'Got 3',
      type: 'success',
    })
  })
})
