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
  'textAlign: \'left\'', 'textAlign: \'right\'',
]

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
        /\b(?:outlineStyle|outline):\s*['"]?none['"]?\b|\b(?:outlineWidth|outline):\s*['"]?0['"]?\b/g,
      )
      expect(
        removals ?? [],
        "outline: none/0, outlineStyle: 'none', and outlineWidth: 0 are all forbidden — style :focus-visible instead",
      ).toEqual([])
    })

    it(`${label} uses logical properties only`, () => {
      const physical = PHYSICAL.filter((p) => text.includes(p))
      expect(
        physical,
        `use logical equivalents (marginInlineStart, paddingBlock, …): ${physical.join(', ')}`,
      ).toEqual([])
    })
  }
})
