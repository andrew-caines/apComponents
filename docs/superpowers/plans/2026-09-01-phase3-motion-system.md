# Phase 3 — Motion System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define twelve named semantic motions once, emit them as both CSS and JavaScript, and make `prefers-reduced-motion` support impossible for a component to omit.

**Architecture:** Duration and easing primitives become scales in `@ap/tokens`, emitted into the existing `theme.css` alongside space and radius. A new `@ap/motion` package holds a typed `MOTIONS` record — the single source of truth — and two pure emitters over it: `toMotionCss` produces a generated, committed `motion.css`, and `toMotionVariants` returns Motion-compatible data at runtime. A gate parses the emitted CSS back and compares it to the emitted JS, so the two outputs cannot drift.

**Tech Stack:** TypeScript (strict, NodeNext, ESM-only), Vitest 3, npm workspaces. No new runtime dependencies — `@ap/motion` depends only on `@ap/tokens`.

**Spec:** `docs/superpowers/specs/2026-09-01-motion-system-design.md`. ADRs 0001, 0007, 0010, 0016 in `docs/adr/`.

## Global Constraints

- **Node ≥ 22.22.0**, ESM-only, `"type": "module"` in every package.
- `@ap/motion` depends on **`@ap/tokens` and nothing else** — no React, no DOM, no bundler (ADR-0001). Enforced by a gate.
- All custom properties use the **`--ap-` prefix**, non-configurable (ADR-0007).
- Generated files (`motion.css`, and the regenerated `theme.css` / `contract.css.ts`) are **committed as source** and re-verified for freshness in CI. No `dist/` is ever committed.
- Generated files carry a do-not-edit header naming their regeneration command.
- **Reduced-motion durations collapse to `1ms`, never `0ms`.** A zero-length animation may never fire `transitionend`/`animationend`, stranding any component that unmounts or advances state on that event.
- **`iterations: 'infinite'` is permitted only on `skeleton.shimmer` and `spinner.rotate`** — the two motions where the movement *is* the information (ADR-0010). Enforced by a gate.
- **Every motion whose `reduced` is `'opacity'` must animate opacity in its normal steps**, or the degraded keyframes would be empty. Enforced by a gate.
- `@keyframes` are emitted **unlayered**; composite `--ap-motion-*` properties go inside `@layer ap.tokens` (ADR-0016). `theme.css` carries the layer-order statement and must be imported before `motion.css`.
- `DEFAULT_BRAND` (`#2e5fd9`) remains the placeholder seed.

### Deviation from the spec, recorded deliberately

The spec's §4 says the primitives surface as `theme.scales.motion`. This plan instead adds them as **two sibling scales, `theme.scales.duration` and `theme.scales.ease`**. Every other scale on `theme.scales` is flat (`space`, `text`, `radius`, `z`, `misc`), the emitted names are flat (`--ap-duration-fast`, `--ap-ease-out`), and the token contract groups are flat (`vars.duration.fast`, `vars.ease.inOut`). Nesting one scale and not the others would be the only irregularity in the shape. Nothing else in the spec depends on the nesting.

## File Structure

```
apComponents/
├── packages/
│   ├── tokens/
│   │   └── src/
│   │       ├── scales/
│   │       │   ├── motion.ts               NEW — DURATION, EASE, REDUCED_MOTION_DURATION
│   │       │   └── motion.test.ts          NEW
│   │       ├── theme/generateTheme.ts      MODIFY — Theme.scales gains duration + ease
│   │       ├── emit/cssText.ts             MODIFY — emit the vars + reduced-motion block
│   │       └── index.ts                    MODIFY — export the new scales
│   ├── motion/                             NEW — @ap/motion
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts                    public surface
│   │       ├── types.ts                    Step, MotionSpec, MotionName, MotionVariant
│   │       ├── motions.ts                  MOTIONS — the source record
│   │       ├── motions.test.ts             record invariants
│   │       ├── emitCss.ts                  toMotionCss
│   │       ├── emitCss.test.ts
│   │       ├── emitVariants.ts             toMotionVariants
│   │       ├── emitVariants.test.ts
│   │       ├── motion.css                  GENERATED, committed
│   │       └── gates/
│   │           ├── parseMotionCss.ts       shared test-only CSS extractor
│   │           ├── equivalence.gate.test.ts
│   │           ├── reduced-motion.gate.test.ts
│   │           ├── freshness.gate.test.ts
│   │           └── isolation.gate.test.ts
│   └── react/                              (unchanged this phase)
├── scripts/
│   ├── gen-theme-contract.ts               MODIFY — duration + ease groups
│   └── gen-motion-css.ts                   NEW
├── .github/workflows/ci.yml                MODIFY — gen:motion-css in the freshness job
├── docs/CONTRIBUTING.md                    MODIFY — generated files, import order
└── package.json                            MODIFY — scripts, typecheck
```

---

### Task 1: Motion primitives in `@ap/tokens`

**Files:**
- Create: `packages/tokens/src/scales/motion.ts`, `packages/tokens/src/scales/motion.test.ts`
- Modify: `packages/tokens/src/theme/generateTheme.ts`, `packages/tokens/src/emit/cssText.ts`, `packages/tokens/src/index.ts`
- Regenerate: `packages/react/src/theme/theme.css` and the determinism snapshot

**Interfaces:**
- Produces: `DURATION`, `EASE`, `REDUCED_MOTION_DURATION` from `@ap/tokens`; `theme.scales.duration` and `theme.scales.ease` (both `Readonly<Record<string, string>>`); emitted custom properties `--ap-duration-{instant,fast,base,slow,slower}` and `--ap-ease-{out,in,in-out,linear}`.

- [ ] **Step 1: Write the failing test**

`packages/tokens/src/scales/motion.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DURATION, EASE, REDUCED_MOTION_DURATION } from './motion.js'

describe('motion primitives', () => {
  it('carries ADR-0010 durations verbatim', () => {
    expect(DURATION).toEqual({
      instant: '0ms', fast: '120ms', base: '200ms', slow: '320ms', slower: '480ms',
    })
  })

  it('carries ADR-0010 easings, plus linear for looped motions', () => {
    expect(EASE).toEqual({
      out: 'cubic-bezier(0.16, 1, 0.30, 1)',
      in: 'cubic-bezier(0.70, 0, 0.84, 0)',
      'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
      linear: 'linear',
    })
  })

  it('collapses to 1ms and never 0ms under reduced motion', () => {
    // 0ms can suppress transitionend/animationend, stranding any component
    // that unmounts or advances state on that event.
    expect(REDUCED_MOTION_DURATION).toBe('1ms')
  })

  it('freezes both scales, like every other shared singleton', () => {
    expect(Object.isFrozen(DURATION)).toBe(true)
    expect(Object.isFrozen(EASE)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/tokens/src/scales/motion.test.ts`
Expected: FAIL — cannot find module `./motion.js`.

- [ ] **Step 3: Implement the scales**

`packages/tokens/src/scales/motion.ts`:

