import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')
const PACKAGE_JSON = join(import.meta.dirname, '../../package.json')

function runtimeSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return e.name === 'gates' ? [] : runtimeSources(p)
    const isRuntime =
      (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) &&
      !e.name.includes('.test.') &&
      !e.name.endsWith('.css.ts')
    return isRuntime ? [p] : []
  })
}

const FORBIDDEN: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /\bwindow\./, why: 'no window during render — use useHydrated/useMediaQuery' },
  { pattern: /\bdocument\./, why: 'no document during render' },
  { pattern: /\bglobalThis\.(window|document)\b/, why: 'no browser globals via globalThis' },
  { pattern: /\blocalStorage\b|\bsessionStorage\b/, why: 'storage reads belong in an effect' },
  { pattern: /\bmatchMedia\b/, why: 'use the SSR-safe useMediaQuery wrapper' },
  { pattern: /\buseLayoutEffect\b/, why: 'use useIsomorphicLayoutEffect — plain useLayoutEffect warns on the server' },
  { pattern: /\bDate\.now\(\)/, why: 'non-deterministic render causes hydration mismatch' },
  { pattern: /\bMath\.random\(\)/, why: 'non-deterministic render causes hydration mismatch' },
  {
    pattern: /(?:from|import)\s*\(?\s*['"]react-router(?:\/[^'"]*)?['"]/,
    why: '@ap/react must not depend on react-router, including subpath or dynamic imports (ADR-0001)',
  },
  { pattern: /from ['"]node:/, why: 'no Node built-ins in runtime source' },
]

describe('gate: runtime source is SSR-safe (ADR-0005)', () => {
  const files = runtimeSources(SRC)

  it('finds runtime sources to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  // useIsomorphicLayoutEffect.ts is the one sanctioned place that names plain
  // `useLayoutEffect` — it exists to build the SSR-safe wrapper every other
  // module must use instead. The reference is evaluated once at module load
  // (guarded by `typeof document`), never during render.
  //
  // The exemption covers REFERENCING the hook, never CALLING it. Exempting the
  // whole rule for this file would make it the one place an unguarded
  // `useLayoutEffect(() => {})` could be added with the gate still green —
  // proven by doing exactly that and watching 10/10 pass. So the blanket
  // exemption is paired with the narrower assertions below, and every other
  // rule still applies to this file.
  const ISOMORPHIC_LAYOUT_EFFECT_PATH = join(SRC, 'hooks', 'useIsomorphicLayoutEffect.ts')
  const LAYOUT_EFFECT_RULE = /\buseLayoutEffect\b/.source

  for (const file of files) {
    it(`${file.split('src')[1]} is clean`, () => {
      const text = readFileSync(file, 'utf8')
      const rules =
        file === ISOMORPHIC_LAYOUT_EFFECT_PATH
          ? FORBIDDEN.filter((r) => r.pattern.source !== LAYOUT_EFFECT_RULE)
          : FORBIDDEN
      const hits = rules.filter((r) => r.pattern.test(text)).map((r) => `${r.pattern} — ${r.why}`)
      expect(hits, `${file}:\n  ${hits.join('\n  ')}`).toEqual([])
    })
  }

  describe('the file exempted from the useLayoutEffect rule', () => {
    const text = () => readFileSync(ISOMORPHIC_LAYOUT_EFFECT_PATH, 'utf8')

    it('still exists, so the exemption is not stale config for a moved file', () => {
      expect(existsSync(ISOMORPHIC_LAYOUT_EFFECT_PATH)).toBe(true)
    })

    it('references useLayoutEffect only behind the document guard', () => {
      expect(text()).toMatch(/typeof document !== 'undefined' \? useLayoutEffect : useEffect/)
    })

    it('never CALLS useLayoutEffect, which the exemption does not cover', () => {
      // A reference is a value; a call is the hazard. This is the assertion the
      // blanket exemption was missing.
      expect(
        /\buseLayoutEffect\s*\(/.test(text()),
        'useIsomorphicLayoutEffect.ts calls useLayoutEffect directly — the exemption ' +
          'permits naming the hook to build the wrapper, never invoking it',
      ).toBe(false)
    })
  })

  it('declares no react-router* dependency in packages/react/package.json (ADR-0001/0011)', () => {
    // The import-scan above only proves nothing in source *imports*
    // react-router. It says nothing about the *dependency* — a consumer who
    // never chose react-router should never have it pulled in by installing
    // @ap/react at all. Check both dependency fields directly.
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as {
      dependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }
    const offenders = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
    ].filter((name) => name.startsWith('react-router'))
    expect(offenders, `packages/react/package.json declares: ${offenders.join(', ')}`).toEqual([])
  })
})
