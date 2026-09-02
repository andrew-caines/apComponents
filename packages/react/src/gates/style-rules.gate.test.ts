import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { sourceFiles } from './sourceFiles.js'

const SRC = join(import.meta.dirname, '..')

// F4: a denylist walk (via the shared `sourceFiles` walker), not a hand-rolled
// recursive readdir restricted to `.css.ts` — the standing project ruling
// (see no-hardcoded-strings.gate.test.ts, use-client.gate.test.ts) is that a
// scan should widen automatically when a new file/directory appears, and the
// perturbation that motivated this rule (a Tier 1 ramp reference planted in a
// `.tokens.ts` file, where every component declares its Tier 3 fallbacks)
// proved the old `.css.ts`-only allowlist left the single most likely leak
// point completely unscanned. `.tokens.ts` is not expressible as a directory
// exclusion, so both extensions are still named explicitly here — the
// denylist principle applies to directories/files within scope, not to
// picking which extensions are "style declaration" files in the first place.
const STYLE_FILE_EXTENSIONS = ['.css.ts', '.tokens.ts']

// contract.css.ts is the generated token contract (createThemeContract), not
// a style sheet — it declares the token NAMES the tiers reference, not CSS
// rules, so none of these rules apply to it.
const CONTRACT_FILE = join(SRC, 'theme', 'contract.css.ts')

function styleSources(dir: string): string[] {
  return sourceFiles(dir, { extensions: STYLE_FILE_EXTENSIONS }).filter((f) => f !== CONTRACT_FILE)
}

const PHYSICAL = [
  'marginLeft', 'marginRight', 'marginTop', 'marginBottom',
  'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom',
  'borderLeft', 'borderRight', 'borderTop', 'borderBottom',
]

// textAlign: 'left'/'right' are physical; 'start'/'end' are the logical values and must pass.
const TEXT_ALIGN_PHYSICAL = /\btextAlign:\s*['"](left|right)['"]/g

// The bare inset longhands are physical too — use insetInlineStart/insetInlineEnd/
// insetBlockStart/insetBlockEnd instead. Word-boundary anchored on the property key
// so this doesn't collide with textAlign: 'left' (handled above) or with
// borderLeft*-style keys (already covered by PHYSICAL) or insetInlineStart (the
// word boundary after left/right/top/bottom requires a `:` immediately after,
// which insetInlineStart's key does not have).
const INSET_LONGHAND_PHYSICAL = /\b(left|right|top|bottom):\s*/g

// A 4-value shorthand (top, right, bottom, left / corner order for radius) is physical.
// 1-, 2- and 3-value forms are horizontally symmetric and safe.
const SHORTHAND_4VALUE_PHYSICAL =
  /\b(padding|margin|inset|borderWidth|borderColor|borderStyle|borderRadius):\s*['"]([^'"]*)['"]/g

function shorthandValueCount(value: string): number {
  // Collapse parenthesized groups (e.g. calc(1px + 2px)) so they count as one value,
  // not several — naive whitespace splitting would otherwise miscount them.
  const collapsed = value.replace(/\([^)]*\)/g, '0')
  return collapsed.trim().split(/\s+/).filter(Boolean).length
}

// F3: ADR-0016's central invariant is that every declaration a component
// emits lands inside `@layer ap.components` — that's what makes unlayered
// consumer CSS win the cascade against us without `!important`. Nothing was
// asserting that structurally: a property written as a direct sibling of
// `base`/a variant option (outside the `'@layer': { [componentsLayer]: {...} }`
// wrapper) passed every other check because none of them look at nesting,
// only at property names and their string values anywhere in the file.
//
// This walks the real TypeScript AST (following ssr-safety.gate.test.ts's
// precedent) rather than adding another text regex, because the thing being
// asserted — "this property sits directly inside this object, not nested
// under '@layer'" — is a structural/nesting fact a regex cannot reliably
// express (a text scan for `'@layer'` presence anywhere in the file would
// pass even if ONE declaration among several escaped the wrapper).
interface StyleBlockRef {
  /** Human-readable path for failure messages, e.g. "recipe(...).variants.size.sm". */
  path: string
  node: ts.ObjectLiteralExpression
}

function staticPropName(prop: ts.ObjectLiteralElementLike): string | undefined {
  if (!ts.isPropertyAssignment(prop) && !ts.isShorthandPropertyAssignment(prop)) return undefined
  const name = prop.name
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text
  return undefined
}

/**
 * Finds every "style block" in the file — the object literal assigned to a
 * recipe's `base`, to each named option inside a `variants` group, to a
 * `compoundVariants[n].style`, or passed directly to a bare `style(...)`
 * call. Each of these is a place raw CSS properties may legally appear, and
 * each must emit through `'@layer'` and nothing else at its top level.
 *
 * `base`/`variants`/`defaultVariants`/`compoundVariants`/`style` are
 * structural keys used only to navigate to the real style blocks — they are
 * never themselves treated as style blocks, and `defaultVariants` is skipped
 * entirely (it holds variant names, not styles).
 */
