import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sourceFiles } from './sourceFiles.js'

const FORMAT_DIR = join(import.meta.dirname, '..', 'format')

// The format functions are pure: same input, same string, in a loader, in
// Node, on the server and in the browser. Each rule below is a way that
// stops being true. Text is scanned raw, comments included, like
// ssr-safety.gate.test.ts, so a rule is rephrased in prose rather than quoted.
const FORBIDDEN: Array<{ pattern: RegExp; why: string }> = [
  {
    pattern: /\bDate\.now\(/,
    why: 'reads the clock: the server and the browser disagree. Take `now` as an input instead',
  },
  {
    pattern: /new\s+Date\s*\(\s*\)/,
    why: 'a zero-argument Date is the current time, the same clock read as above',
  },
  {
    pattern: /\bperformance\.now\(/,
    why: 'a monotonic clock read: different on every call and every runtime',
  },
  {
    pattern: /\bMath\.random\(/,
    why: 'random output cannot match between server render and hydration',
  },
  {
    pattern: /(?:from|import)\s*\(?\s*['"]react(?:-dom)?(?:\/[^'"]*)?['"]/,
    why: 'format code must be usable outside React (loaders, Node scripts); hooks live in src/hooks',
  },
  {
    pattern: /['"]use client['"]/,
    why: 'a client directive turns these functions into client references that a server cannot call',
  },
]

describe('gate: src/format is deterministic and React-free', () => {
  // .ts only: format modules are plain functions. Tests are excluded by
  // sourceFiles (includeTests defaults to false) because they may stub the
  // environment on purpose.
  const files = sourceFiles(FORMAT_DIR, { extensions: ['.ts'] })

  it('finds format sources to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const { pattern, why } of FORBIDDEN) {
      it(`${file.split('src')[1]} does not match ${pattern}`, () => {
        expect(pattern.test(text), why).toBe(false)
      })
    }
  }
})
