import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Scan the whole of src/ rather than an allowlist of directories. An
// allowlist has to be widened by hand every time a directory is added, and
// whoever adds one has no reason to think about this file — `src/icons/`
// landed outside the scan exactly that way. A denylist means a new directory
// is covered the day it appears, and the only thing anyone must remember is
// to justify an exclusion.
const SRC = join(import.meta.dirname, '..')

// gates/ is test infrastructure, not shipped runtime code.
const EXCLUDED_DIRS = new Set(['gates'])

// ThemeScript deliberately does not carry 'use client': it renders a raw
// <script> and holds no state, so it is usable from a server entry
// (ADR-0005/0009). Every other provider module owns state or touches
// browser-only APIs from effects/callbacks and must be a client module,
// exactly like every component.
const THEME_SCRIPT_PATH = join(SRC, 'providers', 'ThemeScript.tsx')

function tsxModules(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return EXCLUDED_DIRS.has(e.name) ? [] : tsxModules(p)
    const isModule =
      e.name.endsWith('.tsx') && !e.name.includes('.test.') && !e.name.includes('.stories.')
    return isModule ? [p] : []
  })
}

describe('gate: every shipped .tsx module is a client module (ADR-0005)', () => {
  const files = tsxModules(SRC).filter((f) => f !== THEME_SCRIPT_PATH)

  it('finds modules to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('reaches every top-level source directory, not just the ones it started with', () => {
    // The allowlist this replaced covered components/ and providers/ only, so
    // icons/ was unscanned from the day it was created. Naming the directories
    // found keeps that regression visible: if a future directory of modules
    // stops being reached, this fails rather than quietly scanning less.
    const dirs = new Set(files.map((f) => f.slice(SRC.length + 1).split(/[\\/]/)[0]))
    expect([...dirs].sort()).toEqual(['components', 'icons', 'providers'])
  })

  for (const file of files) {
    it(`${file.split('src')[1]} starts with 'use client'`, () => {
      const first = readFileSync(file, 'utf8').trimStart().split('\n')[0]!.trim()
      expect(first).toBe("'use client'")
    })
  }

  it('ThemeScript.tsx still exists, so its exemption is not stale config for a moved/renamed file', () => {
    expect(existsSync(THEME_SCRIPT_PATH)).toBe(true)
  })
})
