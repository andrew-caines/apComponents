// Phone formatting on libphonenumber-js/min. Deliberately NOT exported from
// ./index.ts: the library is an optional peer, and only consumers who import
// the ./format/phone subpath should ever load it. The phone-isolation gate
// enforces that. Pure: no React, no client directive.
import { parsePhoneNumberFromString } from 'libphonenumber-js/min'
import type { CountryCode } from 'libphonenumber-js/min'
import { guard } from './shared.js'

export type PhoneFormat = 'national' | 'international' | 'E.164'

export interface PhoneOptions {
  format?: PhoneFormat | undefined
  /** ISO 3166-1 alpha-2 region used for numbers written without a leading +. */
  defaultCountry?: string | undefined
}

const STYLE = {
  national: 'NATIONAL',
  international: 'INTERNATIONAL',
  'E.164': 'E.164',
} as const

/**
 * Formats a phone number. Empty input gives ''. Input that cannot be parsed
 * gives the trimmed input (a supported outcome, so no warning).
 */
export function formatPhone(value: string | null | undefined, options: PhoneOptions = {}): string {
  const { format = 'international', defaultCountry } = options
  const text = typeof value === 'string' ? value.trim() : ''
  // Empty is a supported input with a defined result, so it is not warned about.
  if (value === null || value === undefined || value === '' || (typeof value === 'string' && text === '')) return ''
  return guard('formatPhone', value, typeof value !== 'string', () => {
    const parse = (country?: string) => {
      try {
        return parsePhoneNumberFromString(text, country as CountryCode | undefined)
      } catch {
        return undefined
      }
    }
    // An unknown default country must not hide a number that carries its own.
    const country = defaultCountry?.trim().toUpperCase()
    const parsed = (country ? parse(country) : undefined) ?? parse()
    return parsed ? parsed.format(STYLE[format]) : text
  })
}
