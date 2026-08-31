import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const COMPONENTS = join(import.meta.dirname, '../components')

function componentModules(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return componentModules(p)
    const isComponent =
      e.name.endsWith('.tsx') && !e.name.includes('.test.') && !e.name.includes('.stories.')
    return isComponent ? [p] : []
  })
}

describe('gate: every component module is a client module (ADR-0005)', () => {
  const files = componentModules(COMPONENTS)

  it('finds component modules to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    it(`${file.split('components')[1]} starts with 'use client'`, () => {
      const first = readFileSync(file, 'utf8').trimStart().split('\n')[0]!.trim()
      expect(first).toBe("'use client'")
    })
  }
})
