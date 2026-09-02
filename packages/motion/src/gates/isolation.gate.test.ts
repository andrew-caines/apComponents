import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return e.name === 'gates' ? [] : sources(p)
    return e.name.endsWith('.ts') && !e.name.includes('.test.') ? [p] : []
  })
}

// ADR-0001: @ap/motion depends on @ap/tokens and nothing else. Its output is
// consumed by build tooling and by the browser, never by Node at runtime.
const FORBIDDEN: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /from ['"]react['"]/, why: '@ap/motion must not depend on React' },
  { pattern: /from ['"]react-dom/, why: '@ap/motion must not depend on react-dom' },
  { pattern: /from ['"]motion/, why: 'Motion is a Phase 4 concern; this package emits data only' },
  { pattern: /from ['"]node:/, why: 'no Node built-ins in emitter source' },
  { pattern: /\bwindow\.|\bdocument\./, why: 'no DOM access in @ap/motion' },
]

describe('gate: @ap/motion depends on @ap/tokens and nothing else', () => {
  const files = sources(SRC)

  it('finds sources to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    it(`${file.split('motion')[1]} is clean`, () => {
      const text = readFileSync(file, 'utf8')
      const hits = FORBIDDEN.filter((r) => r.pattern.test(text)).map((r) => `${r.pattern} — ${r.why}`)
      expect(hits, `${file}:\n  ${hits.join('\n  ')}`).toEqual([])
    })
  }

  it('declares only @ap/tokens as a dependency', () => {
    const pkg = JSON.parse(readFileSync(join(SRC, '../package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@ap/tokens'])
    expect(pkg.peerDependencies ?? {}).toEqual({})
  })
})