```ts
// Motion primitives (ADR-0010). Frozen at declaration for the same reason as
// every other scale in scales.ts: these singletons are handed straight out on
// `theme.scales`, so a consumer mutating one would change every later theme.

export const DURATION = Object.freeze({
  instant: '0ms',
  fast: '120ms',
  base: '200ms',
  slow: '320ms',
  slower: '480ms',
} as Record<string, string>)

// Entrances decelerate (`out`) and take longer; exits accelerate (`in`) and are
// shorter — users wait for entrances but not for exits, so a slow exit reads as
// lag. `linear` exists for the two infinite motions: any eased curve visibly
// stutters at a loop boundary, because a continuous loop has no start or end
// to shape.
export const EASE = Object.freeze({
  out: 'cubic-bezier(0.16, 1, 0.30, 1)',
  in: 'cubic-bezier(0.70, 0, 0.84, 0)',
  'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
  linear: 'linear',
} as Record<string, string>)

/**
 * The duration every non-zero duration collapses to under
 * `prefers-reduced-motion: reduce`.
 *
 * 1ms rather than 0ms, deliberately: a zero-length animation may never fire
 * `transitionend`/`animationend`, which would strand any component that
 * unmounts or advances state on that event — a dialog that closes on animation
 * end would hang open forever for a reduced-motion user. 1ms is imperceptible
 * and still fires the event.
 */
export const REDUCED_MOTION_DURATION = '1ms'
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run packages/tokens/src/scales/motion.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the scales to the Theme type and assembly**

In `packages/tokens/src/theme/generateTheme.ts`:

Add to the imports:

```ts
import { DURATION, EASE } from '../scales/motion.js'
```

In the `Theme` interface, extend the `scales` block (keep the existing entries, add two):

```ts
    misc: typeof MISC
    duration: typeof DURATION
    ease: typeof EASE
  }>
```

In `generateTheme`'s return, extend the frozen scales object:

```ts
    scales: Object.freeze({
      space: SPACE, text: TEXT, radius: RADIUS, elevation: ELEVATION, z: Z, misc: MISC,
      duration: DURATION, ease: EASE,
    }),
```

- [ ] **Step 6: Write the failing emitter test**

Add to `packages/tokens/src/emit/cssText.test.ts` (keep every existing test):

```ts
describe('motion primitives', () => {
  const css = toCssText(generateTheme({ brand: DEFAULT_BRAND }))

  it('emits every duration and easing custom property', () => {
    for (const k of ['instant', 'fast', 'base', 'slow', 'slower']) {
      expect(css).toContain(`--ap-duration-${k}:`)
    }
    for (const k of ['out', 'in', 'in-out', 'linear']) {
      expect(css).toContain(`--ap-ease-${k}:`)
    }
  })

  it('collapses every non-zero duration under prefers-reduced-motion', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(block).toContain('--ap-duration-fast: 1ms;')
    expect(block).toContain('--ap-duration-base: 1ms;')
    expect(block).toContain('--ap-duration-slow: 1ms;')
    expect(block).toContain('--ap-duration-slower: 1ms;')
  })

  it('leaves the already-zero duration alone', () => {
    // `instant` is 0ms in both modes; re-declaring it as 1ms would make the
    // reduced-motion sheet slower than the normal one.
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(block).not.toContain('--ap-duration-instant')
  })

  it('emits the reduced-motion block inside the token layer', () => {
    const layerEnd = css.lastIndexOf('}')
    expect(css.indexOf('@media (prefers-reduced-motion: reduce)')).toBeLessThan(layerEnd)
  })
})
```

If `DEFAULT_BRAND` is not already imported in that file, import it from `../index.js`; if the file constructs its theme differently, follow the file's existing convention rather than this snippet's.

- [ ] **Step 7: Run to verify failure**

Run: `npx vitest run packages/tokens/src/emit/cssText.test.ts`
Expected: FAIL — the duration properties are not emitted.

- [ ] **Step 8: Implement the emission**

In `packages/tokens/src/emit/cssText.ts`, add the import:

```ts
import { REDUCED_MOTION_DURATION } from '../scales/motion.js'
```

In `scaleLines`, destructure the two new scales and emit them. Change the destructuring line to:

```ts
  const { space, text, radius, elevation, z, misc, duration, ease } = theme.scales
```

and add these two loops immediately after the `z` loop:

```ts
  for (const [k, v] of Object.entries(duration)) lines.push(`--ap-duration-${k}: ${v};`)
  for (const [k, v] of Object.entries(ease)) lines.push(`--ap-ease-${k}: ${v};`)
```

Add this function beside the other line-builders:

```ts
/**
 * Under `prefers-reduced-motion: reduce` every non-zero duration collapses to
 * 1ms. Already-zero durations are skipped — re-declaring `instant` as 1ms
 * would make the reduced-motion sheet slower than the normal one.
 *
 * 1ms rather than 0ms is deliberate; see REDUCED_MOTION_DURATION.
 */
function reducedMotionLines(theme: Theme): string[] {
  return Object.entries(theme.scales.duration)
    .filter(([, v]) => v !== '0ms')
    .map(([k]) => `--ap-duration-${k}: ${REDUCED_MOTION_DURATION};`)
}
```

In `toCssText`'s `parts` array, insert immediately after the closing `'  }',` of the `@media (pointer: coarse)` block and before the final `'}'`:

```ts
    '',
    '  @media (prefers-reduced-motion: reduce) {',
    block(root, reducedMotionLines(theme), '    '),
    '  }',
```

- [ ] **Step 9: Run to verify pass**

Run: `npx vitest run packages/tokens/src/emit/cssText.test.ts`
Expected: PASS. The `toCssText` snapshot will fail on first run because the emitted CSS legitimately grew — inspect the diff, confirm it contains only the new duration/ease properties and the new media block, then update the snapshot with `npx vitest run packages/tokens/src/emit/cssText.test.ts -u`.

- [ ] **Step 10: Export from the package index**

Add to `packages/tokens/src/index.ts`:

```ts
export { DURATION, EASE, REDUCED_MOTION_DURATION } from './scales/motion.js'
```

- [ ] **Step 11: Regenerate the committed theme and run everything**

```bash
npm run gen:theme-css
npm test
npm run typecheck
```

The determinism snapshot in `packages/tokens/src/gates/__snapshots__/` will also need updating for the same legitimate reason — inspect its diff before updating with `-u`. Confirm `npm run test:freshness` passes, proving the committed `theme.css` matches its generator.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(tokens): duration and easing scales with reduced-motion collapse"
```

---

### Task 2: Expose duration and easing through the token contract

**Files:**
- Modify: `scripts/gen-theme-contract.ts`
- Regenerate: `packages/react/src/theme/contract.css.ts`

**Interfaces:**
- Consumes: `theme.scales.duration`, `theme.scales.ease` (Task 1).
- Produces: `vars.duration.{instant,fast,base,slow,slower}` and `vars.ease.{out,in,inOut,linear}` in the generated contract, each a `var(--ap-*)` string.

- [ ] **Step 1: Add the two groups to the generator**

In `scripts/gen-theme-contract.ts`, immediately after the existing `group('font', [...])` call, add:

```ts
group(
  'duration',
  Object.keys(theme.scales.duration).map((k) => [toCamel(k), `duration-${k}`] as const),
)
group(
  'ease',
  Object.keys(theme.scales.ease).map((k) => [toCamel(k), `ease-${k}`] as const),
)
```

`toCamel` turns `in-out` into `inOut`, so the contract key is `vars.ease.inOut` while the custom property remains `--ap-ease-in-out`.

- [ ] **Step 2: Regenerate and eyeball**

Run: `npm run gen:theme-contract`

Read the diff on `packages/react/src/theme/contract.css.ts`. Verify it added exactly two groups, that `duration` has five entries and `ease` four, that `ease` contains the key `"inOut"` mapping to `'ease-in-out'`, and that nothing else moved.

- [ ] **Step 3: Run the drift gate and the suite**

Run: `npm run test:contract`
Expected: PASS. The gate asserts every contract variable is declared in the emitted theme CSS, so this proves Task 1's emission and this task's contract agree. If it fails naming a `--ap-duration-*` or `--ap-ease-*` property, Task 1's emitter and this generator disagree — fix the emitter, not the gate.

