import { readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sourceFiles } from './sourceFiles.js'

const SRC = join(import.meta.dirname, '..')
const POLYFILL = '@js-temporal/polyfill'

// Same specifier forms as phone-isolation.gate.test.ts: from, side-effect and dynamic imports.
const SPECIFIER_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g
const importsPolyfill = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(SPECIFIER_RE)].some((m) => m[1]!.startsWith(POLYFILL))

describe('gate: the Temporal polyfill is test-only (spec decision 1: the app brings Temporal)', () => {
  it('scans the library sources (non-vacuity)', () => {
    const files = sourceFiles(SRC, { extensions: ['.ts', '.tsx'] }).map((f) => relative(SRC, f).split(sep).join('/'))
    expect(files).toContain('format/date.ts')
    expect(files).toContain('format/shared.ts')
  })

  it('tests do import it, so the scan would see one (non-vacuity)', () => {
    const tests = sourceFiles(SRC, { extensions: ['.ts', '.tsx'], includeTests: true }).filter(importsPolyfill)
    expect(tests.length).toBeGreaterThan(0)
  })

  // Perturbation: add an import of the polyfill to format/date.ts.
  it('no non-test source file imports @js-temporal/polyfill', () => {
    const importers = sourceFiles(SRC, { extensions: ['.ts', '.tsx'] })
      .filter(importsPolyfill)
      .map((f) => relative(SRC, f).split(sep).join('/'))
    expect(importers).toEqual([])
  })
})
