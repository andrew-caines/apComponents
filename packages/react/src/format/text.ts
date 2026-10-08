import { formatNumber } from './number.js'
import { guard, isFiniteNumber, type LocaleOptions } from './shared.js'

export interface PersonName {
  given?: string | undefined
  family?: string | undefined
  displayName?: string | undefined
  order?: 'given-first' | 'family-first' | undefined
}

// Han, Hiragana, Katakana and Hangul names join without a space.
const CJK_ONLY = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+$/u

function firstGrapheme(text: string, locale: string): string {
  const first = new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(text)[Symbol.iterator]().next()
  return first.done ? '' : first.value.segment
}

/**
 * Order comes from the record, never the locale. Name particles ("van der")
 * are not interpreted: a limitation by design. When displayName is present,
 * both the display form and the initials come from it (first and last words),
 * so initials always match the name shown.
 */
export function formatName(
  name: PersonName | null | undefined,
  options: LocaleOptions & { form?: 'display' | 'initials' | undefined },
): string {
  return guard('formatName', name, name === null || name === undefined, () => {
    const { locale } = options
    const displayName = name!.displayName?.trim() ?? ''
    const given = name!.given?.trim() ?? ''
    const family = name!.family?.trim() ?? ''

    if (options.form === 'initials') {
      let words: string[]
      if (displayName) {
        const all = displayName.split(/\s+/)
        words = all.length > 1 ? [all[0]!, all[all.length - 1]!] : all
      } else {
        words = (name!.order === 'family-first' ? [family, given] : [given, family]).filter(Boolean)
      }
      return words.map((word) => firstGrapheme(word, locale).toLocaleUpperCase(locale)).join('')
    }

    if (displayName) return displayName
    const parts = (name!.order === 'family-first' ? [family, given] : [given, family]).filter(Boolean)
    const joiner = parts.length === 2 && parts.every((part) => CJK_ONLY.test(part)) ? '' : ' '
    return parts.join(joiner)
  })
}

export function formatList(
  items: readonly string[] | null | undefined,
  options: LocaleOptions & Intl.ListFormatOptions,
): string {
  return guard('formatList', items, items === null || items === undefined, () => {
    const { locale, ...rest } = options
    return new Intl.ListFormat(locale, rest).format(items!)
  })
}

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }

export function pluralize(
  count: number | null | undefined,
  forms: PluralForms,
  options: LocaleOptions & { type?: Intl.PluralRuleType | undefined },
): string {
  return guard('pluralize', count, !isFiniteNumber(count), () => {
    const { locale, type } = options
    const rule = new Intl.PluralRules(locale, type === undefined ? {} : { type }).select(count!)
    const template = forms[rule] ?? forms.other
    return template.split('{count}').join(formatNumber(count, { locale }))
  })
}

export function truncate(
  text: string | null | undefined,
  options: LocaleOptions & { length: number; ellipsis?: string | undefined },
): string {
  const bad = text === null || text === undefined || !isFiniteNumber(options.length)
  return guard('truncate', text, bad, () => {
    const { locale, length, ellipsis = '…' } = options
    if (length <= 0) return ''
    const graphemes = Array.from(
      new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(text!),
      (part) => part.segment,
    )
    if (graphemes.length <= length) return text!
    return graphemes.slice(0, length - 1).join('').trimEnd() + ellipsis
  })
}

export function collator(locale: string, options?: Intl.CollatorOptions): (a: string, b: string) => number {
  return new Intl.Collator(locale, options).compare
}