Then `npm test && npm run typecheck` — both clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(react): expose duration and easing through the typed token contract"
```

---

### Task 3: `@ap/motion` package and the source record

**Files:**
- Create: `packages/motion/package.json`, `packages/motion/tsconfig.json`
- Create: `packages/motion/src/types.ts`, `packages/motion/src/motions.ts`, `packages/motion/src/index.ts`
- Test: `packages/motion/src/motions.test.ts`
- Modify: root `package.json` (typecheck)

**Interfaces:**
- Consumes: `DURATION`, `EASE` from `@ap/tokens` (Task 1).
- Produces: `MOTIONS: Readonly<Record<MotionName, MotionSpec>>`; types `Step`, `MotionSpec`, `MotionName`, `DurationToken`, `EaseToken`, `ReducedBehaviour`.

- [ ] **Step 1: Create the package**

`packages/motion/package.json`:

```json
{
  "name": "@ap/motion",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": ["*.css"],
  "exports": {
    ".": "./src/index.ts",
    "./motion.css": "./src/motion.css"
  },
  "dependencies": {
    "@ap/tokens": "file:../tokens"
  },
  "engines": { "node": ">=22.22.0" }
}
```

`packages/motion/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"],
  "references": [{ "path": "../tokens" }]
}
```

Change the root `package.json` `typecheck` script to:

```json
"typecheck": "tsc -b packages/tokens packages/motion packages/react packages/vite"
```

Then run `npm install` to register the new workspace.

- [ ] **Step 2: Write the types**

`packages/motion/src/types.ts`:

```ts
export type DurationToken = 'instant' | 'fast' | 'base' | 'slow' | 'slower'
export type EaseToken = 'out' | 'in' | 'in-out' | 'linear'

/** How a motion degrades under `prefers-reduced-motion: reduce`. */
export type ReducedBehaviour = 'opacity' | 'none'

/**
 * One keyframe stop. `at` is a 0–1 offset. Properties left undefined are not
 * animated at that stop; the emitters carry the previous value forward.
 */
export interface Step {
  at: number
  opacity?: number
  translateX?: string
  translateY?: string
  scale?: number
  rotate?: string
  height?: string
  strokeDashoffset?: number
}

export interface MotionSpec {
  /** A token name, never a value — so a motion cannot drift from the scale. */
  duration: DurationToken
  ease: EaseToken
  steps: readonly Step[]
  /** Finite count, or 'infinite' where the movement IS the information. */
  iterations: number | 'infinite'
  reduced: ReducedBehaviour
}
```

- [ ] **Step 3: Write the failing invariant test**

`packages/motion/src/motions.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DURATION, EASE } from '@ap/tokens'
import { MOTIONS } from './motions.js'

const entries = Object.entries(MOTIONS)

describe('MOTIONS record', () => {
  it('defines all twelve named motions from ADR-0010', () => {
    expect(Object.keys(MOTIONS).sort()).toEqual([
      'attention.nudge', 'collapse', 'enter.fade-rise', 'error.shake', 'exit.fade',
      'expand', 'skeleton.shimmer', 'spinner.rotate', 'success.check',
      'toast.slide-in', 'toast.slide-out', 'warning.pulse',
    ])
  })

  it('references only duration and easing tokens that exist in the scale', () => {
    for (const [name, spec] of entries) {
      expect(Object.keys(DURATION), `${name} duration`).toContain(spec.duration)
      expect(Object.keys(EASE), `${name} ease`).toContain(spec.ease)
    }
  })

  it('gives every motion steps running from 0 to 1 in ascending order', () => {
    for (const [name, spec] of entries) {
      const ats = spec.steps.map((s) => s.at)
      expect(ats[0], `${name} first offset`).toBe(0)
      expect(ats.at(-1), `${name} last offset`).toBe(1)
      expect([...ats].sort((a, b) => a - b), `${name} ordering`).toEqual(ats)
      for (const at of ats) expect(at, `${name} offset range`).toBeGreaterThanOrEqual(0)
      for (const at of ats) expect(at, `${name} offset range`).toBeLessThanOrEqual(1)
    }
  })

  it('loops only where the movement is the information (ADR-0010)', () => {
    const infinite = entries.filter(([, s]) => s.iterations === 'infinite').map(([n]) => n)
    // warning.pulse is deliberately finite: perpetual motion is a vestibular
    // hazard and an attention sink.
    expect(infinite.sort()).toEqual(['skeleton.shimmer', 'spinner.rotate'])
  })

  it('gives every opacity-degrading motion an opacity track to degrade to', () => {
    for (const [name, spec] of entries) {
      if (spec.reduced !== 'opacity') continue
      const animatesOpacity = spec.steps.some((s) => s.opacity !== undefined)
      expect(animatesOpacity, `${name} declares reduced:'opacity' but animates no opacity`).toBe(true)
    }
  })

  it('is frozen', () => {
    expect(Object.isFrozen(MOTIONS)).toBe(true)
  })
})
```

- [ ] **Step 4: Run to verify failure**

Run: `npx vitest run packages/motion/src/motions.test.ts`
Expected: FAIL — cannot find module `./motions.js`.

- [ ] **Step 5: Write the source record**

`packages/motion/src/motions.ts`:

```ts
import type { MotionSpec } from './types.js'

/**
 * The twelve named semantic motions (ADR-0010). This record is the single
 * source of truth: both the CSS and the JavaScript emissions derive from it,
 * which is what keeps them from drifting.
 *
 * `duration` and `ease` are token names, resolved against @ap/tokens' scales.
 */
export const MOTIONS = Object.freeze({
  'error.shake': {
    duration: 'slow', ease: 'in-out', iterations: 1, reduced: 'none',
    steps: [
      { at: 0, translateX: '0px' },
      { at: 0.167, translateX: '-4px' },
      { at: 0.333, translateX: '4px' },
      { at: 0.5, translateX: '-4px' },
      { at: 0.667, translateX: '4px' },
      { at: 0.833, translateX: '-4px' },
      { at: 1, translateX: '0px' },
    ],
  },
  // Finite by construction. ADR-0010: perpetual motion is a vestibular hazard.
  'warning.pulse': {
    duration: 'slow', ease: 'in-out', iterations: 2, reduced: 'none',
    steps: [
      { at: 0, scale: 1 },
      { at: 0.5, scale: 1.04 },
      { at: 1, scale: 1 },
    ],
  },
  'success.check': {
    duration: 'slower', ease: 'out', iterations: 1, reduced: 'opacity',
    steps: [
      { at: 0, strokeDashoffset: 1, scale: 0.9, opacity: 0 },
      { at: 0.6, strokeDashoffset: 0, scale: 1.06, opacity: 1 },
      { at: 1, strokeDashoffset: 0, scale: 1, opacity: 1 },
    ],
  },
  'enter.fade-rise': {
    duration: 'base', ease: 'out', iterations: 1, reduced: 'opacity',
    steps: [
      { at: 0, opacity: 0, translateY: '8px' },
      { at: 1, opacity: 1, translateY: '0px' },
    ],
  },
  'exit.fade': {
    duration: 'fast', ease: 'in', iterations: 1, reduced: 'opacity',
    steps: [
      { at: 0, opacity: 1 },
      { at: 1, opacity: 0 },
    ],
  },
  // `--panel-height` is supplied by Base UI's primitives, which arrive in
  // Phase 4. Until then these two emit correctly but cannot be demonstrated.
  collapse: {
    duration: 'fast', ease: 'in', iterations: 1, reduced: 'none',
    steps: [
      { at: 0, height: 'var(--panel-height)' },
      { at: 1, height: '0px' },
    ],
  },
  expand: {
    duration: 'base', ease: 'out', iterations: 1, reduced: 'none',
    steps: [
      { at: 0, height: '0px' },
      { at: 1, height: 'var(--panel-height)' },
    ],
  },
  'toast.slide-in': {
    duration: 'base', ease: 'out', iterations: 1, reduced: 'opacity',
    steps: [
      { at: 0, translateX: '100%', opacity: 0 },
      { at: 1, translateX: '0px', opacity: 1 },
    ],
  },
  'toast.slide-out': {
    duration: 'fast', ease: 'in', iterations: 1, reduced: 'opacity',
    steps: [
      { at: 0, translateX: '0px', opacity: 1 },
      { at: 1, translateX: '100%', opacity: 0 },
    ],
  },
  'skeleton.shimmer': {
    duration: 'slower', ease: 'linear', iterations: 'infinite', reduced: 'none',
    steps: [
      { at: 0, translateX: '-100%' },
      { at: 1, translateX: '100%' },
    ],
  },
  'spinner.rotate': {
    duration: 'slower', ease: 'linear', iterations: 'infinite', reduced: 'none',
    steps: [
      { at: 0, rotate: '0deg' },
      { at: 1, rotate: '360deg' },
    ],
  },
  'attention.nudge': {
    duration: 'fast', ease: 'out', iterations: 1, reduced: 'none',
    steps: [
      { at: 0, translateX: '0px' },
      { at: 0.5, translateX: '6px' },
      { at: 1, translateX: '0px' },
    ],
  },
} as const satisfies Readonly<Record<string, MotionSpec>>)

