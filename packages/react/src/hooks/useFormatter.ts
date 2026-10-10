'use client'

import { useMemo, useSyncExternalStore } from 'react'
import {
  collator,
  formatAddress,
  formatBytes,
  formatCompact,
  formatCurrency,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatDuration,
  formatList,
  formatName,
  formatNumber,
  formatOrdinal,
  formatPercent,
  formatPercentChange,
  formatRelative,
  formatTime,
  pluralize,
  truncate,
} from '../format/index.js'
import type {
  DateFormatOptions,
  DateInput,
  NumberFormatOptions,
  PluralForms,
  RelativeOptions,
} from '../format/index.js'
import { useLocale } from '../providers/LocaleProvider.js'

/** `formatX` bound to the provider: the locale (and zone, currency) is already filled in. */
type Loose<O> = { [K in keyof O]?: O[K] | undefined }
type Bound<F> = F extends (value: infer V, options: infer O) => string
  ? (value: V, options?: Loose<O>) => string
  : never

// Drops keys whose value is undefined, so an explicit `{ timeZone: undefined }`
// falls back to the bound default instead of overwriting it. Every key comes
// back optional, and `O[K] & ({} | null)` is what `!== undefined` narrows a
// value to, so the loop needs no cast. A caller re-adds a required key
// (`now`, `length`) after the spread.
type Defined<O> = { [K in keyof O]?: O[K] & ({} | null) }
function defined<O extends object>(options: O | undefined): Defined<O> {
  const out: Defined<O> = {}
  if (options === undefined) return out
  for (const key in options) {
    if (!Object.hasOwn(options, key)) continue
    const value = options[key]
    if (value !== undefined) out[key] = value
  }
  return out
}

export interface Formatter {
  locale: string
  /** The zone dates render in right now: the provider's, else UTC until hydrated, then the browser's. */
  timeZone: string
  /**
   * A date-only ISO string such as '1990-05-12' is UTC midnight (ECMAScript), so
   * in a zone west of UTC it shows the previous day. To render a calendar date
   * (a birthday, a hire date), pass `timeZone: 'UTC'`.
   */
  formatDate: Bound<typeof formatDate>
  formatTime: Bound<typeof formatTime>
  formatDateTime: Bound<typeof formatDateTime>
  formatDateRange: (start: DateInput, end: DateInput, options?: Loose<DateFormatOptions>) => string
  formatRelative: (value: DateInput, options: Omit<RelativeOptions, 'locale'> & { locale?: string | undefined }) => string
  formatDuration: Bound<typeof formatDuration>
  formatNumber: Bound<typeof formatNumber>
  formatCurrency: (value: number, options?: Loose<NumberFormatOptions> & { currency?: string | undefined }) => string
  formatPercent: Bound<typeof formatPercent>
  formatPercentChange: (previous: number, current: number, options?: Loose<NumberFormatOptions>) => string
  formatCompact: Bound<typeof formatCompact>
  formatOrdinal: Bound<typeof formatOrdinal>
  formatBytes: Bound<typeof formatBytes>
  formatName: Bound<typeof formatName>
  formatList: Bound<typeof formatList>
  formatAddress: Bound<typeof formatAddress>
  pluralize: (count: number, forms: PluralForms, options?: { type?: Intl.PluralRuleType | undefined }) => string
  truncate: (text: string, options: { length: number; ellipsis?: string | undefined }) => string
  collator: (options?: Intl.CollatorOptions) => (a: string, b: string) => number
  /** For `<time dateTime={isoFor(value)}>`; '' for an invalid input. */
  isoFor: (value: DateInput) => string
}

const noopSubscribe = () => () => {}

/**
 * Formatters bound to the nearest `LocaleProvider`.
 *
 * Dates follow ADR-0012's two-pass rule. With no provider `timeZone` the
 * server and the hydration pass render in UTC, then the browser's zone takes
 * over, so the markup matches and the reader still ends on local time. A mount
 * that has no server pass (a client-side navigation) is local from its first
 * render. Wrap any date output in `<time dateTime={isoFor(value)}>` so the
 * instant stays machine-readable while the visible text changes zone.
 *
 * Per-call options win over the bound defaults, including `locale`, `timeZone`
 * and `currency`.
 */
export function useFormatter(): Formatter {
  const { locale, timeZone: provided, currency } = useLocale()
  // False only while hydrating (React uses the server snapshot), true for every
  // later client render, including a client-only mount. Not `useHydrated`,
  // whose effect-driven flip would flash UTC on every client-side navigation.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  const timeZone = provided ?? (hydrated ? new Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC')

  return useMemo<Formatter>(() => {
    const L = { locale }
    const Z = { locale, timeZone }
    return {
      locale,
      timeZone,
      formatDate: (v, o) => formatDate(v, { ...Z, ...defined(o) }),
      formatTime: (v, o) => formatTime(v, { ...Z, ...defined(o) }),
      formatDateTime: (v, o) => formatDateTime(v, { ...Z, ...defined(o) }),
      formatDateRange: (a, b, o) => formatDateRange(a, b, { ...Z, ...defined(o) }),
      formatRelative: (v, o) => formatRelative(v, { ...L, ...defined(o), now: o?.now }),
      formatDuration: (v, o) => formatDuration(v, { ...L, ...defined(o) }),
      formatNumber: (v, o) => formatNumber(v, { ...L, ...defined(o) }),
      formatCurrency: (v, o) => formatCurrency(v, { ...L, currency, ...defined(o) }),
      formatPercent: (v, o) => formatPercent(v, { ...L, ...defined(o) }),
      formatPercentChange: (p, c, o) => formatPercentChange(p, c, { ...L, ...defined(o) }),
      formatCompact: (v, o) => formatCompact(v, { ...L, ...defined(o) }),
      formatOrdinal: (v, o) => formatOrdinal(v, { ...L, ...defined(o) }),
      formatBytes: (v, o) => formatBytes(v, { ...L, ...defined(o) }),
      formatName: (v, o) => formatName(v, { ...L, ...defined(o) }),
      formatList: (v, o) => formatList(v, { ...L, ...defined(o) }),
      formatAddress: (v, o) => formatAddress(v, { ...L, ...defined(o) }),
      pluralize: (n, forms, o) => pluralize(n, forms, { ...L, ...defined(o) }),
      truncate: (t, o) => truncate(t, { ...L, ...defined(o), length: o?.length }),
      collator: (o) => collator(locale, o),
      isoFor: (v) => {
        const ms = v instanceof Date ? v.getTime() : new Date(v).getTime()
        return Number.isFinite(ms) ? new Date(ms).toISOString() : ''
      },
    }
  }, [locale, currency, timeZone])
}

