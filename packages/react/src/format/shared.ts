// Shared helpers for the format functions. Pure: no React, no client
// directive, no clock reads. The determinism gate enforces that for this
// whole directory.

export type DateInput = Date | number | string

export interface LocaleOptions {
  locale: string
}

export interface ZonedOptions extends LocaleOptions {
  timeZone: string
}

/** Milliseconds since the epoch, or undefined when the input is not a valid instant. */
export function toTimestamp(value: DateInput | null | undefined): number | undefined {
  // Not a truthiness check: the epoch (0) is a valid instant.
  if (value === null || value === undefined) return undefined
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(ms) ? ms : undefined
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

// Names already warned about. Module scope on purpose: one warning per
// formatter for the life of the page, not one per call in a render loop.
const warned = new Set<string>()

/** Clears the warn-once registry. For tests only; not exported from the barrel. */
export function resetFormatWarningsForTests(): void {
  warned.clear()
}

export function warnOnce(name: string, value: unknown, reason: string, outcome = 'returning an empty string'): void {
  // A bare process.env.NODE_ENV check, never guarded by a typeof check on
  // process: that is the reference bundlers replace (see
  // components/Select/Select.tsx for why).
  if (process.env.NODE_ENV === 'production' || warned.has(name)) return
  warned.add(name)
  let shown: string
  try {
    shown = String(value)
  } catch {
    shown = Object.prototype.toString.call(value)
  }
  console.warn(`[@ap/react/format] ${name}: ${reason} (${shown}); ${outcome}.`)
}

/**
 * Runs `fn`; returns '' if it throws or if `bad` is true. In development,
 * warns once per formatter name with the offending value.
 */
export function guard(name: string, value: unknown, bad: boolean, fn: () => string): string {
  if (bad) {
    warnOnce(name, value, 'invalid input')
    return ''
  }
  try {
    return fn()
  } catch (error) {
    // Intl throws RangeError for a malformed locale or an unknown time zone.
    warnOnce(name, value, error instanceof Error ? error.message : 'formatting failed')
    return ''
  }
}
