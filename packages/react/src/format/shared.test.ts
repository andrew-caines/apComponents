import { beforeEach, describe, expect, it, vi } from 'vitest'
import { guard, resetFormatWarningsForTests, toTimestamp } from './shared.js'

const T = Date.UTC(2026, 2, 5, 14, 30)

describe('toTimestamp', () => {
  it('reads a Date', () => {
    expect(toTimestamp(new Date(T))).toBe(T)
  })
  it('parses an ISO string', () => {
    expect(toTimestamp('2026-03-05T14:30:00Z')).toBe(T)
  })
  it('treats the epoch as a valid instant, not as falsy', () => {
    expect(toTimestamp(0)).toBe(0)
  })
  it.each([
    ['unparseable string', 'not a date'],
    ['NaN', NaN],
    ['null', null],
    ['undefined', undefined],
    ['invalid Date', new Date('x')],
  ])('returns undefined for %s', (_label, value) => {
    expect(toTimestamp(value as never)).toBeUndefined()
  })
})

describe('guard', () => {
  beforeEach(() => {
    resetFormatWarningsForTests()
    vi.restoreAllMocks()
  })

  it('returns the result of fn', () => {
    expect(guard('f', 1, false, () => 'ok')).toBe('ok')
  })

  it("returns '' without calling fn when bad", () => {
    const fn = vi.fn(() => 'ok')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(guard('f', 1, true, fn)).toBe('')
    expect(fn).not.toHaveBeenCalled()
  })

  it("returns '' when fn throws", () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      guard('f', 1, false, () => {
        throw new RangeError()
      }),
    ).toBe('')
  })

  it('warns once per formatter name, naming the formatter and the value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    guard('g', 'oops', true, () => 'ok')
    guard('g', 'oops', true, () => 'ok')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]![0])).toContain('g')
    expect(String(warn.mock.calls[0]![0])).toContain('oops')
    guard('h', 'again', true, () => 'ok')
    expect(warn).toHaveBeenCalledTimes(2)
  })
})
