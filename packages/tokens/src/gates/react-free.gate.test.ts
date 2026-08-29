import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')

function allSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return allSourceFiles(p)
    return e.name.endsWith('.ts') && !e.name.includes('.test.') && !e.name.includes('.gate.') ? [p] : []
  })
}

describe('ADR-0001: @ap/tokens is React-free and dependency-free', () => {
  it('package.json declares no dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(SRC, '../package.json'), 'utf8'))
    expect(pkg.dependencies).toBeUndefined()
    expect(pkg.peerDependencies).toBeUndefined()
  })
  it('no source file imports react, DOM, or node builtins', () => {
    for (const file of allSourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8')
      expect(text, file).not.toMatch(/from ['"]react['"]/)
      expect(text, file).not.toMatch(/from ['"]node:/)
      expect(text, file).not.toMatch(/\b(document|window)\./)
    }
  })
})