function collectStyleBlocks(sourceFile: ts.SourceFile): StyleBlockRef[] {
  const blocks: StyleBlockRef[] = []

  function addIfObject(node: ts.Expression, path: string) {
    if (ts.isObjectLiteralExpression(node)) blocks.push({ path, node })
  }

  function walkRecipeConfig(config: ts.ObjectLiteralExpression, path: string) {
    for (const prop of config.properties) {
      if (!ts.isPropertyAssignment(prop)) continue
      const name = staticPropName(prop)
      if (name === 'base') {
        addIfObject(prop.initializer, `${path}.base`)
      } else if (name === 'variants' && ts.isObjectLiteralExpression(prop.initializer)) {
        for (const groupProp of prop.initializer.properties) {
          if (!ts.isPropertyAssignment(groupProp)) continue
          const groupName = staticPropName(groupProp) ?? '?'
          if (!ts.isObjectLiteralExpression(groupProp.initializer)) continue
          for (const optProp of groupProp.initializer.properties) {
            if (!ts.isPropertyAssignment(optProp)) continue
            const optName = staticPropName(optProp) ?? '?'
            addIfObject(optProp.initializer, `${path}.variants.${groupName}.${optName}`)
          }
        }
      } else if (name === 'compoundVariants' && ts.isArrayLiteralExpression(prop.initializer)) {
        prop.initializer.elements.forEach((el, i) => {
          if (!ts.isObjectLiteralExpression(el)) return
          for (const cvProp of el.properties) {
            if (ts.isPropertyAssignment(cvProp) && staticPropName(cvProp) === 'style') {
              addIfObject(cvProp.initializer, `${path}.compoundVariants[${i}].style`)
            }
          }
        })
      }
      // `defaultVariants` intentionally falls through unhandled: it names
      // variant values, not style objects.
    }
  }

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.arguments[0]) {
      const arg = node.arguments[0]
      if (node.expression.text === 'recipe' && ts.isObjectLiteralExpression(arg)) {
        walkRecipeConfig(arg, 'recipe(...)')
      } else if (node.expression.text === 'style' && ts.isObjectLiteralExpression(arg)) {
        addIfObject(arg, 'style(...)')
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return blocks
}

/**
 * A style block emits only through the layer when its top-level keys are
 * `'@layer'` alone, or it is empty (a structural placeholder, e.g. an empty
 * variant option `solid: {}` that contributes no declarations of its own). A
 * CSS property (or anything else) as a direct top-level key is the leak this
 * gate exists to catch — that property lands OUTSIDE `ap.components`,
 * unlayered, where it can lose to nothing and win against consumer CSS by
 * accident (the opposite of ADR-0016's intent).
 */
function layerViolationsIn(block: StyleBlockRef, sourceFile: ts.SourceFile): string[] {
  const hits: string[] = []
  for (const prop of block.node.properties) {
    const key = staticPropName(prop) ?? prop.getText(sourceFile)
    if (key !== '@layer') {
      const { line } = sourceFile.getLineAndCharacterOfPosition(prop.getStart(sourceFile))
      hits.push(`'${key}' at line ${line + 1} (${block.path})`)
    }
  }
  return hits
}

// F5: a `:focus-visible` block must express its focus indicator with
// `outline`, never `boxShadow` — an outline survives forced-colors mode
// (Windows High Contrast), where a box-shadow is dropped entirely. This is
// distinct from the "never removes focus indication" check above, which only
// forbids REMOVING focus outright: it says nothing about boxShadow, so a
// `:focus-visible` block that swaps `outline*` for a `boxShadow` declaration
// (a real, styled focus ring, just the wrong CSS mechanism) passed that check
// and every other rule in this file. Scoped to `:focus-visible` selector
// blocks specifically — `boxShadow` is legitimate elsewhere (e.g. Surface's
// `raised` tone uses it for elevation, nothing to do with focus).
function focusVisibleBoxShadowViolations(sourceFile: ts.SourceFile): string[] {
  const hits: string[] = []
  function visit(node: ts.Node) {
    if (ts.isPropertyAssignment(node)) {
      const key = staticPropName(node)
      if (key && key.includes(':focus-visible') && ts.isObjectLiteralExpression(node.initializer)) {
        for (const prop of node.initializer.properties) {
          if (staticPropName(prop) === 'boxShadow') {
            const { line } = sourceFile.getLineAndCharacterOfPosition(prop.getStart(sourceFile))
            hits.push(`boxShadow at line ${line + 1} inside '${key}'`)
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return hits
}

describe('gate: component styles follow the token and layout rules', () => {
  const files = styleSources(SRC)

  it('finds style sources to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  // Guards against the AST walk itself silently finding nothing to check —
  // e.g. a future rename of `recipe`/`style` imports, or every component
  // moving to a shape this walker doesn't recognise. Without this, a broken
  // extractor would make every per-file "@layer" test pass vacuously (zero
  // style blocks -> zero violations -> green), which is indistinguishable
  // from "no leaks" and defeats the point of the gate.
  it('finds recipe/style blocks to check for @layer emission', () => {
    const total = files.reduce((sum, file) => {
      const sourceFile = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )
      return sum + collectStyleBlocks(sourceFile).length
    }, 0)
    expect(total).toBeGreaterThan(0)
  })

  // Same "fail loudly, not vacuously" concern as above, scoped to the
  // :focus-visible/boxShadow check: if no file has a `:focus-visible` block
  // at all, the per-file assertion below passes on every file with nothing
  // to say, which is indistinguishable from "checked and clean."
  it('finds at least one :focus-visible block to check for boxShadow', () => {
    const total = files.reduce((sum, file) => {
      const sourceFile = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )
      let count = 0
      const visit = (node: ts.Node) => {
        if (
          ts.isPropertyAssignment(node) &&
          (staticPropName(node) ?? '').includes(':focus-visible')
        ) {
          count += 1
        }
        ts.forEachChild(node, visit)
      }
      visit(sourceFile)
      return sum + count
    }, 0)
    expect(total).toBeGreaterThan(0)
  })

  for (const file of files) {
    const label = file.split('src')[1]
    const text = readFileSync(file, 'utf8')

    it(`${label} references no Tier 1 primitive (ADR-0007)`, () => {
      const leaked = text.match(/--ap-(brand|danger|info|neutral|success|warning)-(\d{1,2}|contrast)\b/g)
      expect(leaked ?? [], `Tier 1 refs: ${(leaked ?? []).join(', ')}`).toEqual([])
    })

    it(`${label} uses no literal z-index (ADR-0016)`, () => {
      const literals = text.match(/zIndex:\s*(?!vars\.z\.)['"]?-?\d/g)
      expect(literals ?? [], `literal z-index: ${(literals ?? []).join(', ')}`).toEqual([])
    })

    it(`${label} never removes focus indication (ADR-0016)`, () => {
      const removals = text.match(
        /\b(?:outlineStyle|outline):\s*['"]?none['"]?\b|\b(?:outlineWidth|outline):\s*['"]?0(?:px)?['"]?\b/g,
      )
      expect(
        removals ?? [],
        "outline: none/0/0px, outlineStyle: 'none', and outlineWidth: 0/0px are all forbidden — style :focus-visible instead",
      ).toEqual([])
    })

    it(`${label} uses logical properties only`, () => {
      const physical = PHYSICAL.filter((p) => text.includes(p))
      const textAlignHits = [...text.matchAll(TEXT_ALIGN_PHYSICAL)].map((m) => m[0])
      const insetLonghandHits = [...text.matchAll(INSET_LONGHAND_PHYSICAL)].map((m) => m[0])
      const violations = [...physical, ...textAlignHits, ...insetLonghandHits]
      expect(
        violations,
        `use logical equivalents (marginInlineStart, paddingBlock, textAlign: 'start'/'end', insetInlineStart/insetInlineEnd/insetBlockStart/insetBlockEnd, …): ${violations.join(', ')}`,
      ).toEqual([])
    })

    it(`${label} uses no 4-value physical shorthand (uses logical properties only)`, () => {
      const violations = [...text.matchAll(SHORTHAND_4VALUE_PHYSICAL)]
        .filter((m) => shorthandValueCount(m[2] ?? '') === 4)
        .map((m) => m[0].trim())
      expect(
        violations,
        `4-value shorthand is physical (top/right/bottom/left order) — use block/inline longhands instead (paddingBlock, paddingInline, marginBlock, marginInline, insetBlock, insetInline, or per-corner logical border properties): ${violations.join(', ')}`,
      ).toEqual([])
    })

    it(`${label} emits every style block only through '@layer' (ADR-0016)`, () => {
      const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      const blocks = collectStyleBlocks(sourceFile)
      const hits = blocks.flatMap((b) => layerViolationsIn(b, sourceFile))
      expect(
        hits,
        `${label} declares a property outside '@layer ap.components': ${hits.join(', ')}`,
      ).toEqual([])
    })

    it(`${label} does not use boxShadow for a :focus-visible ring (ADR-0016)`, () => {
      const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      const hits = focusVisibleBoxShadowViolations(sourceFile)
      expect(
        hits,
        `${label} uses boxShadow inside :focus-visible — use outline instead, it survives forced-colors mode: ${hits.join(', ')}`,
      ).toEqual([])
    })
  }
})
