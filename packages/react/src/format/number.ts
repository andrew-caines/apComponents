import { guard, isFiniteNumber, type LocaleOptions } from './shared.js'

export type NumberFormatOptions = LocaleOptions & Intl.NumberFormatOptions

function intlOptions({ locale, ...rest }: NumberFormatOptions): [string, Intl.NumberFormatOptions] {
  return [locale, rest]
}

export function formatNumber(value: number | null | undefined, options: NumberFormatOptions): string {
  return guard('formatNumber', value, !isFiniteNumber(value), () => {
    const [locale, opts] = intlOptions(options)
    return new Intl.NumberFormat(locale, opts).format(value!)
  })
}

export function formatCurrency(
  value: number | null | undefined,
  options: NumberFormatOptions & { currency: string },
): string {
  return guard('formatCurrency', value, !isFiniteNumber(value), () => {
    const [locale, opts] = intlOptions(options)
    return new Intl.NumberFormat(locale, { ...opts, style: 'currency' }).format(value!)
  })
}

/** `value` is a ratio: 0.125 is 13%, or 12.5% with maximumFractionDigits: 1. */
export function formatPercent(value: number | null | undefined, options: NumberFormatOptions): string {
  return guard('formatPercent', value, !isFiniteNumber(value), () => {
    const [locale, opts] = intlOptions(options)
    return new Intl.NumberFormat(locale, { ...opts, style: 'percent' }).format(value!)
  })
}

export function formatPercentChange(
  previous: number | null | undefined,
  current: number | null | undefined,
  options: NumberFormatOptions,
): string {
  const bad = !isFiniteNumber(previous) || !isFiniteNumber(current) || previous === 0
  return guard('formatPercentChange', `${String(previous)} -> ${String(current)}`, bad, () => {
    const [locale, opts] = intlOptions(options)
    // Dividing by the base's magnitude keeps the sign meaningful for a
    // negative base: -50 to -25 is an increase.
    const ratio = (current! - previous!) / Math.abs(previous!)
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      signDisplay: 'exceptZero',
      maximumFractionDigits: 1,
      ...opts,
    }).format(ratio)
  })
}

export function formatCompact(value: number | null | undefined, options: NumberFormatOptions): string {
  return guard('formatCompact', value, !isFiniteNumber(value), () => {
    const [locale, opts] = intlOptions(options)
    return new Intl.NumberFormat(locale, { ...opts, notation: 'compact' }).format(value!)
  })
}

const EN: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' }
// French ordinal rules yield only one/other.
const FR: Record<string, string> = { one: 'er', other: 'e' }
const TRAILING_DOT = new Set([
  'de', 'da', 'nb', 'nn', 'no', 'fi', 'cs', 'sk', 'sl', 'hr', 'hu', 'et', 'lv', 'is', 'pl', 'tr',
])

export function formatOrdinal(value: number | null | undefined, options: LocaleOptions): string {
  const bad = !isFiniteNumber(value) || !Number.isInteger(value) || value < 0
  return guard('formatOrdinal', value, bad, () => {
    const { locale } = options
    const language = new Intl.Locale(locale).language
    const text = new Intl.NumberFormat(locale).format(value!)
    if (language === 'en') {
      return text + EN[new Intl.PluralRules(locale, { type: 'ordinal' }).select(value!)]!
    }
    if (language === 'fr') {
      return text + FR[value === 1 ? 'one' : 'other']!
    }
    return TRAILING_DOT.has(language) ? `${text}.` : text
  })
}

const BYTE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte', 'petabyte'] as const

export function formatBytes(
  value: number | null | undefined,
  options: LocaleOptions & { maximumFractionDigits?: number | undefined },
): string {
  return guard('formatBytes', value, !isFiniteNumber(value), () => {
    const digits = options.maximumFractionDigits ?? 1
    const sign = value! < 0 ? -1 : 1
    let scaled = Math.abs(value!)
    let index = 0
    while (index < BYTE_UNITS.length - 1 && scaled >= 1000) {
      scaled /= 1000
      index++
    }
    // Rounding can carry into the next unit (999.95 kB would print as
    // "1,000 kB"), so step up once more after rounding.
    const factor = 10 ** digits
    if (index < BYTE_UNITS.length - 1 && Math.round(scaled * factor) / factor >= 1000) {
      scaled /= 1000
      index++
    }
    return new Intl.NumberFormat(options.locale, {
      style: 'unit',
      unit: BYTE_UNITS[index]!,
      unitDisplay: index === 0 ? 'long' : 'short',
      maximumFractionDigits: digits,
    }).format(sign * scaled)
  })
}
