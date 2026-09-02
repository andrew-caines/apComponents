import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')

/**
 * Base UI's date components (Calendar, DatePicker, DateField and friends)
 * require `date-fns` and `@date-fns/tz`. Those are OPTIONAL peers of
 * `@base-ui/react`, so they cost nothing while we never import them — but a
 * single import would make them required for every consuming product, which
 * ADR-0012 rejected outright ("a date dependency in every consuming product
 * is a large, opinionated, and difficult-to-remove commitment").
 *
 * This gate exists because that decision would otherwise be reversed by an
 * import statement nobody flagged in review.
 */
const FORBIDDEN_PARTS = [
  'calendar',
  'date-field',
  'date-picker',
  'date-range-picker',
  'range-calendar',
  'time-field',
  'time-picker',
] as const

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return e.name === 'gates' ? [] : sources(p)
    return e.name.endsWith('.ts') || e.name.endsWith('.tsx') ? [p] : []
  })
}

describe('gate: no Base UI date part is imported', () => {
  const files = sources(SRC)

  it('finds sources to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    const rel = file.slice(SRC.length + 1).replace(/\\/g, '/')

    it(`${rel} imports no Base UI date part`, () => {
      const text = readFileSync(file, 'utf8')
      const hits = FORBIDDEN_PARTS.filter((part) =>
        new RegExp(`['"\`]@base-ui/react/${part}['"\`]`).test(text),
      )
      expect(
        hits,
        `${rel} imports @base-ui/react/${hits[0]} — that makes date-fns a required peer ` +
          'for every consuming product (ADR-0012 rejected a date dependency)',
      ).toEqual([])
    })
  }
})
