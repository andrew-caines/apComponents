import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const COMPONENTS = join(import.meta.dirname, '../components')
const PROVIDERS = join(import.meta.dirname, '../providers')

// ThemeScript deliberately does not carry 'use client': it renders a raw
// <script> and holds no state, so it is usable from a server entry
// (ADR-0005/0009). Every other provider module owns state or touches
// browser-only APIs from effects/callbacks and must be a client module,
// exactly like every component.
const THEME_SCRIPT_PATH = join(PROVIDERS, 'ThemeScript.tsx')

function tsxModules(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return tsxModules(p)
    const isModule =
      e.name.endsWith('.tsx') && !e.name.includes('.test.') && !e.name.includes('.stories.')
    return isModule ? [p] : []
  })
}

describe('gate: every component and provider module is a client module (ADR-0005)', () => {
  const files = [...tsxModules(COMPONENTS), ...tsxModules(PROVIDERS)].filter(
    (f) => f !== THEME_SCRIPT_PATH,
  )

  it('finds component/provider modules to check', () => {
    expect(files.length).toBeGreaterThan(0)
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
