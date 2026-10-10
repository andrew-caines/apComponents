import { guard } from './shared.js'

// Walks the string and replaces every maskable character except the last
// `keep` maskable ones with '*'. Every other character passes through, so the
// output is the same length as the input. A value with no more than `keep`
// maskable characters is masked entirely: showing it whole would defeat the mask.
function maskKeepingLast(value: string, keep: number, isMaskable: (char: string) => boolean): string {
  const chars = Array.from(value)
  const total = chars.filter(isMaskable).length
  const maskUntil = total <= keep ? total : total - keep
  let seen = 0
  return chars
    .map((char) => {
      if (!isMaskable(char)) return char
      seen += 1
      return seen <= maskUntil ? '*' : char
    })
    .join('')
}

// Unicode-aware: full-width and Arabic-Indic digits and accented letters are
// as sensitive as their ASCII forms. maskKeepingLast iterates by code point.
const isDigit = (char: string): boolean => /\p{Nd}/u.test(char)
const isAlphanumeric = (char: string): boolean => /[\p{L}\p{N}]/u.test(char)

/** Keeps the first character of the local part and the whole domain. The last '@' splits. */
export function maskEmail(value: string | null | undefined): string {
  const at = typeof value === 'string' ? value.lastIndexOf('@') : -1
  const bad = typeof value !== 'string' || at <= 0 || at === value.length - 1
  return guard('maskEmail', value, bad, () => {
    const local = value!.slice(0, at)
    const domain = value!.slice(at)
    const first = Array.from(local)[0]!
    const rest = Array.from(local).length - 1
    return (rest === 0 ? '*' : first + '*'.repeat(rest)) + domain
  })
}

// An extension is a marker (`;ext=`, `ext`, `ext.`, `x` or `#`, any case) followed by
// digits at the very end. The leftmost possible marker wins, so `;ext=` is taken
// whole rather than matching its `x`.
const EXTENSION = /(;ext=|\s*(?:ext\.?|x|#)\s*)(\p{Nd}+)$/iu

/**
 * Keeps the last four digits of the main number; separators, spaces, '+' and
 * parentheses pass through. An extension is masked in full and never counts
 * toward the four.
 */
export function maskPhone(value: string | null | undefined): string {
  return guard('maskPhone', value, typeof value !== 'string' || value === '', () => {
    const match = EXTENSION.exec(value!)
    if (!match) return maskKeepingLast(value!, 4, isDigit)
    const main = value!.slice(0, match.index)
    return maskKeepingLast(main, 4, isDigit) + match[1] + '*'.repeat(Array.from(match[2]!).length)
  })
}

/** Keeps the last four digits; spaces and dashes pass through. */
export function maskCardNumber(value: string | null | undefined): string {
  return guard('maskCardNumber', value, typeof value !== 'string' || value === '', () =>
    maskKeepingLast(value!, 4, isDigit),
  )
}

// Per-country tax-ID display rules (spec section 5.5.2, researched 2026-10-08).
// Each country's convention is cited; a country is added only with a source.
//
// Cited, equal to the generic last-four rule (so no entry is coded):
// - US (SSN, ITIN, ATIN, EIN). Strength: law. 26 CFR 301.6109-4(a), truncated
//   taxpayer identifying numbers: the number "in which the first five digits of
//   the nine-digit number are replaced with Xs or asterisks"
//   (https://www.law.cornell.edu/cfr/text/26/301.6109-4). Output: ***-**-1234,
//   EIN **-***1234.
// - IN (Aadhaar). Strength: regulation + guidance. Aadhaar (Sharing of
//   Information) Regulations 2016, reg. 6(1): the number "shall not be
//   published, displayed or posted publicly", and 6(3) permits databases only
//   where numbers are "redacted or blacked out"
//   (https://www.uidai.gov.in/images/The_Aadhaar_Sharing_of_information_regulation_2016.pdf).
//   The last-four format is UIDAI's "Masked Aadhaar" FAQ, read via search
//   results only (the page returned 404 when fetched). The regulation gives no
//   digit count. Output: **** **** 1234.
// - SG (NRIC, FIN). Strength: guidance. PDPC Advisory Guidelines on the PDPA for
//   NRIC and Other National Identification Numbers (31 Aug 2018) para 5.2, and
//   the PDPC Technical Guide ("masked NRIC number (only showing last three
//   digits + last alphabet)"). A December 2024 notice says the guidelines will
//   be updated. Output *****567A is the generic last-four rule on a
//   nine-character NRIC; the row exists to cite that the fallback is compliant.
//
// Cited, differs from the generic rule (coded below):
// - CA (SIN). Strength: official guidance by analogy, not a display regulation.
//   ESDC, "SIN fraud and data breaches" (page dated 2026-05-13) accepts "your
//   full SIN or last 3 digits of your SIN" on police reports and credit
//   documents
//   (https://www.canada.ca/en/employment-social-development/services/sin/fraud-data-breaches.html).
//   ESDC's "SIN Code of Practice"
//   (https://www.canada.ca/en/employment-social-development/services/sin/reports/code-of-practice.html)
//   was checked and covers storage and disposal only, with no display rule.
//   Output: ***-***-789, so the middle group of a 3-3-3 SIN is never partly shown.
//
// Uncited, so the generic last-four fallback: GB (NINO, UTR), IE (PPSN), AU (TFN;
// the Privacy (TFN) Rule 2015 covers handling, no display rule found), NZ (IRD
// number), DE (Steuer-ID), FR (NIR; CNIL addresses use, not partial display), NL
// (BSN; enforcement is about not processing it), JP (My Number; Art. 19
// restricts provision, and arguably it should not be displayed at all), and
// India's PAN. The fallback shows the last four characters and masks every
// other alphanumeric, keeping separators.
//
// A country is added only with a source.
const KEEP_BY_COUNTRY: Readonly<Record<string, number>> = { CA: 3 }
const DEFAULT_KEEP = 4

/** Masks a tax ID per the country table above; unknown or blank countries use the last-four rule. */
export function maskTaxId(value: string | null | undefined, country: string): string {
  return guard('maskTaxId', value, typeof value !== 'string' || value === '', () => {
    const code = typeof country === 'string' ? country.trim().toUpperCase() : ''
    const keep = Object.hasOwn(KEEP_BY_COUNTRY, code) ? KEEP_BY_COUNTRY[code]! : DEFAULT_KEEP
    return maskKeepingLast(value!, keep, isAlphanumeric)
  })
}
