import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { sourceFiles } from './sourceFiles.js'

const SRC = join(import.meta.dirname, '..')

// F3: scan all of src/ with a named, commented exclusion set, mirroring
// use-client — NOT an allowlist of directories. An allowlist has to be
// widened by hand every time a directory is added, and whoever adds one has
// no reason to think about this file: that is exactly how icons/ landed
// outside this gate's original two-directory allowlist, and exactly how
// providers/ — where Phase 5's NotificationProvider toast/banner copy will
// live — was unscanned too. A denylist means a new directory is covered the
// day it appears; the only thing anyone must remember is to justify an
// exclusion.
//
// gates/ is test infrastructure, not shipped runtime code, and is the only
// exclusion: everything else under src/ renders markup a screen reader or a
// user can see, so everything else is in scope.
const EXCLUDE_DIRS = ['gates']

/**
 * A user-facing string literal in a component is a gate failure, not a review
 * comment: components must read strings through the message registry so a
 * non-English product does not ship English ARIA (ADR-0012).
 *
 * We flag the ATTRIBUTES that reach assistive technology or the screen, because
 * those are the ones that must be translatable. Class names, data attributes and
 * token names are not user-facing and are not flagged.
 */
const USER_FACING_ATTRS = [
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-valuetext',
  'aria-roledescription',
  'title',
  'placeholder',
  'alt',
  'abbr',
  // F7: the icon set's own accessible-name prop (`<Icon label="Close" />`).
  // It reaches assistive technology exactly like aria-label does once Icon
  // forwards it — the most likely real hardcoded-string case this gate
  // missed, and free to add.
  'label',
  // Phase 4c: `Field`'s other two static-copy props. `<Field label hint
  // error>` is the recommended way to build a form field, so the moment a
  // Phase 5 component composes one, `hint="We never share this."` and
  // `error="That address is already in use."` are exactly as shippable, and
  // exactly as English, as a hardcoded `label` — and `label` alone would not
  // have flagged either.
  'hint',
  'error',
] as const

/**
 * True if `node` (or any descendant) is a `StringLiteral` or a
 * `NoSubstitutionTemplateLiteral`. The subtree search — rather than checking
 * only the immediate initializer — is what catches `cond ? 'Close' :
 * 'Dismiss'` and `'Cl' + 'ose'`: both bury a hardcoded string a level or two
 * below the `JsxExpression`, not at its root.
 *
 * `NoSubstitutionTemplateLiteral` (`` `Close` ``) is exactly as hardcoded as a
 * quoted string. `TemplateExpression` (`` `${prefix} close` ``) is not: its
 * children are `TemplateHead`/`TemplateSpan` nodes, never a `StringLiteral` or
 * `NoSubstitutionTemplateLiteral`, so an interpolated template never matches
 * here — that is the registry path working, not an evasion.
 */
function findStringLiteral(
  node: ts.Node,
): ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node
  }
  let found: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | undefined
  ts.forEachChild(node, (child) => {
    if (found) return
    found = findStringLiteral(child)
  })
  return found
}

/**
 * A letter, in any script — not just ASCII. Used to tell copy ("Close", a
 * bullet's label) apart from formatting (whitespace/newlines between JSX
 * elements) and from punctuation-only text (a bare "—" or "·" separator),
 * which is why this is "contains a letter" rather than "is non-empty".
 */
const HAS_LETTER = /\p{L}/u

/**
 * Parses `source` as TSX and returns one human-readable hit per user-facing
 * hardcoded string found, covering both surfaces a component can leak
 * English through:
 *
 *  1. A `JsxAttribute` in `USER_FACING_ATTRS` whose value is a string literal,
 *     or whose expression container has a string literal anywhere in its
 *     subtree (a ternary, a concatenation, a bare template literal).
 *  2. A `JsxText` node whose trimmed content contains a letter — visible text
 *     content like `<span>Close</span>`, which an attribute-only scan never
 *     sees at all.
 *
 * Shared between the real-file scan below and the evasion-battery tests, so
 * both exercise the exact same detection logic rather than two implementations
 * that could drift apart.
 */
