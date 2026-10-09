import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sourceFiles } from './sourceFiles.js'

const SRC = join(import.meta.dirname, '..')
const PHONE_LIB = 'libphonenumber-js'

// `from '…'` (import, export-from, import type), side-effect `import '…'`,
// and dynamic `import('…')`. Type-only imports count too: conservative.
const SPECIFIER_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g

function specifiersOf(file: string): string[] {
  const text = readFileSync(file, 'utf8')
  return [...text.matchAll(SPECIFIER_RE)].map((m) => m[1]!)
}

/** `./x.js` resolves to `x.ts` or `x.tsx` beside it; a bare specifier is a leaf. */
function resolveRelative(from: string, spec: string): string | undefined {
  if (!spec.startsWith('.')) return undefined
  const base = resolve(dirname(from), spec.replace(/\.js$/, ''))
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

/** Every file and every bare specifier reachable from `entry`. */
function reach(entry: string): { files: Set<string>; bare: Set<string>; unresolved: string[] } {
  const unresolved: string[] = []
  const files = new Set<string>()
  const bare = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (files.has(file)) continue
    files.add(file)
    for (const spec of specifiersOf(file)) {
      if (!spec.startsWith('.')) {
        bare.add(spec)
        continue
      }
      const resolved = resolveRelative(file, spec)
      if (resolved) queue.push(resolved)
      else unresolved.push(`${relative(SRC, file).split(sep).join('/')} -> ${spec}`)
    }
  }
  return { files, bare, unresolved }
}

const rel = (f: string) => relative(SRC, f).split(sep).join('/')
const names = (files: Set<string>) => [...files].map(rel)
const touchesPhoneLib = (bare: Set<string>) => [...bare].filter((s) => s.startsWith(PHONE_LIB))

describe('gate: libphonenumber-js stays behind ./format/phone', () => {
  const format = reach(join(SRC, 'format/index.ts'))

  // Must pass before the isolation assertions mean anything. Fails if the
  // resolver stops following `.js` specifiers or re-exports.
  it('the walk from format/index.ts reaches every sibling formatter (non-vacuity)', () => {
    const reached = names(format.files)
    for (const f of ['date', 'number', 'text', 'address', 'mask']) {
      expect(reached, `format/${f}.ts not reached`).toContain(`format/${f}.ts`)
    }
  })

  it('format/index.ts never reaches libphonenumber-js (fails if it re-exports ./phone.js)', () => {
    expect(touchesPhoneLib(format.bare)).toEqual([])
    expect(names(format.files)).not.toContain('format/phone.ts')
  })

  it('no relative specifier reachable from either barrel fails to resolve (a resolver bug cannot pass vacuously)', () => {
    expect(format.unresolved).toEqual([])
    expect(reach(join(SRC, 'hooks/index.ts')).unresolved).toEqual([])
  })

  it('the walk from hooks/index.ts reaches the state and media hooks (non-vacuity)', () => {
    const reached = names(reach(join(SRC, 'hooks/index.ts')).files)
    expect(reached).toContain('hooks/useMediaQuery.ts')
    expect(reached).toContain('hooks/useControllableState.ts')
  })

  it('hooks/index.ts never reaches libphonenumber-js', () => {
    const hooks = reach(join(SRC, 'hooks/index.ts'))
    expect(names(hooks.files).length).toBeGreaterThan(1)
    expect(touchesPhoneLib(hooks.bare)).toEqual([])
  })

  it('hooks/index.ts reaches notifications/api.ts and context.ts but never NotificationProvider.tsx (which pulls Toast CSS; fails if useAnnounce imports it)', () => {
    const reached = names(reach(join(SRC, 'hooks/index.ts')).files)
    expect(reached).toContain('notifications/api.ts')
    expect(reached).toContain('notifications/context.ts')
    expect(reached).not.toContain('notifications/NotificationProvider.tsx')
  })

  it('format/phone.ts is the only non-test source file importing libphonenumber-js', () => {
    const importers = sourceFiles(SRC, { extensions: ['.ts', '.tsx'] })
      .filter((f) => specifiersOf(f).some((s) => s.startsWith(PHONE_LIB)))
      .map(rel)
    expect(importers).toEqual(['format/phone.ts'])
  })
})
