import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const COMPONENTS = join(import.meta.dirname, '..', 'components')

/**
 * A user-facing string literal in a component is a gate failure, not a review
 * comment: components must read strings through the message registry so a
 * non-English product does not ship English ARIA (ADR-0012).
 *
 * We flag the ATTRIBUTES that reach assistive technology or the screen, because
 * those are the ones that must be translatable. Class names, data attributes and
 * token names are not user-facing and are not flagged.
 */
const USER_FACING_ATTRS = ['aria-label', 'aria-description', 'title', 'placeholder', 'alt'] as const

/**
 * A single quoted string, capturing its contents.
 */
const SINGLE_OR_DOUBLE_QUOTED = `(?:"([^"]*)"|'([^']*)')`

/**
 * A backtick template literal that contains NO `${...}` interpolation. A
 * template literal that interpolates a variable is the registry path working
 * (or at least not a bare hardcoded string); one that never interpolates
 * anything is exactly as hardcoded as a plain quoted string and must not
 * escape detection just because it uses backticks.
 */
const PLAIN_TEMPLATE_LITERAL = '`([^`$]*)`'

const STRING_LITERAL = `(?:${SINGLE_OR_DOUBLE_QUOTED}|${PLAIN_TEMPLATE_LITERAL})`

/**
 * Matches `attr="literal"`, `attr='literal'`, and `` attr=`literal` `` directly,
 * AND the same three forms wrapped in a JSX expression container —
 * `attr={"literal"}`, `attr={'literal'}`, `` attr={`literal`} `` — because JSX
 * happily accepts either form and a hardcoded string does not become
 * translatable by adding braces around it. A braced reference to a variable or
 * call expression (`attr={label}`, `attr={t('close')}`) matches neither
 * alternative and is correctly left alone — that is the registry path.
 */
function buildAttrPattern(attr: string): RegExp {
  return new RegExp(`${attr}\\s*=\\s*(?:\\{\\s*${STRING_LITERAL}\\s*\\}|${STRING_LITERAL})`, 'g')
}

/**
 * Runs every USER_FACING_ATTRS pattern against `text` and returns one
 * human-readable hit per match, e.g. `aria-label="Close"`. Shared between the
 * real-file scan below and the evasion-battery tests, so both exercise the
 * exact same detection logic rather than two regexes that could drift apart.
 */
function findHardcodedAttrs(text: string): string[] {
  const hits: string[] = []
  for (const attr of USER_FACING_ATTRS) {
    for (const m of text.matchAll(buildAttrPattern(attr))) {
      const value = m.slice(1).find((g) => g !== undefined) ?? ''
      hits.push(`${attr}="${value}"`)
    }
  }
  return hits
}

function componentSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return componentSources(p)
    return e.name.endsWith('.tsx') && !e.name.includes('.test.') && !e.name.includes('.stories.')
      ? [p]
      : []
  })
}

describe('gate: components take user-facing strings from the message registry', () => {
  const files = componentSources(COMPONENTS)

  it('finds component sources to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  // Proves the recursive walk actually reaches into subdirectories rather than
  // silently stopping at the top level — every real component lives one level
  // down (e.g. `components/Surface/Surface.tsx`), so if this ever regressed to
  // a flat `readdirSync` the gate would report "0 files" or miss every
  // component while still, misleadingly, passing.
  it('scans nested component directories, not just the top level', () => {
    expect(files.some((f) => f.includes(join('Surface', 'Surface.tsx')))).toBe(true)
  })

  for (const file of files) {
    const rel = file.slice(COMPONENTS.length + 1).replace(/\\/g, '/')

    it(`${rel} hardcodes no user-facing string`, () => {
      const text = readFileSync(file, 'utf8')
      const hits = findHardcodedAttrs(text)
      expect(
        hits,
        `${rel} hardcodes ${hits[0]} — read it from useMessages() so it can be translated`,
      ).toEqual([])
    })
  }
})

describe('gate: the detection regex itself catches known evasions', () => {
  // Each of these is a way a component could carry a hardcoded, user-facing
  // string while a naive `attr="literal"`-only scan reports clean. If any of
  // these stop matching, the gate can be defeated by a one-character edit
  // (switching quote style, adding braces, or switching to backticks) with no
  // change in behavior — exactly the kind of assertion-that-passes-under-the-
  // violation this project has burned time on before.
  const evasions: Array<[string, string]> = [
    ['double-quoted (baseline)', '<button aria-label="Close">'],
    ['single-quoted', "<button aria-label='Close'>"],
    ['braced double-quoted', '<button aria-label={"Close"}>'],
    ['braced single-quoted', "<button aria-label={'Close'}>"],
    ['bare template literal, no interpolation', '<button aria-label={`Close`}>'],
    ['extra internal whitespace', '<button aria-label = "Close">'],
    ['a different flagged attribute (title)', '<div title="Loading…">'],
    ['a different flagged attribute (placeholder)', '<input placeholder="Search" />'],
    ['a different flagged attribute (alt)', '<img alt="Company logo" />'],
    ['a different flagged attribute (aria-description)', '<div aria-description="Optional field">'],
  ]

  for (const [label, snippet] of evasions) {
    it(`flags: ${label}`, () => {
      expect(findHardcodedAttrs(snippet).length).toBeGreaterThan(0)
    })
  }

  const legitimate: Array<[string, string]> = [
    ['a bare variable reference', '<button aria-label={label}>'],
    ['a registry lookup', '<button aria-label={messages.close}>'],
    ['a function call', "<button aria-label={t('close')}>"],
    ['a template literal that interpolates', '<button aria-label={`${prefix} close`}>'],
    ['a non-user-facing attribute (className)', '<div className="Close">'],
    ['a non-user-facing attribute (data-*)', '<div data-label="Close">'],
  ]

  for (const [label, snippet] of legitimate) {
    it(`does not flag: ${label}`, () => {
      expect(findHardcodedAttrs(snippet)).toEqual([])
    })
  }
})
