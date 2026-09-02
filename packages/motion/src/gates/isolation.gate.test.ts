import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')
const PKG_ROOT = join(SRC, '..')

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return e.name === 'gates' ? [] : sources(p)
    return e.name.endsWith('.ts') && !e.name.includes('.test.') ? [p] : []
  })
}

/** `D:\...\packages\motion\src\emitCss.ts` → `src/emitCss.ts`, on any platform. */
const label = (file: string): string => relative(PKG_ROOT, file).split(sep).join('/')

// ADR-0001: @ap/motion depends on @ap/tokens and nothing else. Its output is
// consumed by build tooling and by the browser, never by Node at runtime.
//
// This is an ALLOWLIST, matching that sentence: every bare import specifier in
// the package's non-test sources must be `@ap/tokens`. A denylist can only
// forbid what someone thought to name — an undeclared `@ap/react` import, the
// one import that would create a package cycle, passed a denylist untouched.
const ALLOWED = new Set(['@ap/tokens'])

/**
 * Why a particular disallowed specifier is disallowed. The allowlist alone
 * would report "not @ap/tokens", which is true but says nothing about the
 * cost; these say what actually breaks. Matched by exact name or by `<name>/`
 * subpath prefix, so `react-dom/server` and `motion/react` are covered.
 */
const WHY: Array<{ specifier: string; why: string }> = [
  { specifier: 'react', why: '@ap/motion must not depend on React' },
  { specifier: 'react-dom', why: '@ap/motion must not depend on react-dom' },
  { specifier: 'motion', why: 'Motion is a Phase 4 concern; this package emits data only' },
  { specifier: 'node:', why: 'no Node built-ins in emitter source' },
  {
    specifier: '@ap/react',
    why: '@ap/react consumes @ap/motion; importing it back would be a package cycle',
  },
]

const whyFor = (spec: string): string => {
  const hit = WHY.find(
    (w) =>
      spec === w.specifier ||
      spec.startsWith(w.specifier.endsWith(':') ? w.specifier : `${w.specifier}/`),
  )
  return hit ? hit.why : 'only @ap/tokens may be imported'
}

/**
 * Every module specifier in `text`: static `import`/`export ... from`, bare
 * `import 'x'` side-effect imports, dynamic `import('x')` and `require('x')`.
 */
function specifiers(text: string): string[] {
  const re = /\b(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) out.push(m[1]!)
  return out
}

// The remaining denylist entries are not import specifiers, so the allowlist
// above cannot see them.
const FORBIDDEN: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /\bwindow\.|\bdocument\./, why: 'no DOM access in @ap/motion' },
]

describe('gate: @ap/motion depends on @ap/tokens and nothing else', () => {
  const files = sources(SRC)

  it('finds sources to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    it(`${label(file)} imports only @ap/tokens`, () => {
      const text = readFileSync(file, 'utf8')
      // Relative specifiers are intra-package and always fine.
      const bare = specifiers(text).filter((s) => !s.startsWith('.') && !s.startsWith('/'))
      const offenders = bare.filter((s) => !ALLOWED.has(s))
      expect(
        offenders,
        `${label(file)} imports:\n  ${offenders.map((s) => `${s} — ${whyFor(s)}`).join('\n  ')}`,
      ).toEqual([])
    })

    it(`${label(file)} is clean`, () => {
      const text = readFileSync(file, 'utf8')
      const hits = FORBIDDEN.filter((r) => r.pattern.test(text)).map((r) => `${r.pattern} — ${r.why}`)
      expect(hits, `${label(file)}:\n  ${hits.join('\n  ')}`).toEqual([])
    })
  }

  it('declares only @ap/tokens as a dependency', () => {
    const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }
    expect(Object.keys(pkg.dependencies ?? {})).toEqual([...ALLOWED])
    expect(pkg.peerDependencies ?? {}).toEqual({})
  })
})
