import { describe, expect, it } from 'vitest'
import { generateTheme } from '../theme/generateTheme.js'
import { contrastPairings, assertThemeContrast } from '../emit/contrastReport.js'
import { oklchToHex } from '../colour/oklch.js'
import { clampToSrgb } from '../colour/gamut.js'

// A deterministic grid over the seed space — the single-seed gates prove the
// default brand, this proves the *generator*. Every seed must build without
// throwing and land every Tier 2 pairing above its required ratio.
const HUES = Array.from({ length: 15 }, (_, i) => i * 25) // 0…350
const LIGHTNESSES = [0.35, 0.55, 0.75]
const CHROMAS = [0.06, 0.15, 0.24]

const SEEDS: string[] = HUES.flatMap((h) =>
  LIGHTNESSES.flatMap((l) => CHROMAS.map((c) => oklchToHex(clampToSrgb({ l, c, h })))),
)

describe('gate 4: seed sweep', () => {
  it(`generates a contrast-clean theme for all ${SEEDS.length} grid seeds`, () => {
    const failures: string[] = []
    for (const brand of SEEDS) {
      let pairings
      try {
        pairings = contrastPairings(generateTheme({ brand }))
      } catch (err) {
        failures.push(`${brand}: threw — ${(err as Error).message}`)
        continue
      }
      for (const p of pairings.filter((x) => !x.pass)) {
        failures.push(
          `${brand}: [${p.mode}] ${p.fg} on ${p.bg} = ${p.ratio.toFixed(2)}:1 (needs ${p.required}:1)`,
        )
      }
    }
    expect(failures, `${failures.length} failure(s):\n${failures.join('\n')}`).toEqual([])
  })

  it('the grid is deduplicated enough to be a real sweep', () => {
    expect(new Set(SEEDS).size).toBeGreaterThanOrEqual(90)
  })

  it('assertThemeContrast passes silently for every grid seed', () => {
    for (const brand of SEEDS) {
      expect(() => assertThemeContrast(generateTheme({ brand }))).not.toThrow()
    }
  })
})
