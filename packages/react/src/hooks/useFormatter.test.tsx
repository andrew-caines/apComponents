// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../providers/LocaleProvider.js'
import { useFormatter, type Formatter } from './useFormatter.js'

const V = Date.UTC(2026, 2, 5, 23, 30)

afterEach(() => {
  vi.restoreAllMocks()
})

function stubBrowserZone(zone: string) {
  const original = Intl.DateTimeFormat.prototype.resolvedOptions
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (
    this: Intl.DateTimeFormat,
  ) {
    return { ...original.call(this), timeZone: zone }
  })
}

let captured: Formatter | undefined
function Capture() {
  captured = useFormatter()
  return null
}
const f = () => captured!

describe('useFormatter inside a provider', () => {
  const wrap = (child: ReactNode) => (
    <LocaleProvider locale="de-DE" currency="EUR" timeZone="Asia/Tokyo">
      {child}
    </LocaleProvider>
  )

  it('binds the provider currency', () => {
    render(wrap(<Capture />))
    expect(f().formatCurrency(1234.5)).toBe('1.234,50\u00a0\u20ac')
  })

  it('honours the provider zone', () => {
    render(wrap(<Capture />))
    expect(f().formatDate(V)).toBe('06.03.2026')
    expect(f().timeZone).toBe('Asia/Tokyo')
    expect(f().locale).toBe('de-DE')
  })

  it('lets a per-call option win', () => {
    render(wrap(<Capture />))
    expect(f().formatDate(V, { timeZone: 'UTC' })).toBe('05.03.2026')
    expect(f().formatCurrency(5, { currency: 'USD' })).toBe('5,00\u00a0$')
  })

  it('an explicit undefined option keeps the bound default', () => {
    render(wrap(<Capture />))
    expect(f().formatDate(V, { timeZone: undefined })).toBe('06.03.2026')
    expect(f().formatCurrency(5, { currency: undefined })).toBe('5,00\u00a0\u20ac')
    expect(f().formatDate(V, { locale: undefined })).toBe('06.03.2026')
  })

  it('formatRelative takes the provider locale by default', () => {
    render(wrap(<Capture />))
    expect(f().formatRelative(V - 3 * 3600_000, { now: V })).toBe('vor 3 Stunden')
  })

  it('is referentially stable across a re-render with the same provider values', () => {
    const { rerender } = render(wrap(<Capture />))
    const first = f()
    rerender(wrap(<Capture />))
    expect(f(), 'the memo must key on locale, currency and zone only').toBe(first)
  })

  it('isoFor returns ISO text, or an empty string for an invalid input', () => {
    render(wrap(<Capture />))
    expect(f().isoFor('2026-03-05T14:30:00Z')).toBe('2026-03-05T14:30:00.000Z')
    expect(f().isoFor('nope')).toBe('')
  })
})

describe('useFormatter outside a provider', () => {
  it('throws the useLocale error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Capture />)).toThrow(
      'useLocale must be used inside <LocaleProvider> (or <ApProvider>).',
    )
  })
})

describe('the two-pass date rule', () => {
  let seen: string[] = []
  function Probe() {
    const { formatDate } = useFormatter()
    const text = formatDate(V)
    seen.push(text)
    return <span>{text}</span>
  }
  const withZone = (zone: string | undefined) =>
    zone === undefined ? (
      <LocaleProvider locale="en-US">
        <Probe />
      </LocaleProvider>
    ) : (
      <LocaleProvider locale="en-US" timeZone={zone}>
        <Probe />
      </LocaleProvider>
    )

  function hydrate(tree: ReactNode, html: string) {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onRecoverableError = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = html
    seen = []
    let root: ReturnType<typeof hydrateRoot> | undefined
    try {
      act(() => {
        root = hydrateRoot(container, tree, { onRecoverableError })
      })
      expect(onRecoverableError, 'no recoverable hydration error').not.toHaveBeenCalled()
      expect(errors.mock.calls.filter((c) => /hydrat|mismatch/i.test(c.map(String).join(' ')))).toEqual([])
      return { seen: [...seen], text: container.textContent }
    } finally {
      act(() => root?.unmount())
      container.remove()
    }
  }

  it('hydrates with UTC first, then the browser zone, with no mismatch', () => {
    stubBrowserZone('Asia/Tokyo')
    const html = renderToString(withZone(undefined))
    expect(html).toContain('Mar 5, 2026')
    const result = hydrate(withZone(undefined), html)
    expect(result.seen[0], 'the hydration pass must match the server (UTC)').toBe('Mar 5, 2026')
    expect(result.seen.at(-1)).toBe('Mar 6, 2026')
    expect(result.text).toBe('Mar 6, 2026')
  })

  it('the hydration pass ignores an explicit undefined timeZone even on a non-UTC host', () => {
    const savedTZ = process.env.TZ
    process.env.TZ = 'Asia/Tokyo'
    try {
      function ExplicitUndefined() {
        const { formatDate } = useFormatter()
        const text = formatDate(V, { timeZone: undefined })
        seen.push(text)
        return <span>{text}</span>
      }
      const tree = (
        <LocaleProvider locale="en-US">
          <ExplicitUndefined />
        </LocaleProvider>
      )
      const html = renderToString(tree)
      expect(html, 'the server pass must format in UTC, not the host zone').toContain('Mar 5, 2026')
      const result = hydrate(tree, html)
      expect(result.seen[0], 'the hydration pass must match the server (UTC)').toBe('Mar 5, 2026')
    } finally {
      if (savedTZ === undefined) delete process.env.TZ
      else process.env.TZ = savedTZ
    }
  })

  it('a client-only mount renders the browser zone on its first render', () => {
    stubBrowserZone('Asia/Tokyo')
    seen = []
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    try {
      act(() => root.render(withZone(undefined)))
      expect(
        seen[0],
        'a client-only mount has no server pass, so it must not flash UTC (useHydrated would)',
      ).toBe('Mar 6, 2026')
      expect(container.textContent).toBe('Mar 6, 2026')
    } finally {
      act(() => root.unmount())
      container.remove()
    }
  })

  it('with a provider zone, every render and the server HTML are already local', () => {
    stubBrowserZone('Asia/Tokyo')
    const html = renderToString(withZone('Asia/Tokyo'))
    expect(html).toContain('Mar 6, 2026')
    const result = hydrate(withZone('Asia/Tokyo'), html)
    expect(result.seen.length).toBeGreaterThan(0)
    expect(result.seen.every((s) => s === 'Mar 6, 2026')).toBe(true)
  })
})