export type MotionName = keyof typeof MOTIONS
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run packages/motion/src/motions.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Write the package index**

`packages/motion/src/index.ts`:

```ts
export { MOTIONS } from './motions.js'
export type { MotionName } from './motions.js'
export type {
  DurationToken, EaseToken, MotionSpec, ReducedBehaviour, Step,
} from './types.js'
```

- [ ] **Step 8: Run the suite and commit**

Run: `npm test && npm run typecheck` — both clean.

```bash
git add -A
git commit -m "feat(motion): package skeleton and the twelve-motion source record"
```

---

### Task 4: CSS emitter, generated `motion.css`, freshness gate

**Files:**
- Create: `packages/motion/src/emitCss.ts`, `packages/motion/src/emitCss.test.ts`
- Create: `scripts/gen-motion-css.ts`
- Create (generated, then committed): `packages/motion/src/motion.css`
- Create: `packages/motion/src/gates/freshness.gate.test.ts`
- Modify: root `package.json` (scripts), `packages/motion/src/index.ts`

**Interfaces:**
- Consumes: `MOTIONS` (Task 3); `DURATION`, `EASE` (Task 1).
- Produces: `toMotionCss(motions?: Readonly<Record<string, MotionSpec>>): string`; `cssKeyframeName(name: string): string`; the committed `packages/motion/src/motion.css`, importable as `@ap/motion/motion.css`.

- [ ] **Step 1: Add the scripts**

Add to root `package.json` `scripts`:

```json
"gen:motion-css": "tsx scripts/gen-motion-css.ts",
"test:motion": "vitest run packages/motion/src"
```

- [ ] **Step 2: Write the failing emitter test**