function findHardcodedLiterals(source: string): string[] {
  const sourceFile = ts.createSourceFile(
    'component.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )

  const hits: string[] = []

  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node)) {
      const attrName = ts.isIdentifier(node.name) ? node.name.text : node.name.getText(sourceFile)
      if ((USER_FACING_ATTRS as readonly string[]).includes(attrName)) {
        const init = node.initializer
        if (init && ts.isStringLiteral(init)) {
          hits.push(`${attrName}="${init.text}"`)
        } else if (init && ts.isJsxExpression(init) && init.expression) {
          const literal = findStringLiteral(init.expression)
          if (literal) {
            hits.push(`${attrName}={...} contains hardcoded string "${literal.text}"`)
          }
        }
      }
    } else if (ts.isJsxText(node)) {
      const trimmed = node.text.trim()
      if (HAS_LETTER.test(trimmed)) {
        hits.push(`JSX text "${trimmed}"`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return hits
}

describe('gate: src/ takes user-facing strings from the message registry', () => {
  // .tsx only: JSX attributes/text are the only surfaces this gate's AST walk
  // looks at (JsxAttribute, JsxText), and only .tsx carries JSX in this
  // project. Test/story files excluded (includeTests defaults to false) —
  // fixtures aren't shipped, translated copy.
  const files = sourceFiles(SRC, { extensions: ['.tsx'], excludeDirs: EXCLUDE_DIRS })

  // Fail loudly, not silently: if src/ is ever missing or moved, or every
  // source stops matching the `.tsx` filter, an empty file list must never
  // read as "nothing hardcoded" — that is exactly how this gate would become
  // a no-op.
  if (files.length === 0) {
    throw new Error(
      `no-hardcoded-strings gate: found zero sources under ${SRC} — the gate has nothing to ` +
        'scan and must not pass vacuously. Check that the directory exists and still contains ' +
        '.tsx source files.',
    )
  }

  it('finds sources to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  // Proves the recursive walk actually reaches into subdirectories rather
  // than silently stopping at the top level — every real component lives one
  // level down (e.g. `components/Surface/Surface.tsx`), so if this ever
  // regressed to a flat `readdirSync` the gate would report "0 files" or miss
  // every component while still, misleadingly, passing.
  it('scans nested component directories, not just the top level', () => {
    expect(files.some((f) => f.includes(join('Surface', 'Surface.tsx')))).toBe(true)
  })

  // Proves the denylist walk actually reaches providers/ — the directory the
  // old two-root allowlist never covered, and exactly where Phase 5's
  // NotificationProvider toast/banner copy will live.
  it('reaches providers/, which the old components/icons allowlist never covered', () => {
    expect(files.some((f) => f.includes(join('providers', 'ThemeProvider.tsx')))).toBe(true)
  })

  for (const file of files) {
    const rel = file.slice(SRC.length + 1).replace(/\\/g, '/')

    it(`${rel} hardcodes no user-facing string`, () => {
      const text = readFileSync(file, 'utf8')
      const hits = findHardcodedLiterals(text)
      expect(
        hits,
        `${rel} hardcodes ${hits[0]} — read it from useMessages() so it can be translated`,
      ).toEqual([])
    })
  }
})

describe('gate: the detection logic itself catches known evasions', () => {
  // Each of these is a way a component could carry a hardcoded, user-facing
  // string while a naive scan reports clean. If any of these stop matching,
  // the gate can be defeated by a one-character edit (switching quote style,
  // adding braces, moving the string into text content, or switching to
  // backticks) with no change in behavior — exactly the kind of assertion-
  // that-passes-under-the-violation this project has burned time on before.
  const evasions: Array<[string, string]> = [
    ['double-quoted (baseline)', '<button aria-label="Close">'],
    ['single-quoted', "<button aria-label='Close'>"],
    ['braced double-quoted', '<button aria-label={"Close"}>'],
    ['braced single-quoted', "<button aria-label={'Close'}>"],
    ['bare template literal, no interpolation', '<button aria-label={`Close`}>'],
    ['extra internal whitespace', '<button aria-label = "Close">'],
    ['a different flagged attribute (title)', '<div title="Loading…">'],
    ['a different flagged attribute (placeholder)', '<input placeholder="Search" />'],
    ['a different flagged attribute (alt)', '<img alt="Company logo" />'],
    ['a different flagged attribute (aria-description)', '<div aria-description="Optional field">'],
    ['a different flagged attribute (aria-placeholder)', '<input aria-placeholder="Search">'],
    ['a different flagged attribute (aria-valuetext)', '<div aria-valuetext="50 percent">'],
    [
      'a different flagged attribute (aria-roledescription)',
      '<div aria-roledescription="carousel">',
    ],
    ['a different flagged attribute (abbr)', '<abbr title="x" abbr="Kilometers">'],
    ['Field copy props (hint)', '<Field hint="We never share this." />'],
    ['Field copy props (error)', '<Field error="That address is in use." />'],
    ['a ternary between two hardcoded strings', "<button aria-label={cond ? 'Close' : 'Dismiss'}>"],
    ['string concatenation', "<button aria-label={'Cl' + 'ose'}>"],
    ['visible JSX text content', '<span>Close</span>'],
    ['visible JSX text content, mixed with siblings', '<button>{icon}Close</button>'],
  ]

  for (const [label, snippet] of evasions) {
    it(`flags: ${label}`, () => {
      expect(findHardcodedLiterals(snippet).length).toBeGreaterThan(0)
    })
  }

  const legitimate: Array<[string, string]> = [
    ['a bare variable reference', '<button aria-label={label}>'],
    ['a registry lookup', '<button aria-label={messages.close}>'],
    ['a template literal that interpolates', '<button aria-label={`${prefix} close`}>'],
    ['a non-user-facing attribute (className)', '<div className="Close">'],
    ['a non-user-facing attribute (data-*)', '<div data-title="x" data-alt="y" />'],
    ['whitespace-only text between elements', '<div>\n  <span />\n  <span />\n</div>'],
    ['punctuation-only text content', '<div>—</div>'],
    ['children passthrough', '<div>{children}</div>'],
    ['a message-registry expression as text', '<div>{messages.close}</div>'],
    ['a translation-function call as text', "<div>{t('close')}</div>"],
    ['an interpolated template as text', '<div>{`${prefix} close`}</div>'],
  ]

  for (const [label, snippet] of legitimate) {
    it(`does not flag: ${label}`, () => {
      expect(findHardcodedLiterals(snippet)).toEqual([])
    })
  }
})
