import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'
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
  // proven by doing exactly that and watching the suite stay green. So the
  // blanket exemption is paired with the narrower assertions below, and every
  // other rule still applies to this file.
  const ISOMORPHIC_LAYOUT_EFFECT_PATH = join(SRC, 'hooks', 'useIsomorphicLayoutEffect.ts')
  const LAYOUT_EFFECT_RULE = /\buseLayoutEffect\b/.source

  // ThemeProvider.tsx and ThemeScript.tsx (Task 3, ADR-0005/0009) are the
  // first runtime sources with a legitimate reason to name `document` and
  // `localStorage` at all:
  //
  // - ThemeProvider reads/writes storage and reflects the scheme onto
  //   `<html>` — but only from inside effects and the `setScheme` callback,
  //   never at module scope or synchronously during render. That is exactly
  //   what ADR-0005's rule permits ("Browser-only state resolves after
  //   hydration, never during render").
  // - ThemeScript never touches these globals at all *in this module* — the
  //   text "document." and "localStorage" are characters inside the payload
  //   string of the inline anti-flash <script>, evaluated only by the
  //   browser parsing the emitted tag, never by this module or by Node
  //   during SSR.
  //
  // Exempting the whole rule for either file would let an actual
  // module-scope or render-path read slip in with the gate still green —
  // proven by adding one and watching the suite stay green — so the blanket
  // exemption is paired with the narrower assertions below, and every other
  // rule (including the react-router and Date.now/Math.random checks) still
  // applies to both files.
  const THEME_PROVIDER_PATH = join(SRC, 'providers', 'ThemeProvider.tsx')
  const THEME_SCRIPT_PATH = join(SRC, 'providers', 'ThemeScript.tsx')
  const DOCUMENT_RULE = /\bdocument\./.source
  const STORAGE_RULE = /\blocalStorage\b|\bsessionStorage\b/.source

  for (const file of files) {
    it(`${file.split('src')[1]} is clean`, () => {
      const text = readFileSync(file, 'utf8')
      let rules = FORBIDDEN
      if (file === ISOMORPHIC_LAYOUT_EFFECT_PATH) {
        rules = rules.filter((r) => r.pattern.source !== LAYOUT_EFFECT_RULE)
      }
      if (file === THEME_PROVIDER_PATH || file === THEME_SCRIPT_PATH) {
        rules = rules.filter(
          (r) => r.pattern.source !== DOCUMENT_RULE && r.pattern.source !== STORAGE_RULE,
        )
      }
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
      // Semantic shape, not exact formatting: tolerate either quote style
      // around 'undefined' and flexible whitespace around the operators, while
      // still requiring the typeof document guard, the ternary, and both
      // hooks in the right positions. An exact-text match would fail this
      // gate for a purely cosmetic reformat (e.g. single to double quotes)
      // with no functional change.
      expect(text()).toMatch(
        /typeof\s+document\s*!==\s*['"]undefined['"]\s*\?\s*useLayoutEffect\s*:\s*useEffect/,
      )
    })

    it('names useLayoutEffect exactly twice: the import and the guarded reference', () => {
      // Call-shape regexes are unwinnable here — `useLayoutEffect?.(...)`,
      // an aliased import invoked under its alias, and
      // `const fn = useLayoutEffect; fn(...)` all reference the hook without
      // ever matching `/\buseLayoutEffect\s*\(/`. Rather than chase every
      // syntactic evasion with more regexes, count occurrences of the token
      // itself in the code (comments stripped, so documentation prose that
      // names the hook doesn't skew the count). In this file's code it may
      // legitimately appear exactly twice — once in the import, once in the
      // guarded ternary above. A third occurrence, in any syntactic form, is
      // a finding: it means the hook is being named somewhere beyond
      // building the wrapper, which is the one thing the exemption does not
      // cover.
      const code = text()
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      const matches = code.match(/\buseLayoutEffect\b/g) ?? []
      expect(
        matches.length,
        `expected useLayoutEffect to appear exactly 2 times in useIsomorphicLayoutEffect.ts's ` +
          `code (the import and the guarded ternary), found ${matches.length} — two is the ` +
          'sanctioned count because a third occurrence, whatever its syntax ' +
          '(optional chaining, an alias, assignment to a variable), means the hook is ' +
          'being invoked outside the guard the exemption exists to cover',
      ).toBe(2)
    })
  })

  describe('the two files exempted from the document/localStorage rules (Task 3, ADR-0005/0009)', () => {
    const providerText = () => readFileSync(THEME_PROVIDER_PATH, 'utf8')
    const scriptText = () => readFileSync(THEME_SCRIPT_PATH, 'utf8')

    it('both files still exist, so neither exemption is stale config for a moved file', () => {
      expect(existsSync(THEME_PROVIDER_PATH)).toBe(true)
      expect(existsSync(THEME_SCRIPT_PATH)).toBe(true)
    })

    // Comments stripped throughout this describe block: a JSDoc line like
    // "localStorage key for persisting an explicit choice" names the word in
    // prose, not code, and must not skew any of these counts.
    const stripComments = (code: string) =>
      code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

    // The two text-scan assertions this replaced — "the render path (its JSX
    // return) never names document/localStorage" and "every localStorage
    // occurrence sits inside a try/catch" — both went green against live
    // bypasses: a `try { localStorage.getItem(x) } catch {}` planted directly
    // in the component's render body (any try/catch satisfies the second
    // rule, regardless of WHERE it runs), and `const d = document; void d`
    // (the render-path rule only matched `document.` with a trailing dot).
    // Every refinement of those regexes just traded one blind spot for
    // another — optional chaining, aliasing, a missing dot.
    //
    // An AST check has no such blind spot: it asks the TypeScript parser,
    // which already resolved the real grammar, "does any identifier named
    // document/localStorage/sessionStorage/window appear anywhere inside the
    // ThemeProvider function's span" — including its render body, its JSX,
    // and every nested arrow function (effects, callbacks), since those are
    // real descendants of the function node no matter how they are written.
    // Comments and string contents are parser trivia, not identifiers, so
    // they never contribute false positives either.
    it('the ThemeProvider function names no document/localStorage/sessionStorage/window identifier anywhere in its body', () => {
      const code = providerText()
      const sourceFile = ts.createSourceFile(
        THEME_PROVIDER_PATH,
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      )

      let providerFn: ts.FunctionDeclaration | undefined
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isFunctionDeclaration(node) && node.name?.text === 'ThemeProvider') {
          providerFn = node
        }
      })
      if (!providerFn) {
        // Fail loudly, not silently: if a rename or refactor ever makes this
        // query return nothing, an empty result must never read as "no
        // offending identifiers found." That failure mode is what turns a
        // gate into a no-op.
        throw new Error(
          `ssr-safety gate: could not find a function declaration named 'ThemeProvider' in ` +
            `${THEME_PROVIDER_PATH}. The AST check has no anchor to search and cannot silently ` +
            'pass — update this gate if the component was renamed or restructured.',
        )
      }

      const FORBIDDEN_BROWSER_GLOBALS = new Set(['document', 'localStorage', 'sessionStorage', 'window'])
      const hits: string[] = []
      const visit = (node: ts.Node) => {
        // Identifiers cover every ordinary form: a bare reference, a property
        // access, an alias, an optional call. String literals cover the one
        // form they miss — `globalThis['localStorage']`, where the property
        // name is a string, not an identifier. There is no legitimate reason
        // for the text 'localStorage' to appear as a literal inside this
        // component, so treating both node kinds the same closes the bracket-
        // access escape without needing to model member expressions.
        const named =
          (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) &&
          FORBIDDEN_BROWSER_GLOBALS.has(node.text)
        if (named) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
          hits.push(`'${node.text}' at line ${line + 1}`)
        }
        ts.forEachChild(node, visit)
      }
      visit(providerFn)

      expect(hits, `found browser-global identifiers inside ThemeProvider: ${hits.join(', ')}`).toEqual([])
    })

    it('document.documentElement is named exactly once, inside applyScheme', () => {
      const code = stripComments(providerText())
      const matches = [...code.matchAll(/\bdocument\./g)]
      expect(
        matches.length,
        'expected exactly one `document.` reference — a second means the global is ' +
          'being touched somewhere the exemption was not scoped to review',
      ).toBe(1)
      const idx = matches[0]!.index
      const precedingContext = code.slice(Math.max(0, idx - 300), idx)
      expect(precedingContext, 'expected the reference to live inside applyScheme').toContain(
        'function applyScheme',
      )
    })

    it("ThemeScript's document/localStorage text lives only inside the <script> payload string", () => {
      const code = scriptText()
      const match = code.match(/const source =\s*([\s\S]*?)\n\n\s*return/)
      expect(match, 'expected to find the `source` template literal assignment').not.toBeNull()
      const payload = match![1]!
      // Confirm the payload actually contains what we expect to find there —
      // otherwise this test would pass vacuously against an empty capture.
      expect(payload).toMatch(/\blocalStorage\b/)
      expect(payload).toMatch(/\bdocument\./)
      const withoutPayload = code.replace(payload, '')
      expect(withoutPayload).not.toMatch(/\bdocument\.|\blocalStorage\b|\bsessionStorage\b/)
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
