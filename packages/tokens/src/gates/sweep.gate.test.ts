import { describe, expect, it } from 'vitest'
import { generateTheme } from '../theme/generateTheme.js'
import { contrastPairings, assertThemeContrast } from '../emit/contrastReport.js'
import { hexToOklch, oklchToHex } from '../colour/oklch.js'
import {
  MIN_BRAND_HUE_SEPARATION,
  deriveSeeds,
  hueSeparation,
} from '../colour/semantics.js'
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

  // Contrast is not distinguishability. Two ramps can both pass AA against the
  // page and still be the same colour as each other — which is exactly what
  // happened: info was nudged to within 4.2 degrees of a blue brand, every
  // contrast gate stayed green, and action-bg-subtle vs info-bg-subtle came out
  // at 1.00:1. These two assertions are the ones that would have caught it.
  const STATUSES = ['danger', 'warning', 'success', 'info'] as const

  it(`every status ramp stays at least ${MIN_BRAND_HUE_SEPARATION} degrees from the brand, for all ${SEEDS.length} seeds`, () => {
    const failures: string[] = []
    for (const brand of SEEDS) {
      const brandHue = hexToOklch(brand).h
      const seeds = deriveSeeds(hexToOklch(brand))
      for (const name of STATUSES) {
        const gap = hueSeparation(seeds[name].h, brandHue)
        if (gap < MIN_BRAND_HUE_SEPARATION - 0.001) {
          failures.push(
            `${brand}: brand h=${brandHue.toFixed(1)} vs ${name} h=${seeds[name].h.toFixed(1)} = ${gap.toFixed(1)} deg`,
          )
        }
      }
    }
    expect(failures, `${failures.length} collision(s):\n${failures.join('\n')}`).toEqual([])
  })

  // Pushing a status off the brand can shove it into another status. It did:
  // a naive floor sent danger to h=60 for a red brand, 10 degrees from warning.
  // The observed minimum across this grid is 23.9 degrees; 20 is asserted so
  // the gate has margin without being satisfied by anything.
  it('no two status ramps land within 20 degrees of each other', () => {
    const failures: string[] = []
    for (const brand of SEEDS) {
      const seeds = deriveSeeds(hexToOklch(brand))
      for (let i = 0; i < STATUSES.length; i++) {
        for (let j = i + 1; j < STATUSES.length; j++) {
          const a = STATUSES[i]!
          const b = STATUSES[j]!
          const gap = hueSeparation(seeds[a].h, seeds[b].h)
          if (gap < 20) {
            failures.push(`${brand}: ${a} h=${seeds[a].h.toFixed(1)} vs ${b} h=${seeds[b].h.toFixed(1)} = ${gap.toFixed(1)} deg`)
          }
        }
      }
    }
    expect(failures, `${failures.length} collision(s):\n${failures.join('\n')}`).toEqual([])
  })

  it('assertThemeContrast passes silently for every grid seed', () => {
    for (const brand of SEEDS) {
      expect(() => assertThemeContrast(generateTheme({ brand }))).not.toThrow()
    }
  })
})
