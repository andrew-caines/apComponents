import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { sourceFiles } from './sourceFiles.js'

const SRC = join(import.meta.dirname, '..')
const PACKAGE_JSON = join(import.meta.dirname, '../../package.json')

// .ts and .tsx under all of src/, excluding gates/ (test infra) and test
// files (includeTests defaults to false). .css.ts is filtered separately
// below: it's not extension-expressible via `extensions` (both plain .ts and
// .css.ts end in .ts) and vanilla-extract stylesheets are build-time style
// declarations, not React runtime source subject to render-path rules.
function runtimeSources(dir: string): string[] {
  return sourceFiles(dir, { extensions: ['.ts', '.tsx'], excludeDirs: ['gates'] }).filter(
    (f) => !f.endsWith('.css.ts'),
  )
}

const FORBIDDEN: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /\bwindow\./, why: 'no window during render \u2014 use useHydrated/useMediaQuery' },
  { pattern: /\bdocument\./, why: 'no document during render' },
  { pattern: /\bglobalThis\.(window|document)\b/, why: 'no browser globals via globalThis' },
  { pattern: /\blocalStorage\b|\bsessionStorage\b/, why: 'storage reads belong in an effect' },
  { pattern: /\bmatchMedia\b/, why: 'use the SSR-safe useMediaQuery wrapper' },
  { pattern: /\buseLayoutEffect\b/, why: 'use useIsomorphicLayoutEffect \u2014 plain useLayoutEffect warns on the server' },
  { pattern: /\bDate\.now\(\)/, why: 'non-deterministic render causes hydration mismatch' },
  { pattern: /\bMath\.random\(\)/, why: 'non-deterministic render causes hydration mismatch' },
  {
    pattern: /(?:from|import)\s*\(?\s*['"]react-router(?:\/[^'"]*)?['"]/,
    why: '@ap/react must not depend on react-router, including subpath or dynamic imports (ADR-0001)',
  },
  { pattern: /from ['"]node:/, why: 'no Node built-ins in runtime source' },
]

// A direct call to a read helper in a hook body runs during render, which is
// exactly the hydration mismatch ADR-0005 forbids. A call inside an arrow or
// function expression (a callback such as getSnapshot) is fine.
function directCallsDuringRender(hook: ts.Node, names: Set<string>): string[] {
  const hits: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.has(node.expression.text)) {
      hits.push(node.expression.text)
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(hook, visit)
  return hits
}

// Wider than directCallsDuringRender: any reference to a read helper in a hook
// body, outside a nested arrow or function expression, counts. That catches
// an alias (`const read = readRaw`), `readRaw.call(...)` and `(0, readRaw)(...)`,
// which a call-only check misses. Not references to the binding: the property
// name in `x.readRaw`, and an import specifier.
function referencesDuringRender(hook: ts.Node, names: Set<string>): string[] {
  const hits: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return
    if (ts.isImportSpecifier(node)) return
    if (ts.isIdentifier(node) && names.has(node.text)) {
      const { parent } = node
      const isPropertyName = parent !== undefined && ts.isPropertyAccessExpression(parent) && parent.name === node
      if (!isPropertyName) hits.push(node.text)
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(hook, visit)
  return hits
}

describe('referencesDuringRender (self-test)', () => {
  const hookIn = (code: string) => {
    const sf = ts.createSourceFile('synthetic.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    let found: ts.FunctionDeclaration | undefined
    ts.forEachChild(sf, (node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === 'useX') found = node
    })
    if (!found) throw new Error('self-test: no useX in the synthetic source')
    return found
  }
  const NAMES = new Set(['readRaw'])

  it('the reference check flags aliases and indirect calls', () => {
    const flagged = [
      "function useX() { const read = readRaw; return read('local', 'k') }",
      "function useX() { return readRaw.call(null, 'local', 'k') }",
      "function useX() { return (0, readRaw)('local', 'k') }",
      "function useX() { return readRaw('local', 'k') }",
    ]
    // One assertion over every case, so a regression names each case it misses.
    // Fails if the walker goes back to recording only direct calls.
    const hits = Object.fromEntries(flagged.map((code) => [code, referencesDuringRender(hookIn(code), NAMES)]))
    expect(hits).toEqual(Object.fromEntries(flagged.map((code) => [code, ['readRaw']])))
  })

  it('does not flag a reference inside a nested callback, or a property name', () => {
    const clean = [
      "function useX() { return useSyncExternalStore(s, () => readRaw('local', 'k')) }",
      'function useX() { return x.readRaw }',
    ]
    for (const code of clean) {
      // Fails if the walker descends into nested arrows or counts `x.readRaw`.
      expect(referencesDuringRender(hookIn(code), NAMES), code).toEqual([])
    }
  })
})

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

  // useMediaQuery.ts is the one sanctioned place that names `matchMedia` (and
  // the `window` it hangs off): it is the SSR-safe wrapper the rule above tells
  // everyone else to use. The browser is only reached from two module-scope
  // helper functions that useSyncExternalStore calls on the client (subscribe
  // and getSnapshot), never from the hook body, and the server snapshot is the
  // caller-supplied default. A blanket exemption would let an inline read slip
  // into the hook body with the text gate still green, so the AST describe
  // below pins where those identifiers may appear. Every other rule still
  // applies to this file.
  const USE_MEDIA_QUERY_PATH = join(SRC, 'hooks', 'useMediaQuery.ts')
  const WINDOW_RULE = /\bwindow\./.source
  const MATCH_MEDIA_RULE = /\bmatchMedia\b/.source

  // useStorage.ts (Task 8, ADR-0005) is the one sanctioned place that names the
  // browser storage objects, for the same reason: it is the SSR-safe wrapper.
  // Only the module-level `getArea` helper may name them (as an identifier or a
  // string literal), the file never names the global window object, and the
  // two hook bodies name nothing. Every other rule still applies to this file;
  // the window rule is filtered out only because the raw text scan cannot be
  // scoped, so the AST describe below asserts that no identifier named window
  // appears anywhere in the file.
  const USE_STORAGE_PATH = join(SRC, 'hooks', 'useStorage.ts')

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
      if (file === USE_MEDIA_QUERY_PATH) {
        rules = rules.filter((r) => r.pattern.source !== WINDOW_RULE && r.pattern.source !== MATCH_MEDIA_RULE)
      }
      if (file === USE_STORAGE_PATH) {
        rules = rules.filter((r) => r.pattern.source !== STORAGE_RULE && r.pattern.source !== WINDOW_RULE)
      }
      const hits = rules.filter((r) => r.pattern.test(text)).map((r) => `${r.pattern} \u2014 ${r.why}`)
      expect(hits, `${file}:\n  ${hits.join('\n  ')}`).toEqual([])
    })
  }

  describe('the file exempted from the matchMedia and window rules (Task 6, ADR-0005)', () => {
    it('still exists, so the exemption is not stale config for a moved file', () => {
      expect(existsSync(USE_MEDIA_QUERY_PATH)).toBe(true)
    })

    const sourceFile = () =>
      ts.createSourceFile(
        USE_MEDIA_QUERY_PATH,
        readFileSync(USE_MEDIA_QUERY_PATH, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )

    const topLevelFunction = (sf: ts.SourceFile, name: string) => {
      let found: ts.FunctionDeclaration | undefined
      ts.forEachChild(sf, (node) => {
        if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node
      })
      return found
    }

    const BROWSER_NAMES = new Set(['matchMedia', 'window'])
    const namesBrowser = (node: ts.Node) =>
      (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) && BROWSER_NAMES.has(node.text)

    it('names matchMedia and window only inside subscribeMediaQuery and readMediaQuery', () => {
      const sf = sourceFile()
      const allowed = ['subscribeMediaQuery', 'readMediaQuery'].map((n) => {
        const fn = topLevelFunction(sf, n)
        if (!fn) {
          throw new Error(
            `ssr-safety gate: could not find a function declaration named '${n}' in ` +
              `${USE_MEDIA_QUERY_PATH}. The AST check has no anchor and cannot silently pass.`,
          )
        }
        return fn
      })
      const hits: string[] = []
      const visit = (node: ts.Node) => {
        if (namesBrowser(node) && !allowed.some((fn) => node.pos >= fn.pos && node.end <= fn.end)) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
          hits.push(`'${(node as ts.Identifier).text}' at line ${line + 1}`)
        }
        ts.forEachChild(node, visit)
      }
      visit(sf)
      expect(hits, `browser globals outside the two helpers: ${hits.join(', ')}`).toEqual([])
    })

    it('the useMediaQuery function body names neither identifier', () => {
      const sf = sourceFile()
      const hook = topLevelFunction(sf, 'useMediaQuery')
      if (!hook) {
        throw new Error(
          `ssr-safety gate: could not find a function declaration named 'useMediaQuery' in ` +
            `${USE_MEDIA_QUERY_PATH}. The AST check has no anchor and cannot silently pass.`,
        )
      }
      const hits: string[] = []
      const visit = (node: ts.Node) => {
        if (namesBrowser(node)) hits.push((node as ts.Identifier).text)
        ts.forEachChild(node, visit)
      }
      visit(hook)
      expect(hits, `useMediaQuery names browser globals: ${hits.join(', ')}`).toEqual([])
    })

    it('the useMediaQuery body never calls readMediaQuery during render', () => {
      const hook = topLevelFunction(sourceFile(), 'useMediaQuery')
      if (!hook) throw new Error(`ssr-safety gate: no useMediaQuery function in ${USE_MEDIA_QUERY_PATH}.`)
      expect(directCallsDuringRender(hook, new Set(['readMediaQuery']))).toEqual([])
    })
  })

  describe('the file exempted from the storage and window rules (Task 8, ADR-0005)', () => {
    it('still exists, so the exemption is not stale config for a moved file', () => {
      expect(existsSync(USE_STORAGE_PATH)).toBe(true)
    })

    const sourceFile = () =>
      ts.createSourceFile(
        USE_STORAGE_PATH,
        readFileSync(USE_STORAGE_PATH, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )

    const requireFunction = (sf: ts.SourceFile, name: string) => {
      let found: ts.FunctionDeclaration | undefined
      ts.forEachChild(sf, (node) => {
        if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node
      })
      if (!found) {
        throw new Error(
          `ssr-safety gate: could not find a function declaration named '${name}' in ` +
            `${USE_STORAGE_PATH}. The AST check has no anchor and cannot silently pass.`,
        )
      }
      return found
    }

    const STORAGE_NAMES = new Set(['localStorage', 'sessionStorage'])
    const isNamed = (node: ts.Node, names: Set<string>) =>
      (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) && names.has(node.text)
    const inside = (node: ts.Node, outer: ts.Node) => node.pos >= outer.pos && node.end <= outer.end

    it('names the storage objects only inside getArea or a type alias declaration', () => {
      const sf = sourceFile()
      const getArea = requireFunction(sf, 'getArea')
      const hits: string[] = []
      const visit = (node: ts.Node) => {
        if (ts.isTypeAliasDeclaration(node)) return
        if (isNamed(node, STORAGE_NAMES) && !inside(node, getArea)) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
          hits.push(`'${(node as ts.Identifier).text}' at line ${line + 1}`)
        }
        ts.forEachChild(node, visit)
      }
      visit(sf)
      expect(hits, `storage names outside getArea: ${hits.join(', ')}`).toEqual([])
    })

    it('has no identifier or string literal named window anywhere in the file', () => {
      const sf = sourceFile()
      const hits: string[] = []
      const visit = (node: ts.Node) => {
        if (isNamed(node, new Set(['window']))) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
          hits.push(`'window' at line ${line + 1}`)
        }
        ts.forEachChild(node, visit)
      }
      visit(sf)
      expect(hits, `window named at: ${hits.join(', ')}`).toEqual([])
    })

    it('neither useLocalStorage nor useSessionStorage names a storage identifier or literal', () => {
      const sf = sourceFile()
      for (const name of ['useLocalStorage', 'useSessionStorage']) {
        const hook = requireFunction(sf, name)
        const hits: string[] = []
        const visit = (node: ts.Node) => {
          if (isNamed(node, STORAGE_NAMES)) hits.push((node as ts.Identifier).text)
          ts.forEachChild(node, visit)
        }
        visit(hook)
        expect(hits, `${name} names storage objects: ${hits.join(', ')}`).toEqual([])
      }
    })

    it('no hook body references readRaw or getArea during render', () => {
      const sf = sourceFile()
      for (const name of ['useStorageValue', 'useLocalStorage', 'useSessionStorage']) {
        const hook = requireFunction(sf, name)
        // Any reference counts, so an alias or `.call` cannot slip a read into render.
        expect(referencesDuringRender(hook, new Set(['readRaw', 'getArea'])), name).toEqual([])
      }
    })
  })

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
          `code (the import and the guarded ternary), found ${matches.length} \u2014 two is the ` +
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
            'pass \u2014 update this gate if the component was renamed or restructured.',
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

    // F4: the check above only looks for browser-global identifiers directly
    // inside ThemeProvider's own span — it never re-enters applyScheme,
    // readStoredScheme, or persistScheme, because the file-wide exemption
    // above (DOCUMENT_RULE/STORAGE_RULE) intentionally lets THOSE top-level
    // helper functions name document/localStorage. That exemption has a
    // blind spot: calling one of those helpers FROM ThemeProvider's render
    // body is a render-path browser-global read in every way that matters,
    // but it is invisible to both checks — the browser-global scan never
    // sees "document" or "localStorage" (only "readStoredScheme"), and
    // nothing else asks where a call to a helper sits. `npm test` still
    // catches it via the SSR test (renderToString would throw), but
    // `test:guards` would not, which defeats the purpose of a gate.
    //
    // This closes it structurally: every call to one of the three helpers
    // found anywhere in ThemeProvider's span must sit inside an arrow/
    // function expression passed directly to useEffect or useCallback — the
    // two hooks ADR-0005 sanctions for browser-only work — never directly in
    // the render body.
    it('calls the module-scope helpers (applyScheme/readStoredScheme/persistScheme) only from inside useEffect/useCallback, never from the render body', () => {
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
        throw new Error(
          `ssr-safety gate: could not find a function declaration named 'ThemeProvider' in ` +
            `${THEME_PROVIDER_PATH}. The AST check has no anchor to search and cannot silently ` +
            'pass \u2014 update this gate if the component was renamed or restructured.',
        )
      }
      const rootFn = providerFn

      const HELPER_NAMES = new Set(['applyScheme', 'readStoredScheme', 'persistScheme'])
      const GUARDING_HOOKS = new Set(['useEffect', 'useCallback'])

      // Walk up from a call site. True if the nearest enclosing arrow
      // function / function expression is itself an argument of a
      // useEffect(...) or useCallback(...) call — i.e. the call happens
      // inside an effect or a memoised callback, not synchronously during
      // render.
      const isInsideGuardedCallback = (node: ts.Node): boolean => {
        let current: ts.Node | undefined = node.parent
        while (current && current !== rootFn) {
          if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
            const parent: ts.Node = current.parent
            if (
              ts.isCallExpression(parent) &&
              (parent.arguments as readonly ts.Node[]).includes(current) &&
              ts.isIdentifier(parent.expression) &&
              GUARDING_HOOKS.has(parent.expression.text)
            ) {
              return true
            }
          }
          current = current.parent
        }
        return false
      }

      const hits: string[] = []
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          HELPER_NAMES.has(node.expression.text) &&
          !isInsideGuardedCallback(node)
        ) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
          hits.push(`${node.expression.text}() at line ${line + 1}`)
        }
        ts.forEachChild(node, visit)
      }
      visit(providerFn)

      expect(
        hits,
        `found a helper called outside useEffect/useCallback (i.e. from the render body): ${hits.join(', ')}`,
      ).toEqual([])
    })

    it('document.documentElement is named exactly once, inside applyScheme', () => {
      const code = stripComments(providerText())
      const matches = [...code.matchAll(/\bdocument\./g)]
      expect(
        matches.length,
        'expected exactly one `document.` reference \u2014 a second means the global is ' +
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
