import { describe, expect, it } from 'vitest'
import { DEFAULT_BRAND, SEMANTIC_MAP, generateTheme, toCssText } from '@ap/tokens'
import { vars } from '../theme/contract.css.js'

const theme = generateTheme({ brand: DEFAULT_BRAND })
const css = toCssText(theme)

/** Every `var(--ap-x)` leaf in the contract, flattened. */
function leaves(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node)
  else if (node && typeof node === 'object') {
    for (const v of Object.values(node as Record<string, unknown>)) leaves(v, out)
  }
  return out
}

const contractVars = leaves(vars).map((v) => {
  const m = /^var\((--ap-[a-z0-9-]+)\)$/.exec(v)
  if (!m) throw new Error(`contract leaf is not a plain var(): ${v}`)
  return m[1]!
})

describe('gate: contract matches the emitted theme', () => {
  it('every contract variable is declared in theme CSS', () => {
    const missing = contractVars.filter((name) => !css.includes(`${name}:`))
    expect(missing, `declared in contract but never emitted: ${missing.join(', ')}`).toEqual([])
  })

  it('every Tier 2 semantic token is reachable from the contract', () => {
    const missing = SEMANTIC_MAP.map((e) => `--ap-${e.token}`).filter(
      (name) => !contractVars.includes(name),
    )
    expect(missing, `semantic tokens absent from contract: ${missing.join(', ')}`).toEqual([])
  })

  it('exposes no Tier 1 ramp primitives (ADR-0007)', () => {
    const ramps = ['brand', 'danger', 'info', 'neutral', 'success', 'warning']
    const leaked = contractVars.filter((name) =>
      ramps.some((r) => new RegExp(`^--ap-${r}-(\\d{1,2}|contrast)$`).test(name)),
    )
    expect(leaked, `Tier 1 primitives leaked into the contract: ${leaked.join(', ')}`).toEqual([])
  })

  it('does not expose hit-target-coarse (media-query only)', () => {
    expect(contractVars).not.toContain('--ap-hit-target-coarse')
  })
})