`packages/motion/src/emitCss.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cssKeyframeName, toMotionCss } from './emitCss.js'

const css = toMotionCss()

describe('toMotionCss', () => {
  it('turns a dotted motion name into a hyphenated keyframe name', () => {
    expect(cssKeyframeName('error.shake')).toBe('ap-error-shake')
    expect(cssKeyframeName('collapse')).toBe('ap-collapse')
  })

  it('emits a keyframes block for every motion', () => {
    expect(css).toContain('@keyframes ap-error-shake {')
    expect(css).toContain('@keyframes ap-spinner-rotate {')
    expect((css.match(/^@keyframes /gm) ?? []).length).toBe(12)
  })

  it('emits keyframes unlayered and composite properties inside the token layer', () => {
    const layerStart = css.indexOf('@layer ap.tokens {')
    expect(layerStart).toBeGreaterThan(css.indexOf('@keyframes ap-error-shake'))
    expect(css.slice(layerStart)).toContain('--ap-motion-error-shake:')
  })

  it('references duration and easing as custom properties, never as values', () => {
    expect(css).toContain(
      '--ap-motion-error-shake: ap-error-shake var(--ap-duration-slow) var(--ap-ease-in-out) 1 both;',
    )
    expect(css).not.toMatch(/--ap-motion-[a-z-]+:[^;]*\d+ms/)
    expect(css).not.toMatch(/--ap-motion-[a-z-]+:[^;]*cubic-bezier/)
  })

  it('emits infinite only where the record says so', () => {
    expect(css).toContain(
      '--ap-motion-spinner-rotate: ap-spinner-rotate var(--ap-duration-slower) var(--ap-ease-linear) infinite both;',
    )
    expect(css).toContain('--ap-motion-warning-pulse: ap-warning-pulse var(--ap-duration-slow) var(--ap-ease-in-out) 2 both;')
  })

  it('writes offsets as trimmed percentages', () => {
    expect(css).toContain('  0% {')
    expect(css).toContain('  100% {')
    expect(css).toContain('16.7% {')
  })

  it('composes translate as a single property from X and Y', () => {
    expect(css).toContain('translate: -4px 0px')
    expect(css).toContain('translate: 0px 8px')
  })

  it('re-declares every motion under prefers-reduced-motion, after the originals', () => {
    const reduced = css.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(reduced).toBeGreaterThan(css.indexOf('@keyframes ap-error-shake'))
    const block = css.slice(reduced)
    for (const n of ['ap-error-shake', 'ap-enter-fade-rise', 'ap-spinner-rotate']) {
      expect(block, `${n} missing a reduced definition`).toContain(`@keyframes ${n} {`)
    }
  })

  it('degrades opacity motions to the opacity track alone', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    const face = block.slice(block.indexOf('@keyframes ap-enter-fade-rise {'))
    const body = face.slice(0, face.indexOf('\n  }'))
    expect(body).toContain('opacity: 0')
    expect(body).not.toContain('translate:')
  })

  it('degrades none-motions to a present but empty animation', () => {
    // Present, not deleted: the animation must still fire animationend so a
    // component that advances state on it behaves identically.
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    const face = block.slice(block.indexOf('@keyframes ap-error-shake {'))
    expect(face.slice(0, face.indexOf('}') + 1)).toContain('0%, 100% {')
  })

  it('is deterministic', () => {
    expect(toMotionCss()).toBe(css)
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run packages/motion/src/emitCss.test.ts`
Expected: FAIL — cannot find module `./emitCss.js`.

- [ ] **Step 4: Implement the emitter**

`packages/motion/src/emitCss.ts`:

```ts
import { MOTIONS } from './motions.js'
import type { MotionSpec, Step } from './types.js'

/** `error.shake` → `ap-error-shake`. Dots are not valid in a keyframe name. */
export const cssKeyframeName = (name: string): string => `ap-${name.replace(/\./g, '-')}`

/** `error.shake` → `--ap-motion-error-shake`. */
const cssVarName = (name: string): string => `--ap-motion-${name.replace(/\./g, '-')}`

/** 0.167 → '16.7%', 0 → '0%', 1 → '100%'. Trailing zeros trimmed. */
const offset = (at: number): string => `${Number((at * 100).toFixed(1))}%`

/**
 * CSS declarations for one step. `translateX`/`translateY` compose into the
 * single `translate` property rather than `transform`, so translation, scale
 * and rotation compose independently instead of overwriting one another.
 */
function declarations(step: Step): string[] {
  const out: string[] = []
  if (step.opacity !== undefined) out.push(`opacity: ${step.opacity}`)
  if (step.translateX !== undefined || step.translateY !== undefined) {
    out.push(`translate: ${step.translateX ?? '0px'} ${step.translateY ?? '0px'}`)
  }
  if (step.scale !== undefined) out.push(`scale: ${step.scale}`)
  if (step.rotate !== undefined) out.push(`rotate: ${step.rotate}`)
  if (step.height !== undefined) out.push(`height: ${step.height}`)
  if (step.strokeDashoffset !== undefined) {
    out.push(`stroke-dashoffset: ${step.strokeDashoffset}`)
  }
  return out
}

const keyframesBlock = (name: string, steps: readonly Step[]): string =>
  [
    `@keyframes ${cssKeyframeName(name)} {`,
    ...steps.map((s) => `  ${offset(s.at)} { ${declarations(s).join('; ')} }`),
    '}',
    '',
  ].join('\n')

/**
 * The reduced-motion replacement for one motion, re-declared under the SAME
 * keyframe name. Later declaration wins, so components consuming the token
 * inherit the degradation without opting in — and cannot opt out.
 */
function reducedBlock(name: string, spec: MotionSpec): string {
  const kf = cssKeyframeName(name)
  if (spec.reduced === 'none') {
    // Present but empty, deliberately: the animation still runs and still fires
    // animationend, so a component that unmounts or advances state on that
    // event behaves identically for a reduced-motion user. Deleting the
    // keyframes would strand exactly those components.
    return [`  @keyframes ${kf} {`, '    0%, 100% { }', '  }', ''].join('\n')
  }
  const opacityOnly = spec.steps
    .filter((s) => s.opacity !== undefined)
    .map((s) => `    ${offset(s.at)} { opacity: ${s.opacity} }`)
  return [`  @keyframes ${kf} {`, ...opacityOnly, '  }', ''].join('\n')
}

const HEADER = `/* GENERATED by scripts/gen-motion-css.ts — do not edit.
   Regenerate with: npm run gen:motion-css

   Import AFTER @ap/react/theme.css: that file carries the
   \`@layer ap.tokens, ap.components;\` order statement this sheet relies on. */
`

export function toMotionCss(
  motions: Readonly<Record<string, MotionSpec>> = MOTIONS,
): string {
  const names = Object.keys(motions)

  // Keyframes are emitted unlayered: keyframes are not subject to the cascade,
  // so a layer around them would be noise. The composite properties below DO
  // participate in the cascade and go inside ap.tokens.
  const keyframes = names.map((n) => keyframesBlock(n, motions[n]!.steps)).join('\n')

  const vars = names.map((n) => {
    const s = motions[n]!
    const count = s.iterations === 'infinite' ? 'infinite' : String(s.iterations)
    return `    ${cssVarName(n)}: ${cssKeyframeName(n)} var(--ap-duration-${s.duration}) var(--ap-ease-${s.ease}) ${count} both;`
  })

  const reduced = names.map((n) => reducedBlock(n, motions[n]!)).join('\n')

  return [
    HEADER,
    keyframes,
    '@layer ap.tokens {',
    '  :root {',
    ...vars,
    '  }',
    '}',
    '',
    '@media (prefers-reduced-motion: reduce) {',
    reduced,
    '}',
    '',
  ].join('\n').replace(/\n{3,}/g, '\n\n')
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run packages/motion/src/emitCss.test.ts`
Expected: PASS (11 tests). If an assertion about exact spacing fails, adjust the **test** to the emitter's actual output only when the output is correct CSS — never loosen an assertion about layering, `var()` references or the reduced-motion block.

- [ ] **Step 6: Write the generator and generate**

`scripts/gen-motion-css.ts`:

```ts
// Dev-only script: regenerates packages/motion/src/motion.css
// Run: npm run gen:motion-css   — commit the output. Never edited by hand.
import { writeFileSync } from 'node:fs'
import { toMotionCss } from '../packages/motion/src/emitCss.js'

writeFileSync('packages/motion/src/motion.css', toMotionCss())
console.log('motion.css written')
```

Run: `npm run gen:motion-css`

Read the generated file. Verify: the do-not-edit header, twelve unlayered `@keyframes` blocks, one `@layer ap.tokens` block with twelve `--ap-motion-*` properties referencing `var(--ap-duration-*)` and `var(--ap-ease-*)`, then a `prefers-reduced-motion` block re-declaring all twelve.

- [ ] **Step 7: Write the freshness gate**

`packages/motion/src/gates/freshness.gate.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { toMotionCss } from '../emitCss.js'

const MOTION_CSS = join(import.meta.dirname, '../motion.css')

describe('gate: motion.css is fresh', () => {
  const committed = readFileSync(MOTION_CSS, 'utf8')

  it('committed motion.css matches the generator output', () => {
    expect(
      committed,
      'motion.css is stale — run `npm run gen:motion-css` and commit the result',
    ).toBe(toMotionCss())
  })

  it('carries the do-not-edit header naming the regen command', () => {
    expect(committed).toContain('GENERATED by scripts/gen-motion-css.ts')
    expect(committed).toContain('npm run gen:motion-css')
  })

  it('records the import-order requirement it depends on', () => {
    expect(committed).toContain('theme.css')
  })
})
```

- [ ] **Step 8: Prove the gate bites**

Run `npm run test:motion` — expect PASS.

Then append a stray line to `packages/motion/src/motion.css`, re-run, and confirm it FAILS with the "stale" message. Restore with `npm run gen:motion-css` and confirm green again. Paste the real failing output into your report — a freshness gate that has never been seen to fail is not a verified gate.

- [ ] **Step 9: Export and commit**

Add to `packages/motion/src/index.ts`:

```ts
export { cssKeyframeName, toMotionCss } from './emitCss.js'
```

Run `npm test && npm run typecheck` — both clean.

```bash
git add -A
git commit -m "feat(motion): CSS emitter, generated motion.css, freshness gate"
```

---

### Task 5: JavaScript variant emitter

**Files:**
- Create: `packages/motion/src/emitVariants.ts`, `packages/motion/src/emitVariants.test.ts`
- Modify: `packages/motion/src/types.ts` (add `MotionVariant`), `packages/motion/src/index.ts`

**Interfaces:**
- Consumes: `MOTIONS` (Task 3); `EASE`, `DURATION` (Task 1).
- Produces: `toMotionVariants(motions?): Record<string, MotionVariant>`, where

```ts
export interface MotionVariant {
  keyframes: Record<string, (string | number)[]>
  transition: { duration: number; ease: number[] | 'linear'; times: number[]; repeat: number }
}
```

- [ ] **Step 1: Write the failing test**

`packages/motion/src/emitVariants.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { toMotionVariants } from './emitVariants.js'

const v = toMotionVariants()

describe('toMotionVariants', () => {
  it('emits a variant for every motion', () => {
    expect(Object.keys(v)).toHaveLength(12)
  })

  it('resolves duration tokens to seconds', () => {
    // Motion expresses duration in seconds; our scale is in milliseconds.
    expect(v['error.shake']!.transition.duration).toBe(0.32)
    expect(v['exit.fade']!.transition.duration).toBe(0.12)
  })

  it('resolves easing tokens to cubic-bezier control points', () => {
    expect(v['enter.fade-rise']!.transition.ease).toEqual([0.16, 1, 0.3, 1])
  })

  it('passes linear through as a keyword', () => {
    expect(v['spinner.rotate']!.transition.ease).toBe('linear')
  })

  it('converts iteration count to Motion repeat semantics', () => {
    // Motion's `repeat` counts ADDITIONAL plays: repeat 0 plays once.
    expect(v['error.shake']!.transition.repeat).toBe(0)
    expect(v['warning.pulse']!.transition.repeat).toBe(1)
    expect(v['spinner.rotate']!.transition.repeat).toBe(Infinity)
  })

  it('carries step offsets through as times', () => {
    expect(v['attention.nudge']!.transition.times).toEqual([0, 0.5, 1])
  })

  it('maps translate to Motion x and y keys', () => {
    expect(v['enter.fade-rise']!.keyframes['y']).toEqual(['8px', '0px'])
    expect(v['toast.slide-in']!.keyframes['x']).toEqual(['100%', '0px'])
  })

  it('carries a value forward when a step omits a property', () => {
    // success.check's opacity reaches 1 at 0.6 and is unchanged at 1.
    expect(v['success.check']!.keyframes['opacity']).toEqual([0, 1, 1])
  })

  it('emits arrays of equal length to times, for every property', () => {
    for (const [name, variant] of Object.entries(v)) {
      const n = variant.transition.times.length
      for (const [prop, values] of Object.entries(variant.keyframes)) {
        expect(values, `${name}.${prop} length`).toHaveLength(n)
      }
    }
  })

  it('is deterministic', () => {
    expect(toMotionVariants()).toEqual(v)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/motion/src/emitVariants.test.ts`
Expected: FAIL — cannot find module `./emitVariants.js`.

- [ ] **Step 3: Add the variant type**

Append to `packages/motion/src/types.ts`:

```ts
/**
 * A Motion-compatible variant. Shaped for `motion/react`'s keyframes +
 * transition convention, but typed by us — this package does not depend on
 * Motion, and nothing in Phase 3 imports it.
 */
export interface MotionVariant {
  keyframes: Record<string, (string | number)[]>
  transition: {
    /** Seconds, per Motion's convention. */
    duration: number
    ease: number[] | 'linear'
    times: number[]
    /** ADDITIONAL plays beyond the first, per Motion's convention. */
    repeat: number
  }
}
```

- [ ] **Step 4: Implement the emitter**

`packages/motion/src/emitVariants.ts`:

```ts
import { DURATION, EASE } from '@ap/tokens'
import { MOTIONS } from './motions.js'
import type { MotionSpec, MotionVariant, Step } from './types.js'

/** Our step property names → Motion's keyframe keys. */
const KEY_MAP: Record<string, string> = {
  opacity: 'opacity',
  translateX: 'x',
  translateY: 'y',
  scale: 'scale',
  rotate: 'rotate',
  height: 'height',
  strokeDashoffset: 'strokeDashoffset',
}

/** '320ms' → 0.32. Motion expresses duration in seconds. */
function seconds(token: string): number {
  const ms = Number(DURATION[token]!.replace('ms', ''))
  return ms / 1000
}

/** 'cubic-bezier(0.16, 1, 0.30, 1)' → [0.16, 1, 0.3, 1]; 'linear' → 'linear'. */
function ease(token: string): number[] | 'linear' {
  const value = EASE[token]!
  if (value === 'linear') return 'linear'
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(value)
  if (!m) throw new Error(`Easing token '${token}' is not a cubic-bezier: ${value}`)
  return m[1]!.split(',').map((n) => Number(n.trim()))
}

/**
 * Motion needs one value per step for every animated property, but a step may
 * omit a property it does not change. The previous value is carried forward;
 * for a leading gap the first defined value is carried backward, so the
 * property starts where it will first be set rather than jumping.
 */
function track(steps: readonly Step[], prop: keyof Step): (string | number)[] {
  const raw = steps.map((s) => s[prop] as string | number | undefined)
  const firstDefined = raw.find((x) => x !== undefined)!
  const out: (string | number)[] = []
  let carried: string | number = firstDefined
  for (const value of raw) {
    if (value !== undefined) carried = value
    out.push(carried)
  }
  return out
}

function variant(spec: MotionSpec): MotionVariant {
  const animated = new Set<string>()
  for (const step of spec.steps) {
    for (const key of Object.keys(step)) {
      if (key !== 'at' && step[key as keyof Step] !== undefined) animated.add(key)
    }
  }

  const keyframes: Record<string, (string | number)[]> = {}
  for (const prop of animated) {
    keyframes[KEY_MAP[prop] ?? prop] = track(spec.steps, prop as keyof Step)
  }

  return {
    keyframes,
    transition: {
      duration: seconds(spec.duration),
      ease: ease(spec.ease),
      times: spec.steps.map((s) => s.at),
      // Motion's `repeat` counts additional plays: repeat 0 plays once, so a
      // 2-iteration motion is repeat 1.
      repeat: spec.iterations === 'infinite' ? Infinity : spec.iterations - 1,
    },
  }
}

export function toMotionVariants(
  motions: Readonly<Record<string, MotionSpec>> = MOTIONS,
): Record<string, MotionVariant> {
  return Object.fromEntries(Object.entries(motions).map(([n, s]) => [n, variant(s)]))
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run packages/motion/src/emitVariants.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Export, run the suite, commit**

Add to `packages/motion/src/index.ts`:

```ts
export { toMotionVariants } from './emitVariants.js'
export type { MotionVariant } from './types.js'
```

Run `npm test && npm run typecheck` — both clean.

```bash
git add -A
git commit -m "feat(motion): JavaScript variant emitter over the same source record"
```

---

### Task 6: The equivalence gate

**Files:**
- Create: `packages/motion/src/gates/parseMotionCss.ts`, `packages/motion/src/gates/equivalence.gate.test.ts`

**Interfaces:**
- Consumes: the committed `motion.css` (Task 4), `toMotionVariants` (Task 5), `MOTIONS` (Task 3).
- Produces: `parseMotionCss(css: string): { normal: Record<string, ParsedMotion>; reduced: Record<string, ParsedStep[]> }`, where `ParsedStep = { at: number; props: Record<string, string> }` and `ParsedMotion = { steps: ParsedStep[]; duration: string; ease: string; iterations: string }`. Both records are keyed by CSS keyframe name (`ap-error-shake`), not by motion name.

This is the phase's stated exit criterion. It reads **both** sides as artifacts: the CSS is parsed back out of the committed file, and the JS comes from the emitter. A bug in either emitter shows up as a disagreement.

- [ ] **Step 1: Write the extractor**

`packages/motion/src/gates/parseMotionCss.ts`:

```ts
// Test-only. A focused extractor for the CSS this repo generates — not a
// general CSS parser, and it should never become one. Its job is to read the
// emitted artifact back so the equivalence gate compares two artifacts rather
// than trusting one emitter's in-memory state.

export interface ParsedStep {
  at: number
  props: Record<string, string>
}

export interface ParsedMotion {
  steps: ParsedStep[]
  duration: string
  ease: string
  iterations: string
}

export interface ParsedCss {
  normal: Record<string, ParsedMotion>
  reduced: Record<string, ParsedStep[]>
}

const stepsOf = (body: string): ParsedStep[] => {
  const steps: ParsedStep[] = []
  const re = /([\d.]+)%(?:\s*,\s*([\d.]+)%)?\s*\{([^}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const props: Record<string, string> = {}
    for (const decl of m[3]!.split(';')) {
      const [k, ...rest] = decl.split(':')
      if (!k?.trim() || rest.length === 0) continue
      props[k.trim()] = rest.join(':').trim()
    }
    steps.push({ at: Number(m[1]) / 100, props })
    // A `0%, 100% { }` stop declares two offsets; record both so an empty
    // reduced block is still visibly a two-stop animation.
    if (m[2] !== undefined) steps.push({ at: Number(m[2]) / 100, props })
  }
  return steps
}

export function parseMotionCss(css: string): ParsedCss {
  const reducedAt = css.indexOf('@media (prefers-reduced-motion: reduce)')
  if (reducedAt === -1) throw new Error('no prefers-reduced-motion block in motion.css')
  const before = css.slice(0, reducedAt)
  const after = css.slice(reducedAt)

  const composite = new Map<string, { duration: string; ease: string; iterations: string }>()
  const varRe =
    /--ap-motion-([a-z0-9-]+):\s*\S+\s+var\(--ap-duration-([a-z]+)\)\s+var\(--ap-ease-([a-z-]+)\)\s+(\S+)\s+both;/g
  let v: RegExpExecArray | null
  while ((v = varRe.exec(before)) !== null) {
    composite.set(`ap-${v[1]}`, { duration: v[2]!, ease: v[3]!, iterations: v[4]! })
  }

  const collect = (source: string): Record<string, ParsedStep[]> => {
    const out: Record<string, ParsedStep[]> = {}
    const re = /@keyframes\s+(ap-[a-z0-9-]+)\s*\{([\s\S]*?)\n\s*\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(source)) !== null) out[m[1]!] = stepsOf(m[2]!)
    return out
  }

  const normalSteps = collect(before)
  const normal: Record<string, ParsedMotion> = {}
  for (const [kf, steps] of Object.entries(normalSteps)) {
    const c = composite.get(kf)
    if (!c) throw new Error(`@keyframes ${kf} has no --ap-motion-* composite property`)
    normal[kf] = { steps, ...c }
  }

  return { normal, reduced: collect(after) }
}
```

- [ ] **Step 2: Write the failing gate**

`packages/motion/src/gates/equivalence.gate.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DURATION, EASE } from '@ap/tokens'
import { MOTIONS } from '../motions.js'
import { toMotionVariants } from '../emitVariants.js'
import { cssKeyframeName } from '../emitCss.js'
import { parseMotionCss } from './parseMotionCss.js'

const css = readFileSync(join(import.meta.dirname, '../motion.css'), 'utf8')
const { normal } = parseMotionCss(css)
const variants = toMotionVariants()

/** CSS declaration names → the Motion keyframe keys they correspond to. */
const cssToJs: Record<string, string[]> = {
  opacity: ['opacity'],
  translate: ['x', 'y'],
  scale: ['scale'],
  rotate: ['rotate'],
  height: ['height'],
  'stroke-dashoffset': ['strokeDashoffset'],
}

describe('gate: the CSS and JS emissions are equivalent', () => {
  it('covers exactly the same motion names', () => {
    expect(Object.keys(normal).sort()).toEqual(
      Object.keys(MOTIONS).map(cssKeyframeName).sort(),
    )
    expect(Object.keys(variants).sort()).toEqual(Object.keys(MOTIONS).sort())
  })

  for (const name of Object.keys(MOTIONS)) {
    const kf = cssKeyframeName(name)

    it(`${name}: step offsets agree`, () => {
      const cssAts = normal[kf]!.steps.map((s) => s.at)
      expect(cssAts).toEqual(variants[name]!.transition.times)
    })

    it(`${name}: duration and easing agree, and match the record`, () => {
      const parsed = normal[kf]!
      const spec = MOTIONS[name as keyof typeof MOTIONS]

      // Three-way: CSS token name, source record, and resolved JS value.
      expect(parsed.duration).toBe(spec.duration)
      expect(parsed.ease).toBe(spec.ease)

      const ms = Number(DURATION[spec.duration]!.replace('ms', ''))
      expect(variants[name]!.transition.duration).toBeCloseTo(ms / 1000, 6)

      // Compare the control points numerically. Comparing formatted strings
      // would fail on `0.30` vs `0.3`, which is a formatting difference and
      // not a disagreement about the curve.
      const easeValue = EASE[spec.ease]!
      const jsEase = variants[name]!.transition.ease
      if (easeValue === 'linear') {
        expect(jsEase).toBe('linear')
      } else {
        const points = /^cubic-bezier\(([^)]+)\)$/.exec(easeValue)![1]!
          .split(',')
          .map((n) => Number(n.trim()))
        expect(jsEase).toEqual(points)
      }
    })

    it(`${name}: iteration counts agree`, () => {
      const spec = MOTIONS[name as keyof typeof MOTIONS]
      const expected = spec.iterations === 'infinite' ? 'infinite' : String(spec.iterations)
      expect(normal[kf]!.iterations).toBe(expected)
      expect(variants[name]!.transition.repeat).toBe(
        spec.iterations === 'infinite' ? Infinity : spec.iterations - 1,
      )
    })

    it(`${name}: every animated property agrees value for value`, () => {
      const parsed = normal[kf]!
      const js = variants[name]!.keyframes

      const cssProps = new Set(parsed.steps.flatMap((s) => Object.keys(s.props)))
      const expectedJsKeys = new Set([...cssProps].flatMap((p) => cssToJs[p] ?? [p]))
      expect(new Set(Object.keys(js)), `${name} property sets`).toEqual(expectedJsKeys)

      for (const [i, step] of parsed.steps.entries()) {
        for (const [prop, value] of Object.entries(step.props)) {
          if (prop === 'translate') {
            const [x, y] = value.split(/\s+/)
            if (js['x']) expect(String(js['x'][i]), `${name} x@${step.at}`).toBe(x)
            if (js['y']) expect(String(js['y'][i]), `${name} y@${step.at}`).toBe(y)
          } else {
            const key = cssToJs[prop]![0]!
            expect(String(js[key]![i]), `${name} ${prop}@${step.at}`).toBe(value)
          }
        }
      }
    })
  }
})
```

- [ ] **Step 3: Run and reconcile**

Run: `npm run test:motion`

Expect real disagreements on the first run — that is the gate doing its job. Reconcile each by fixing the **emitters**, not by loosening the assertion. Two known reconciliation points:

- The CSS carries a value at every step for a property, because a step that omits it emits nothing; the JS carries values forward. Where a step legitimately omits a property, the CSS has no declaration for it at that stop, so the loop above simply does not check it — this is correct and needs no change.
- `cubic-bezier(0.16, 1, 0.30, 1)` round-trips through `Number` as `0.3`, not `0.30`. The comparison above normalises trailing zeros; if it still fails, prefer normalising both sides numerically over editing the scale.

If reconciliation requires changing `EASE`'s literal formatting, stop and report it — that value is quoted from ADR-0010 and a change needs a recorded decision.

- [ ] **Step 4: Prove the gate bites**

One at a time, make the change, confirm the specific test fails, then revert:

1. In `emitVariants.ts`, change `repeat` to `spec.iterations` (dropping the −1) → the iteration test fails for `warning.pulse`.
2. In `emitCss.ts`, change `error.shake`'s emitted translate to `-5px` by editing the record → the per-property test fails.
3. In `emitCss.ts`, swap `var(--ap-duration-${s.duration})` for a hardcoded `320ms` → the duration test fails.

Record all three in your report with their real output.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(motion): equivalence gate parsing the emitted CSS against the emitted JS"
```

---

### Task 7: Reduced-motion gate, isolation gate, and wiring

**Files:**
- Create: `packages/motion/src/gates/reduced-motion.gate.test.ts`, `packages/motion/src/gates/isolation.gate.test.ts`
- Modify: root `package.json` (`test:gates`), `.github/workflows/ci.yml`, `docs/CONTRIBUTING.md`

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: `npm run test:motion` covering the whole package; `gen:motion-css` in CI's freshness job.

- [ ] **Step 1: Write the reduced-motion gate**

`packages/motion/src/gates/reduced-motion.gate.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MOTIONS } from '../motions.js'
import { cssKeyframeName } from '../emitCss.js'
import { parseMotionCss } from './parseMotionCss.js'

const css = readFileSync(join(import.meta.dirname, '../motion.css'), 'utf8')
const { reduced } = parseMotionCss(css)

describe('gate: every motion has a reduced-motion definition', () => {
  it('defines a reduced form for all twelve, none missing', () => {
    expect(Object.keys(reduced).sort()).toEqual(
      Object.keys(MOTIONS).map(cssKeyframeName).sort(),
    )
  })

  for (const [name, spec] of Object.entries(MOTIONS)) {
    const kf = cssKeyframeName(name)

    if (spec.reduced === 'opacity') {
      it(`${name}: degrades to opacity alone`, () => {
        const props = new Set(reduced[kf]!.flatMap((s) => Object.keys(s.props)))
        expect(props, `${name} should animate only opacity when reduced`).toEqual(
          new Set(['opacity']),
        )
      })
    } else {
      it(`${name}: degrades to no visual change, but still exists`, () => {
        // Still present so animationend still fires — a component that
        // unmounts on that event must behave identically under reduced motion.
        expect(reduced[kf], `${name} missing entirely`).toBeDefined()
        const props = reduced[kf]!.flatMap((s) => Object.keys(s.props))
        expect(props, `${name} should declare nothing when reduced`).toEqual([])
      })
    }
  }

  it('loops only where the movement is the information', () => {
    const infinite = Object.entries(MOTIONS)
      .filter(([, s]) => s.iterations === 'infinite')
      .map(([n]) => n)
      .sort()
    expect(infinite).toEqual(['skeleton.shimmer', 'spinner.rotate'])
  })
})
```

- [ ] **Step 2: Write the isolation gate**

`packages/motion/src/gates/isolation.gate.test.ts`:

```ts
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return e.name === 'gates' ? [] : sources(p)
    return e.name.endsWith('.ts') && !e.name.includes('.test.') ? [p] : []
  })
}

// ADR-0001: @ap/motion depends on @ap/tokens and nothing else. Its output is
// consumed by build tooling and by the browser, never by Node at runtime.
const FORBIDDEN: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /from ['"]react['"]/, why: '@ap/motion must not depend on React' },
  { pattern: /from ['"]react-dom/, why: '@ap/motion must not depend on react-dom' },
  { pattern: /from ['"]motion/, why: 'Motion is a Phase 4 concern; this package emits data only' },
  { pattern: /from ['"]node:/, why: 'no Node built-ins in emitter source' },
  { pattern: /\bwindow\.|\bdocument\./, why: 'no DOM access in @ap/motion' },
]

describe('gate: @ap/motion depends on @ap/tokens and nothing else', () => {
  const files = sources(SRC)

  it('finds sources to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    it(`${file.split('motion')[1]} is clean`, () => {
      const text = readFileSync(file, 'utf8')
      const hits = FORBIDDEN.filter((r) => r.pattern.test(text)).map((r) => `${r.pattern} — ${r.why}`)
      expect(hits, `${file}:\n  ${hits.join('\n  ')}`).toEqual([])
    })
  }

  it('declares only @ap/tokens as a dependency', () => {
    const pkg = JSON.parse(readFileSync(join(SRC, '../package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@ap/tokens'])
    expect(pkg.peerDependencies ?? {}).toEqual({})
  })
})
```

- [ ] **Step 3: Prove both gates bite**

One at a time, make the change, confirm the specific test fails, then revert:

1. Change `enter.fade-rise`'s `reduced` to `'none'` → its opacity-degradation test fails.
2. Change `warning.pulse`'s `iterations` to `'infinite'` → the loop test fails in both this gate and `motions.test.ts`.
3. Add `import { useState } from 'react'` to `emitCss.ts` → the isolation gate fails.
4. Delete one motion's reduced block by special-casing it in `reducedBlock` → the coverage test fails naming it.

Record all four with their real output.

- [ ] **Step 4: Wire the scripts and CI**

Extend the root `test:gates` script by appending ` && npm run test:motion`:

```json
"test:gates": "npm run test:tokens && npm run test:contrast && npm run test:gamut && npm run test:sweep && npm run test:contract && npm run test:freshness && npm run test:fonts && npm run test:guards && npm run test:motion"
```

In `.github/workflows/ci.yml`, add `gen:motion-css` to the `generated-artifacts-are-fresh` job, alongside the existing generator steps:

```yaml
      - run: npm run gen:motion-css
```

Place it after `npm run gen:theme-css` and before `npm run gen:fonts`. The job's existing `git diff --exit-code` and untracked-file checks then cover `motion.css` with no further change.

- [ ] **Step 5: Document**

In `docs/CONTRIBUTING.md`:

Add to the **Generated files** table:

| File | Regenerate with |
|---|---|
| `packages/motion/src/motion.css` | `npm run gen:motion-css` |

Add to **Rules the gates enforce**:

- Motion is defined once in `packages/motion/src/motions.ts` and emitted twice; never hand-edit `motion.css`.
- Every motion has a `prefers-reduced-motion` definition, and only `skeleton.shimmer` and `spinner.rotate` may loop.
- `@ap/motion` imports nothing but `@ap/tokens`.

Add a short **Motion** section stating: `@ap/motion/motion.css` is opt-in and must be imported **after** `@ap/react/theme.css`, which carries the `@layer ap.tokens, ap.components;` order statement; and that `collapse`/`expand` depend on `--panel-height` supplied by Base UI in Phase 4, so they are emitted but not demonstrable until then.

- [ ] **Step 6: Full verification**

Run in order and confirm each is green:

```bash
npm run typecheck
npm test
npm run test:gates
npm run test:consumer
npm run test:ssr
npm run test:hydration
```

Then confirm the freshness job would pass locally:

```bash
npm run gen:theme-contract && npm run gen:theme-css && npm run gen:motion-css && npm run gen:fonts && npm run gen:font-metrics
git diff --exit-code && git status --porcelain --untracked-files=all
```

Both must report nothing.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(motion): reduced-motion and isolation gates, CI wiring, contributor docs"
```

---

## Verification (Phase 3 exit criteria)

Run in order; all must hold:

1. `npm run typecheck` — clean across all four packages.
2. `npm test` — full suite green, including Phase 1 and 2's tests.
3. `npm run test:motion` — the equivalence, reduced-motion, freshness and isolation gates all pass.
4. **The stated exit criterion:** the equivalence gate asserts the CSS and JS emissions agree on names, offsets, per-step values, duration and easing — with both sides read as artifacts — and the reduced-motion gate asserts every motion has a `prefers-reduced-motion` definition.
5. Regenerate every artifact and confirm no drift.

**Proof artifact:** a green CI run on `main` with all four jobs passing, plus the four deliberate-failure demonstrations recorded in the task reports showing each gate failing when its guarantee is violated.

## Out of scope for this plan (deliberately)

- Any `motion/react` dependency, the optional-peer import guard, and `<MotionConfig reducedMotion="user">` — Phase 4.
- Component consumption. Nothing imports `@ap/motion` at the end of this phase; its gates are its only consumers, and `@ap/react` deliberately does not gain the dependency.
- Scroll-driven motion, gesture-driven motion, layout animation, spring physics.
- A 400ms duration step for `success.check`, which maps to `slower` (see the spec's §5).
- Demonstrating `collapse`/`expand` end to end — they need `--panel-height` from Base UI in Phase 4.
