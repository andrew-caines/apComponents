// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MESSAGES } from './messages.js'
import { LocaleProvider, useLocale, useMessages } from './LocaleProvider.js'

function Probe() {
  const { locale, currency } = useLocale()
  const m = useMessages()
  return <span data-testid="v">{`${locale}|${currency}|${m.close}|${m.loading}`}</span>
}

describe('LocaleProvider', () => {
  it('defaults to en-US / USD and the English messages', () => {
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )
    expect(screen.getByTestId('v').textContent).toBe('en-US|USD|Close|Loading…')
  })

  it('falls back per key, so a partial messages object is legal', () => {
    render(
      <LocaleProvider locale="de-DE" currency="EUR" messages={{ close: 'Schließen' }}>
        <Probe />
      </LocaleProvider>,
    )
    // `close` is overridden; `loading` falls back to English rather than
    // vanishing, because a missing key must never render as undefined.
    expect(screen.getByTestId('v').textContent).toBe('de-DE|EUR|Schließen|Loading…')
  })

  it('ignores an explicitly undefined override rather than blanking the string', () => {
    render(
      <LocaleProvider messages={{ close: undefined }}>
        <Probe />
      </LocaleProvider>,
    )
    expect(screen.getByTestId('v').textContent).toContain('|Close|')
  })

  it('does not auto-detect from navigator, which has no server equivalent', () => {
    const spy = vi.spyOn(navigator, 'language', 'get')
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )
    expect(spy, 'LocaleProvider read navigator.language').not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('throws by name when used with no provider', () => {
    expect(() => render(<Probe />)).toThrow(/LocaleProvider/)
  })

  it('exposes every default key as a typed constant', () => {
    expect(Object.keys(DEFAULT_MESSAGES).sort()).toEqual(
      ['close', 'dismiss', 'error', 'loading', 'noResults', 'optional', 'required'].sort(),
    )
  })
})
