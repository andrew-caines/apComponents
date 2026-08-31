import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')

function styleSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return styleSources(p)
    // contract.css.ts is the generated token contract, not a style sheet
    return e.name.endsWith('.css.ts') && e.name !== 'contract.css.ts' ? [p] : []
  })
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

describe('gate: component styles follow the token and layout rules', () => {
  const files = styleSources(SRC)

  it('finds style sources to check', () => {
    expect(files.length).toBeGreaterThan(0)
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
  }
})
