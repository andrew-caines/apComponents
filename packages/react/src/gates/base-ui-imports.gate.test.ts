import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sourceFiles } from './sourceFiles.js'

const SRC = join(import.meta.dirname, '..')
const require = createRequire(import.meta.url)

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
 *
 * The forbidden subpath list is DERIVED from the installed package's own
 * exports map rather than hand-listed. A hand-list can silently drift from
 * what the package actually ships — as of @base-ui/react@1.7.0 there is no
 * `./calendar`, `./date-picker`, or `./date-field` export at all; what it
 * ships instead is `./internals/temporal`, `./internals/temporal-adapter-date-fns`
 * (which pulls in `date-fns` directly) and `./internals/temporal-adapter-luxon`.
 * A hand-list that named the not-yet-shipped component paths would guard
 * nothing while missing the one import that actually imposes date-fns on
 * every consumer.
 */
const BASE_UI_PACKAGE_JSON = require.resolve('@base-ui/react/package.json') as string

interface BaseUiPackageJson {
  exports?: Record<string, unknown>
}

function readBaseUiExportKeys(): string[] {
  const pkg = JSON.parse(readFileSync(BASE_UI_PACKAGE_JSON, 'utf8')) as BaseUiPackageJson
  return Object.keys(pkg.exports ?? {})
    .filter((key) => key !== '.' && key !== './package.json')
    .map((key) => key.replace(/^\.\//, ''))
}

// Component names that don't exist yet in @base-ui/react's exports map but
// would be date-related if a future release added them.
const FUTURE_DATE_COMPONENT_NAMES = [
  'calendar',
  'date-field',
  'date-picker',
  'date-range-picker',
  'range-calendar',
  'time-field',
  'time-picker',
] as const
const FUTURE_DATE_COMPONENT_PATTERN = new RegExp(
  `(?:^|/)(?:${FUTURE_DATE_COMPONENT_NAMES.join('|')})(?:$|/)`,
  'i',
)

// `./internals/TimeoutManager` is a timeout utility, not date-related — it
// would false-positive on a naive /time/i pattern, so it is excluded
// explicitly rather than relying on FUTURE_DATE_COMPONENT_PATTERN's word
// boundaries alone to keep it out.
const EXCLUDED_PARTS = new Set(['internals/TimeoutManager'])

function deriveForbiddenParts(exportKeys: string[]): string[] {
  return exportKeys.filter(
    (part) => !EXCLUDED_PARTS.has(part) && (/temporal/i.test(part) || FUTURE_DATE_COMPONENT_PATTERN.test(part)),
  )
}

const EXPORT_KEYS = readBaseUiExportKeys()
const FORBIDDEN_PARTS = deriveForbiddenParts(EXPORT_KEYS)

describe('gate: the derived forbidden-part list is trustworthy', () => {
  // If Base UI ever renames or removes these subpaths, deriving from the
  // exports map could silently produce an empty FORBIDDEN_PARTS list — which
  // would make the gate below pass on every file, including one that imports
  // the date-fns adapter directly. This assertion is what turns that failure
  // mode into a loud one instead of a silent no-op.
  it('is non-empty and still contains the known date-fns-carrying adapter', () => {
    expect(FORBIDDEN_PARTS.length).toBeGreaterThan(0)
    expect(
      FORBIDDEN_PARTS,
      '@base-ui/react no longer exports ./internals/temporal-adapter-date-fns under a ' +
        'name this gate recognizes — the derivation must be updated, not silently pass',
    ).toContain('internals/temporal-adapter-date-fns')
    expect(
      FORBIDDEN_PARTS,
      '@base-ui/react no longer exports ./internals/temporal-adapter-luxon under a name ' +
        'this gate recognizes — the derivation must be updated, not silently pass',
    ).toContain('internals/temporal-adapter-luxon')
  })

  it('does not over-match the unrelated TimeoutManager export', () => {
    expect(EXPORT_KEYS).toContain('internals/TimeoutManager')
    expect(FORBIDDEN_PARTS).not.toContain('internals/TimeoutManager')
  })
})

describe('gate: no Base UI date part is imported', () => {
  // .ts and .tsx under all of src/, excluding gates/ (test infra, not
  // shipped code). Test files ARE included (includeTests: true) — a banned
  // import could land in a test file's fixture/mock code just as easily as
  // in shipped source, and there is no reason to give tests a blind spot
  // this gate doesn't give components.
  const files = sourceFiles(SRC, {
    extensions: ['.ts', '.tsx'],
    excludeDirs: ['gates'],
    includeTests: true,
  })

  it('finds sources to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    const rel = file.slice(SRC.length + 1).replace(/\\/g, '/')

    it(`${rel} imports no Base UI date part`, () => {
      const text = readFileSync(file, 'utf8')
      // The match must end at a path boundary (a closing quote/backtick OR a
      // `/` beginning a deeper subpath) rather than requiring the quote
      // immediately — otherwise '@base-ui/react/calendar/index.js' evades
      // detection by never having a quote right after "calendar".
      const hits = FORBIDDEN_PARTS.filter((part) =>
        new RegExp(`['"\`]@base-ui/react/${part}(?=['"\`/])`).test(text),
      )
      expect(
        hits,
        `${rel} imports @base-ui/react/${hits[0]} — that makes date-fns a required peer ` +
          'for every consuming product (ADR-0012 rejected a date dependency)',
      ).toEqual([])
    })
  }

  // Belt and braces: the checks above cover the transitive route (importing
  // Base UI's date-fns adapter). This covers the direct route — nothing in
  // @ap/react may depend on date-fns itself, regardless of where the import
  // comes from.
  for (const file of files) {
    const rel = file.slice(SRC.length + 1).replace(/\\/g, '/')

    it(`${rel} imports no date-fns package directly`, () => {
      const text = readFileSync(file, 'utf8')
      const hit = /['"\`](date-fns|@date-fns\/tz)(?=['"\`/])/.test(text)
      expect(
        hit,
        `${rel} imports date-fns or @date-fns/tz directly — ADR-0012 rejected a date ` +
          'dependency for every consuming product',
      ).toBe(false)
    })
  }
})
