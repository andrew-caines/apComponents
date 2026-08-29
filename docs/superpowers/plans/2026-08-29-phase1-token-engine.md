# Phase 1 — Token Engine (`@ap/tokens`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@ap/tokens` — a zero-dependency, React-free theme generator that turns one brand colour into a complete accessible token set — and make gates 1–3 (determinism, contrast, gamut) pass in CI-runnable form.

**Architecture:** Pure functions throughout: hex → OKLCH → 12-step role ramps (light+dark, P3 overrides) → Tier 2 semantic map → CSS text. Colour math (OKLCH conversion, gamut mapping, APCA, WCAG) is hand-rolled from published reference constants so the package keeps zero runtime dependencies (ADR-0001). Everything is deterministic — no `Date.now`, no randomness, values rounded to fixed precision before emission.

**Tech Stack:** TypeScript (strict, NodeNext, ESM-only), Vitest, tsx (dev script runner), `@capsizecss/core` + `@capsizecss/metrics` (devDependency only — generates the static font-metrics table).

**Spec:** `docs/superpowers/specs/2026-08-29-component-library-design.md` and ADRs 0001, 0006, 0007, 0008, 0009, 0015, 0016, 0017 in `docs/adr/`.

## Global Constraints

- `@ap/tokens` has **zero runtime dependencies** and never imports React, DOM APIs, or Node-only APIs in `src/` (ADR-0001). Guarded by a test in Task 12.
- ESM-only, Node ≥ 22, TypeScript strict mode (ADR-0005).
- All token names use the `--ap-` prefix (ADR-0007). Tier naming: primitives `--ap-{hue}-{step}`, semantic `--ap-color-{role}`.
- Components/tiers rule: the generator writes Tier 1; Tier 2 references Tier 1 via `var()`; Tier 3 arrives with components in Phase 4 (ADR-0007).
- Deterministic output: identical input → byte-identical output across runs and platforms. Round OKLCH components to 6 dp, hex to 2 digits/channel, P3 channels to 4 dp before formatting (ADR-0014).
- WCAG 2.1 AA is a hard gate: body-text pairings ≥ 4.5:1, non-text UI ≥ 3:1, both modes (ADR-0008). APCA drives generation targets (Lc 75 body / 60 secondary / 45 non-text).
- No placeholder values: every constant in this plan is the real starting value; tuning happens later via snapshot updates, not via TBDs.
- Windows dev machine: all commands must work in Git Bash/PowerShell; use `node`/`npx`, no shell-specific syntax in npm scripts.

## File Structure

```
apComponents/
├── package.json                      root: private, workspaces, scripts, devDeps
├── tsconfig.base.json
├── .gitignore
├── packages/tokens/
│   ├── package.json                  @ap/tokens — zero deps
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                  public exports
│       ├── colour/
│       │   ├── types.ts              Oklch, Srgb, Mode
│       │   ├── oklch.ts              hex ↔ OKLCH (Ottosson reference matrices)
│       │   ├── gamut.ts              inSrgb, clampToSrgb, P3 conversion/format
│       │   ├── wcag.ts               relative luminance, wcagRatio
│       │   ├── apca.ts               APCA-W3 0.0.98G-4g Lc
│       │   ├── ramp.ts               12-step ramp generation + contrast solve
│       │   └── semantics.ts          hue nudge, semantic/neutral seed derivation
│       ├── scales/
│       │   └── scales.ts             space, text, radius, elevation, z, misc
│       ├── breakpoints.ts            breakpoint + media constants (TS, not CSS vars)
│       ├── typography/
│       │   ├── fonts.ts              font resolution, stacks, weights
│       │   └── metrics.generated.ts  fallback metrics table (generated, committed)
│       ├── theme/
│       │   ├── semanticMap.ts        Tier 2 role → Tier 1 step mapping
│       │   └── generateTheme.ts      public entry: seed → Theme
│       ├── emit/
│       │   ├── cssText.ts            Theme → CSS (@layer, modes, P3, coarse)
│       │   └── contrastReport.ts     pairing list + markdown report
│       └── gates/
│           ├── determinism.gate.test.ts   gate 1
│           ├── contrast.gate.test.ts      gate 2
│           ├── gamut.gate.test.ts         gate 3
│           └── react-free.gate.test.ts    ADR-0001 guard
├── scripts/
│   ├── gen-font-metrics.ts           dev-only: capsize → metrics.generated.ts
│   └── contrast-report.ts            writes reports/contrast.md
└── reports/                          gitignored except .gitkeep; CI artifact
```

Unit tests are colocated: `src/colour/oklch.test.ts` next to `src/colour/oklch.ts`, etc. Gate tests live in `src/gates/` so the npm scripts `test:tokens|contrast|gamut` can target them by path.

---

### Task 1: Repository scaffold and toolchain

**Files:**
- Create: `.gitignore`, `package.json`, `tsconfig.base.json`
- Create: `packages/tokens/package.json`, `packages/tokens/tsconfig.json`
- Create: `packages/tokens/src/index.ts`, `packages/tokens/src/index.test.ts`
- Create: `reports/.gitkeep`

**Interfaces:**
- Consumes: nothing (empty directory; docs already exist on disk).
- Produces: a working `npm test` (Vitest) that later tasks add tests into; `@ap/tokens` package resolvable as `@ap/tokens` inside the workspace.

- [ ] **Step 1: Initialise git and commit the existing design docs**

```bash
cd D:/dev/work/apComponents
git init -b main
printf 'node_modules/\ndist/\nreports/*\n!reports/.gitkeep\n*.tsbuildinfo\n' > .gitignore
mkdir -p reports && touch reports/.gitkeep
git add docs .gitignore reports/.gitkeep
git commit -m "docs: ADRs 0001-0017 and system design"
```

- [ ] **Step 2: Root package.json and base tsconfig**

`package.json`:

```json
{
  "name": "apcomponents",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "workspaces": ["packages/*"],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:tokens": "vitest run packages/tokens/src/gates/determinism.gate.test.ts",
    "test:contrast": "vitest run packages/tokens/src/gates/contrast.gate.test.ts",
    "test:gamut": "vitest run packages/tokens/src/gates/gamut.gate.test.ts",
    "typecheck": "tsc -b packages/tokens",
    "report:contrast": "tsx scripts/contrast-report.ts",
    "gen:font-metrics": "tsx scripts/gen-font-metrics.ts"
  },
  "devDependencies": {
    "@capsizecss/core": "^4.1.2",
    "@capsizecss/metrics": "^3.5.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  }
}
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "composite": true
  }
}
```

- [ ] **Step 3: `@ap/tokens` package skeleton**

`packages/tokens/package.json` — note: **no `dependencies` key at all**; consumers compile source (ADR-0002), so exports point at source:

```json
{
  "name": "@ap/tokens",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": false,
  "exports": { ".": "./src/index.ts" },
  "engines": { "node": ">=22" }
}
```

`packages/tokens/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}
```

`packages/tokens/src/index.ts`:

```ts
export const VERSION = '0.1.0'
```

- [ ] **Step 4: Write a smoke test, install, and verify the toolchain runs**

`packages/tokens/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { VERSION } from './index.js'

describe('toolchain', () => {
  it('resolves the package source', () => {
    expect(VERSION).toBe('0.1.0')
  })
})
```

Run: `npm install && npm test`
Expected: 1 test file, 1 passed. Also run `npm run typecheck` — clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: npm workspace scaffold, @ap/tokens skeleton, vitest toolchain"
```

---

### Task 2: OKLCH ↔ sRGB conversion

**Files:**
- Create: `packages/tokens/src/colour/types.ts`
- Create: `packages/tokens/src/colour/oklch.ts`
- Test: `packages/tokens/src/colour/oklch.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Oklch { l: number; c: number; h: number }` (h in degrees, 0–360)
  - `type Mode = 'light' | 'dark'`
  - `hexToOklch(hex: string): Oklch` — accepts `#rgb`/`#rrggbb`, case-insensitive; throws `Error` on malformed input
  - `oklchToHex(colour: Oklch): string` — lowercase `#rrggbb`; channels clamped to [0,1] (callers gamut-map first; clamp is a safety net for float dust)
  - `oklchToLinearSrgb(colour: Oklch): { r: number; g: number; b: number }` (linear, unclamped — gamut.ts needs out-of-range values)
  - `round6(n: number): number` — 6-dp rounding used everywhere for determinism

- [ ] **Step 1: Write failing tests with published reference values**

`packages/tokens/src/colour/oklch.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { hexToOklch, oklchToHex } from './oklch.js'

describe('hexToOklch', () => {
  it('converts white', () => {
    const c = hexToOklch('#ffffff')
    expect(c.l).toBeCloseTo(1, 4)
    expect(c.c).toBeCloseTo(0, 4)
  })
  it('converts black', () => {
    expect(hexToOklch('#000000').l).toBeCloseTo(0, 4)
  })
  it('converts sRGB red to the published OKLCH value', () => {
    // reference: oklch(0.627955 0.257683 29.2339) — Ottosson / CSS Color 4
    const c = hexToOklch('#ff0000')
    expect(c.l).toBeCloseTo(0.627955, 3)
    expect(c.c).toBeCloseTo(0.257683, 3)
    expect(c.h).toBeCloseTo(29.2339, 1)
  })
  it('accepts shorthand and uppercase', () => {
    expect(hexToOklch('#F00')).toEqual(hexToOklch('#ff0000'))
  })
  it('throws on malformed input', () => {
    expect(() => hexToOklch('red')).toThrow()
    expect(() => hexToOklch('#12345')).toThrow()
  })
})

describe('round-trip', () => {
  it('hex → oklch → hex is identity for a sample set', () => {
    for (const hex of ['#2e5fd9', '#ff0000', '#00ff00', '#123456', '#fafafa', '#111111']) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex)
    }
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/tokens/src/colour/oklch.test.ts`
Expected: FAIL — cannot find module `./oklch.js`.

- [ ] **Step 3: Implement**

`packages/tokens/src/colour/types.ts`:

```ts
/** OKLCH colour. h in degrees [0, 360). */
export interface Oklch {
  l: number
  c: number
  h: number
}

export type Mode = 'light' | 'dark'
```

`packages/tokens/src/colour/oklch.ts` — Ottosson's reference matrices (https://bottosson.github.io/posts/oklab/):

```ts
import type { Oklch } from './types.js'

export const round6 = (n: number): number => Math.round(n * 1e6) / 1e6

const srgbToLinear = (u: number): number =>
  u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4

const linearToSrgb = (u: number): number =>
  u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055

export function hexToOklch(hex: string): Oklch {
  const m = /^#(?:([0-9a-f]{3})|([0-9a-f]{6}))$/i.exec(hex.trim())
  if (!m) throw new Error(`Invalid hex colour: ${hex}`)
  const full = m[1] ? [...m[1]].map((ch) => ch + ch).join('') : m[2]!
  const r = srgbToLinear(parseInt(full.slice(0, 2), 16) / 255)
  const g = srgbToLinear(parseInt(full.slice(2, 4), 16) / 255)
  const b = srgbToLinear(parseInt(full.slice(4, 6), 16) / 255)

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const L = 0.2104542553 * l + 0.793617785 * m_ - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m_ + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m_ - 0.808675766 * s

  const c = Math.hypot(a, bb)
  let h = (Math.atan2(bb, a) * 180) / Math.PI
  if (h < 0) h += 360
  // hue of an achromatic colour is numerically meaningless noise — pin it
  return { l: round6(L), c: round6(c), h: c < 1e-6 ? 0 : round6(h) }
}

export function oklchToLinearSrgb(colour: Oklch): { r: number; g: number; b: number } {
  const hr = (colour.h * Math.PI) / 180
  const a = colour.c * Math.cos(hr)
  const bb = colour.c * Math.sin(hr)

  const l_ = colour.l + 0.3963377774 * a + 0.2158037573 * bb
  const m_ = colour.l - 0.1055613458 * a - 0.0638541728 * bb
  const s_ = colour.l - 0.0894841775 * a - 1.291485548 * bb

  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3

  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  }
}

export function oklchToHex(colour: Oklch): string {
  const lin = oklchToLinearSrgb(colour)
  const to255 = (u: number): string =>
    Math.round(Math.min(1, Math.max(0, linearToSrgb(u))) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to255(lin.r)}${to255(lin.g)}${to255(lin.b)}`
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run packages/tokens/src/colour/oklch.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/tokens/src/colour
git commit -m "feat(tokens): OKLCH <-> sRGB conversion from Ottosson reference matrices"
```

---

### Task 3: Gamut mapping and Display-P3

**Files:**
- Create: `packages/tokens/src/colour/gamut.ts`
- Test: `packages/tokens/src/colour/gamut.test.ts`

**Interfaces:**
- Consumes: `oklchToLinearSrgb`, `round6`, `Oklch` from Task 2.
- Produces:
  - `inSrgb(colour: Oklch): boolean`
  - `clampToSrgb(colour: Oklch): Oklch` — reduces chroma (binary search, hue and lightness held) until in sRGB gamut; identity if already in gamut. This is ADR-0006's gamut mapping.
  - `inP3(colour: Oklch): boolean`
  - `clampToP3(colour: Oklch): Oklch` — same, against Display-P3
  - `formatP3(colour: Oklch): string` — `color(display-p3 r g b)`, channels rounded to 4 dp

- [ ] **Step 1: Write failing tests**

`packages/tokens/src/colour/gamut.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { hexToOklch } from './oklch.js'
import { clampToSrgb, formatP3, inP3, inSrgb } from './gamut.js'

describe('gamut', () => {
  it('every hex-derived colour is in sRGB', () => {
    expect(inSrgb(hexToOklch('#2e5fd9'))).toBe(true)
    expect(inSrgb(hexToOklch('#ff0000'))).toBe(true)
  })
  it('detects out-of-sRGB colours', () => {
    // vivid green beyond sRGB: oklch(0.8 0.3 145)
    expect(inSrgb({ l: 0.8, c: 0.3, h: 145 })).toBe(false)
  })
  it('clampToSrgb preserves lightness and hue, reduces chroma into gamut', () => {
    const out = clampToSrgb({ l: 0.8, c: 0.3, h: 145 })
    expect(out.l).toBe(0.8)
    expect(out.h).toBe(145)
    expect(out.c).toBeLessThan(0.3)
    expect(inSrgb(out)).toBe(true)
  })
  it('clampToSrgb is identity for in-gamut colours', () => {
    const c = hexToOklch('#2e5fd9')
    expect(clampToSrgb(c)).toEqual(c)
  })
  it('P3 is wider than sRGB', () => {
    const vivid = { l: 0.7, c: 0.26, h: 145 }
    expect(inSrgb(vivid)).toBe(false)
    expect(inP3(vivid)).toBe(true)
  })
  it('formats display-p3 with 4dp channels', () => {
    expect(formatP3(hexToOklch('#ff0000'))).toMatch(
      /^color\(display-p3 0\.\d{1,4} 0\.\d{1,4} 0(\.\d{1,4})?\)$/,
    )
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run packages/tokens/src/colour/gamut.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

`packages/tokens/src/colour/gamut.ts`:

```ts
import type { Oklch } from './types.js'
import { oklchToLinearSrgb, round6 } from './oklch.js'

const EPS = 1e-6

/** OKLab non-linear LMS → XYZ (inverse of Ottosson M1). */
const LMS_TO_XYZ = [
  [1.2270138511, -0.5577999807, 0.281256149],
  [-0.0405801784, 1.1122568696, -0.0716766787],
  [-0.0763812845, -0.4214819784, 1.5861632204],
] as const

/** XYZ (D65) → linear Display-P3. */
const XYZ_TO_P3 = [
  [2.4934969119, -0.9313836179, -0.4027107845],
  [-0.8294889696, 1.7626640603, 0.0236246858],
  [0.0358458302, -0.0761723893, 0.956884524],
] as const

function oklchToLinearP3(colour: Oklch): { r: number; g: number; b: number } {
  const hr = (colour.h * Math.PI) / 180
  const a = colour.c * Math.cos(hr)
  const bb = colour.c * Math.sin(hr)
  const l_ = colour.l + 0.3963377774 * a + 0.2158037573 * bb
  const m_ = colour.l - 0.1055613458 * a - 0.0638541728 * bb
  const s_ = colour.l - 0.0894841775 * a - 1.291485548 * bb
  const lms = [l_ ** 3, m_ ** 3, s_ ** 3]
  const xyz = LMS_TO_XYZ.map((row) => row[0] * lms[0]! + row[1] * lms[1]! + row[2] * lms[2]!)
  const [r, g, b] = XYZ_TO_P3.map(
    (row) => row[0] * xyz[0]! + row[1] * xyz[1]! + row[2] * xyz[2]!,
  )
  return { r: r!, g: g!, b: b! }
}

const within01 = (v: { r: number; g: number; b: number }): boolean =>
  v.r >= -EPS && v.r <= 1 + EPS && v.g >= -EPS && v.g <= 1 + EPS && v.b >= -EPS && v.b <= 1 + EPS

export const inSrgb = (colour: Oklch): boolean => within01(oklchToLinearSrgb(colour))
export const inP3 = (colour: Oklch): boolean => within01(oklchToLinearP3(colour))

function clampChroma(colour: Oklch, isIn: (c: Oklch) => boolean): Oklch {
  if (isIn(colour)) return colour
  let lo = 0
  let hi = colour.c
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2
    if (isIn({ ...colour, c: mid })) lo = mid
    else hi = mid
  }
  return { ...colour, c: round6(lo) }
}

export const clampToSrgb = (colour: Oklch): Oklch => clampChroma(colour, inSrgb)
export const clampToP3 = (colour: Oklch): Oklch => clampChroma(colour, inP3)

const linearToP3Gamma = (u: number): number =>
  u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055

export function formatP3(colour: Oklch): string {
  const lin = oklchToLinearP3(clampToP3(colour))
  const ch = (u: number): number =>
    Math.round(Math.min(1, Math.max(0, linearToP3Gamma(u))) * 1e4) / 1e4
  return `color(display-p3 ${ch(lin.r)} ${ch(lin.g)} ${ch(lin.b)})`
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run packages/tokens/src/colour/gamut.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tokens/src/colour
git commit -m "feat(tokens): sRGB/P3 gamut detection and chroma-reducing gamut mapping"
```

---

### Task 4: WCAG 2.1 contrast

**Files:**
- Create: `packages/tokens/src/colour/wcag.ts`
- Test: `packages/tokens/src/colour/wcag.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (operates on hex strings directly).
- Produces:
  - `relativeLuminance(hex: string): number` — WCAG 2.1 definition
  - `wcagRatio(hexA: string, hexB: string): number` — symmetric, ≥ 1, rounded to 4 dp

- [ ] **Step 1: Write failing tests** (`wcag.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { relativeLuminance, wcagRatio } from './wcag.js'

describe('wcag', () => {
  it('white/black is 21:1', () => {
    expect(wcagRatio('#ffffff', '#000000')).toBe(21)
  })
  it('is symmetric', () => {
    expect(wcagRatio('#2e5fd9', '#ffffff')).toBe(wcagRatio('#ffffff', '#2e5fd9'))
  })
  it('matches a known value: #777777 on #ffffff ≈ 4.48', () => {
    expect(wcagRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })
  it('luminance of white is 1, black is 0', () => {
    expect(relativeLuminance('#ffffff')).toBe(1)
    expect(relativeLuminance('#000000')).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify failure** — FAIL, module not found.

- [ ] **Step 3: Implement** (`wcag.ts`):

```ts
const channel = (hexPair: string): number => {
  const u = parseInt(hexPair, 16) / 255
  return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`relativeLuminance needs #rrggbb, got: ${hex}`)
  const s = m[1]!
  return (
    0.2126 * channel(s.slice(0, 2)) +
    0.7152 * channel(s.slice(2, 4)) +
    0.0722 * channel(s.slice(4, 6))
  )
}

export function wcagRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA)
  const lb = relativeLuminance(hexB)
  const [dark, light] = la < lb ? [la, lb] : [lb, la]
  return Math.round(((light + 0.05) / (dark + 0.05)) * 1e4) / 1e4
}
```

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat(tokens): WCAG 2.1 relative luminance and contrast ratio"`

---

### Task 5: APCA contrast (0.0.98G-4g)

**Files:**
- Create: `packages/tokens/src/colour/apca.ts`
- Test: `packages/tokens/src/colour/apca.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `apcaLc(textHex: string, bgHex: string): number` — signed Lc (positive: dark text on light bg; negative: light on dark), per the APCA-W3 0.0.98G-4g constants. Callers compare `Math.abs(lc)`.

- [ ] **Step 1: Write failing tests with the apca-w3 published vectors** (`apca.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { apcaLc } from './apca.js'

// Reference vectors from the apca-w3 package documentation (0.0.98G-4g)
describe('apcaLc', () => {
  it('#888 text on #fff bg ≈ 63.06', () => {
    expect(apcaLc('#888888', '#ffffff')).toBeCloseTo(63.06, 1)
  })
  it('#fff text on #888 bg ≈ -68.54', () => {
    expect(apcaLc('#ffffff', '#888888')).toBeCloseTo(-68.54, 1)
  })
  it('#000 text on #aaa bg ≈ 58.15', () => {
    expect(apcaLc('#000000', '#aaaaaa')).toBeCloseTo(58.15, 1)
  })
  it('#aaa text on #000 bg ≈ -56.24', () => {
    expect(apcaLc('#aaaaaa', '#000000')).toBeCloseTo(-56.24, 1)
  })
  it('identical colours → 0', () => {
    expect(apcaLc('#777777', '#777777')).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** (`apca.ts`):

```ts
// APCA-W3 0.0.98G-4g — constants from Myndex/SAPC-APCA (W3 licence).
const S_TRC = 2.4
const R_CO = 0.2126729
const G_CO = 0.7151522
const B_CO = 0.072175
const NORM_BG = 0.56
const NORM_TXT = 0.57
const REV_TXT = 0.62
const REV_BG = 0.65
const BLK_THRS = 0.022
const BLK_CLMP = 1.414
const SCALE = 1.14
const LO_OFFSET = 0.027
const LO_CLIP = 0.1
const DELTA_Y_MIN = 0.0005

function screenY(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`apcaLc needs #rrggbb, got: ${hex}`)
  const s = m[1]!
  const c = (p: string): number => (parseInt(p, 16) / 255) ** S_TRC
  return R_CO * c(s.slice(0, 2)) + G_CO * c(s.slice(2, 4)) + B_CO * c(s.slice(4, 6))
}

const softClamp = (y: number): number =>
  y > BLK_THRS ? y : y + (BLK_THRS - y) ** BLK_CLMP

export function apcaLc(textHex: string, bgHex: string): number {
  const yTxt = softClamp(screenY(textHex))
  const yBg = softClamp(screenY(bgHex))
  if (Math.abs(yBg - yTxt) < DELTA_Y_MIN) return 0

  let lc: number
  if (yBg > yTxt) {
    const sapc = (yBg ** NORM_BG - yTxt ** NORM_TXT) * SCALE
    lc = sapc < LO_CLIP ? 0 : sapc - LO_OFFSET
  } else {
    const sapc = (yBg ** REV_BG - yTxt ** REV_TXT) * SCALE
    lc = sapc > -LO_CLIP ? 0 : sapc + LO_OFFSET
  }
  return Math.round(lc * 100 * 1e4) / 1e4
}
```

- [ ] **Step 4: Run to verify pass.** If any reference vector is off by > 0.1, the constant table is mistyped — compare against the apca-w3 source before touching the algorithm shape.

- [ ] **Step 5: Commit** — `git commit -m "feat(tokens): APCA-W3 0.0.98G-4g contrast"`

---

### Task 6: Hue utilities and seed derivation

**Files:**
- Create: `packages/tokens/src/colour/semantics.ts`
- Test: `packages/tokens/src/colour/semantics.test.ts`

**Interfaces:**
- Consumes: `Oklch`, `round6` from Task 2.
- Produces:
  - `nudgeHue(base: number, toward: number, maxDegrees?: number): number` — moves `base` toward `toward` along the shortest arc by `min(maxDegrees, |Δ|)`; default max 10 (ADR-0006)
  - `deriveSeeds(brand: Oklch): { neutral: Oklch; danger: Oklch; warning: Oklch; success: Oklch; info: Oklch }`
  - Exported constants: `SEMANTIC_BASES = { danger: { l: 0.55, c: 0.19, h: 25 }, warning: { l: 0.77, c: 0.16, h: 80 }, success: { l: 0.56, c: 0.15, h: 145 }, info: { l: 0.55, c: 0.14, h: 250 } }`, `NEUTRAL_CHROMA = 0.008`

- [ ] **Step 1: Write failing tests** (`semantics.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { deriveSeeds, nudgeHue } from './semantics.js'

describe('nudgeHue', () => {
  it('moves toward the target, capped at 10°', () => {
    expect(nudgeHue(25, 260)).toBe(15) // shortest arc from 25 to 260 goes DOWN through 0 (−125°), capped at −10
    expect(nudgeHue(250, 260)).toBe(260) // |Δ|=10 → lands exactly
    expect(nudgeHue(145, 148)).toBe(148) // |Δ|<10 → lands on target
  })
  it('takes the shortest arc across 0°', () => {
    expect(nudgeHue(5, 350)).toBe(355)
  })
  it('never exceeds the cap', () => {
    expect(Math.abs(nudgeHue(80, 260) - 80)).toBeLessThanOrEqual(10)
  })
})

describe('deriveSeeds', () => {
  const brand = { l: 0.55, c: 0.17, h: 262 } // blue-family
  const seeds = deriveSeeds(brand)
  it('neutral takes brand hue at low chroma', () => {
    expect(seeds.neutral.h).toBe(262)
    expect(seeds.neutral.c).toBe(0.008)
  })
  it('danger stays in the red family (25° ± 10°)', () => {
    expect(Math.abs(seeds.danger.h - 25)).toBeLessThanOrEqual(10)
  })
  it('success stays in the green family', () => {
    expect(Math.abs(seeds.success.h - 145)).toBeLessThanOrEqual(10)
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** (`semantics.ts`):

```ts
import type { Oklch } from './types.js'
import { round6 } from './oklch.js'

export const NEUTRAL_CHROMA = 0.008

export const SEMANTIC_BASES = {
  danger: { l: 0.55, c: 0.19, h: 25 },
  warning: { l: 0.77, c: 0.16, h: 80 },
  success: { l: 0.56, c: 0.15, h: 145 },
  info: { l: 0.55, c: 0.14, h: 250 },
} as const satisfies Record<string, Oklch>

/** Move `base` toward `toward` along the shortest arc, by at most maxDegrees. */
export function nudgeHue(base: number, toward: number, maxDegrees = 10): number {
  let delta = ((toward - base + 540) % 360) - 180 // shortest signed arc
  delta = Math.max(-maxDegrees, Math.min(maxDegrees, delta))
  return round6((base + delta + 360) % 360)
}

export function deriveSeeds(brand: Oklch): {
  neutral: Oklch
  danger: Oklch
  warning: Oklch
  success: Oklch
  info: Oklch
} {
  const nudged = (base: Oklch): Oklch => ({ ...base, h: nudgeHue(base.h, brand.h) })
  return {
    neutral: { l: brand.l, c: NEUTRAL_CHROMA, h: brand.h },
    danger: nudged(SEMANTIC_BASES.danger),
    warning: nudged(SEMANTIC_BASES.warning),
    success: nudged(SEMANTIC_BASES.success),
    info: nudged(SEMANTIC_BASES.info),
  }
}
```

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat(tokens): semantic and neutral seed derivation with 10-degree hue nudge"`

---

### Task 7: 12-step ramp generation with contrast solving

This is the heart of the engine. Read ADR-0006's step-role table before starting.

**Files:**
- Create: `packages/tokens/src/colour/ramp.ts`
- Test: `packages/tokens/src/colour/ramp.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–5 (`Oklch`, `Mode`, `oklchToHex`, `inSrgb`, `clampToSrgb`, `formatP3`, `wcagRatio`, `apcaLc`, `round6`).
- Produces:
  - `interface RampStep { hex: string; p3: string | null }` — `p3` non-null only when the ideal colour was outside sRGB (ADR-0006: emit richer value only where it exists)
  - `interface Ramp { steps: RampStep[]; onSolid: string }` — `steps.length === 12` (index 0 = step 1); `onSolid` is `#ffffff` or a dark tinted hex, whichever contrasts better with step 9
  - `generateRamp(seed: Oklch, mode: Mode): Ramp`
  - `solveTextLightness(colour: Oklch, backgrounds: string[], mode: Mode, minWcag: number, minApcaAbs: number): Oklch` (exported for testing)

- [ ] **Step 1: Write failing tests** (`ramp.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { hexToOklch } from './oklch.js'
import { inSrgb } from './gamut.js'
import { wcagRatio } from './wcag.js'
import { apcaLc } from './apca.js'
import { generateRamp } from './ramp.js'

const brand = hexToOklch('#2e5fd9')

describe('generateRamp / light', () => {
  const ramp = generateRamp(brand, 'light')

  it('produces exactly 12 steps, all valid hex', () => {
    expect(ramp.steps).toHaveLength(12)
    for (const s of ramp.steps) expect(s.hex).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('step 9 is the seed colour (anchored)', () => {
    expect(ramp.steps[8]!.hex).toBe('#2e5fd9')
  })
  it('lightness decreases monotonically across steps 1→12', () => {
    const ls = ramp.steps.map((s) => hexToOklch(s.hex).l)
    for (let i = 1; i < 12; i++) expect(ls[i]!).toBeLessThan(ls[i - 1]!)
  })
  it('step 11 meets 4.5:1 WCAG and |Lc| ≥ 75 APCA on steps 1 and 2', () => {
    for (const bg of [ramp.steps[0]!.hex, ramp.steps[1]!.hex]) {
      expect(wcagRatio(ramp.steps[10]!.hex, bg)).toBeGreaterThanOrEqual(4.5)
      expect(Math.abs(apcaLc(ramp.steps[10]!.hex, bg))).toBeGreaterThanOrEqual(75)
    }
  })
  it('step 12 meets 7:1 on step 1', () => {
    expect(wcagRatio(ramp.steps[11]!.hex, ramp.steps[0]!.hex)).toBeGreaterThanOrEqual(7)
  })
  it('onSolid meets 4.5:1 on step 9', () => {
    expect(wcagRatio(ramp.onSolid, ramp.steps[8]!.hex)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('generateRamp / dark', () => {
  const ramp = generateRamp(brand, 'dark')
  it('lightness increases monotonically (dark is rebuilt, not inverted)', () => {
    const ls = ramp.steps.map((s) => hexToOklch(s.hex).l)
    for (let i = 1; i < 12; i++) expect(ls[i]!).toBeGreaterThan(ls[i - 1]!)
  })
  it('canvas is never pure black and text never pure white (halation rule)', () => {
    expect(ramp.steps[0]!.hex).not.toBe('#000000')
    expect(ramp.steps[11]!.hex).not.toBe('#ffffff')
  })
  it('step 11 passes 4.5:1 and Lc 75 on steps 1 and 2', () => {
    for (const bg of [ramp.steps[0]!.hex, ramp.steps[1]!.hex]) {
      expect(wcagRatio(ramp.steps[10]!.hex, bg)).toBeGreaterThanOrEqual(4.5)
      expect(Math.abs(apcaLc(ramp.steps[10]!.hex, bg))).toBeGreaterThanOrEqual(75)
    }
  })
})

describe('generateRamp / gamut behaviour', () => {
  it('a high-chroma seed produces in-sRGB hex with a P3 alternative on step 9', () => {
    const vivid = { l: 0.65, c: 0.29, h: 145 } // outside sRGB
    const ramp = generateRamp(vivid, 'light')
    expect(inSrgb(hexToOklch(ramp.steps[8]!.hex))).toBe(true)
    expect(ramp.steps[8]!.p3).toMatch(/^color\(display-p3 /)
  })
  it('in-sRGB steps carry no P3 override', () => {
    const ramp = generateRamp(brand, 'light')
    expect(ramp.steps[0]!.p3).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** (`ramp.ts`):

```ts
import type { Mode, Oklch } from './types.js'
import { oklchToHex, round6 } from './oklch.js'
import { clampToSrgb, formatP3, inSrgb } from './gamut.js'
import { wcagRatio } from './wcag.js'
import { apcaLc } from './apca.js'

export interface RampStep {
  hex: string
  p3: string | null
}

export interface Ramp {
  steps: RampStep[]
  onSolid: string
}

// Lightness targets per step (index 0 = step 1). NaN = anchored to seed.
// These are the tuning surface: change them, review the snapshot diff (gate 1),
// re-run the contrast gate (gate 2). ADR-0006 documents the role of each step.
const L_TARGETS: Record<Mode, number[]> = {
  light: [0.994, 0.981, 0.955, 0.928, 0.898, 0.858, 0.805, 0.727, NaN, NaN, 0.5, 0.243],
  dark: [0.178, 0.212, 0.252, 0.288, 0.322, 0.37, 0.432, 0.517, NaN, NaN, 0.78, 0.93],
}

// Chroma per step, as a fraction of seed chroma.
const C_CURVE = [0.06, 0.1, 0.2, 0.3, 0.4, 0.5, 0.62, 0.8, 1, 1, 0.9, 0.55]
// Absolute chroma ceilings for steps 1–2 keep backgrounds calm at any seed.
const C_ABS_CAP: Array<number | null> = [0.02, 0.03, null, null, null, null, null, null, null, null, null, null]

const HOVER_L_DELTA = 0.04 // step 10: darker in light mode, lighter in dark

function toStep(ideal: Oklch): RampStep {
  const srgb = clampToSrgb(ideal)
  return {
    hex: oklchToHex(srgb),
    p3: inSrgb(ideal) ? null : formatP3(ideal),
  }
}

/**
 * Move colour.l away from the given backgrounds (darker in light mode,
 * lighter in dark mode) by bisection until WCAG and APCA thresholds hold
 * against every background. Throws if the extreme bound cannot satisfy —
 * a generator bug, not a data condition.
 */
export function solveTextLightness(
  colour: Oklch,
  backgrounds: string[],
  mode: Mode,
  minWcag: number,
  minApcaAbs: number,
): Oklch {
  const bound = mode === 'light' ? 0.05 : 0.985
  const passes = (l: number): boolean => {
    const hex = oklchToHex(clampToSrgb({ ...colour, l }))
    return backgrounds.every(
      (bg) => wcagRatio(hex, bg) >= minWcag && Math.abs(apcaLc(hex, bg)) >= minApcaAbs,
    )
  }
  if (passes(colour.l)) return colour
  if (!passes(bound)) {
    throw new Error(
      `solveTextLightness: unsatisfiable at bound ${bound} for ${JSON.stringify(colour)}`,
    )
  }
  let lo = colour.l // fails
  let hi = bound // passes
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (passes(mid)) hi = mid
    else lo = mid
  }
  return { ...colour, l: round6(hi) }
}

const DARK_TEXT: Oklch = { l: 0.22, c: 0, h: 0 }

export function generateRamp(seed: Oklch, mode: Mode): Ramp {
  const anchored = clampToSrgb(seed)
  const steps: RampStep[] = []

  const hoverL = round6(
    mode === 'light'
      ? Math.max(0.1, anchored.l - HOVER_L_DELTA)
      : Math.min(0.95, anchored.l + HOVER_L_DELTA),
  )

  for (let i = 0; i < 12; i++) {
    if (i === 8) {
      steps.push(toStep(seed)) // step 9: the seed itself (P3 kept if richer)
      continue
    }
    if (i === 9) {
      steps.push(toStep({ l: hoverL, c: seed.c, h: seed.h })) // step 10: hover
      continue
    }
    const cap = C_ABS_CAP[i]
    const c = round6(Math.min(seed.c * C_CURVE[i]!, cap ?? Infinity))
    steps.push(toStep({ l: L_TARGETS[mode][i]!, c, h: seed.h }))
  }

  // Contrast-solve the text steps against steps 1–3 (step 11 is also used on
  // bg-subtle = step 3 by the Tier 2 map, so it must hold there too).
  // Start L is clamped past step 10 / step 11 so monotonic order survives a
  // seed whose own L sits between the fixed targets.
  const bgs = [steps[0]!.hex, steps[1]!.hex, steps[2]!.hex]
  const past = (l: number, prev: number): number =>
    round6(mode === 'light' ? Math.min(l, prev - 0.02) : Math.max(l, prev + 0.02))
  const base11: Oklch = {
    l: past(L_TARGETS[mode][10]!, hoverL),
    c: round6(seed.c * C_CURVE[10]!),
    h: seed.h,
  }
  const solved11 = solveTextLightness(base11, bgs, mode, 4.5, 75)
  const base12: Oklch = {
    l: past(L_TARGETS[mode][11]!, solved11.l),
    c: round6(seed.c * C_CURVE[11]!),
    h: seed.h,
  }
  steps[10] = toStep(solved11)
  steps[11] = toStep(solveTextLightness(base12, bgs, mode, 7, 90))

  // onSolid: white or dark tinted text on step 9, whichever contrasts better.
  const solid = steps[8]!.hex
  const darkCandidate = oklchToHex(
    clampToSrgb({ ...DARK_TEXT, c: Math.min(0.03, seed.c * 0.2), h: seed.h }),
  )
  const onSolid =
    wcagRatio('#ffffff', solid) >= wcagRatio(darkCandidate, solid) ? '#ffffff' : darkCandidate

  return { steps, onSolid }
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run packages/tokens/src/colour/ramp.test.ts`.
One plausible first-run failure and its meaning: *`solveTextLightness` throws on a dark warning ramp* — high-chroma yellows may not reach Lc 90 near L 0.985 because the chroma keeps the clamped hex too colourful. If that happens, lower `base12`'s chroma (e.g. `seed.c * 0.3` instead of `* 0.55`) — reducing chroma, never the contrast threshold — and record the adjustment in the commit message. Monotonicity across steps 9–12 is already protected by the `past()` clamps; if the monotonic test still fails, the seed's L is outside the sane anchor range and the fix is in `L_TARGETS`, not in the test.

- [ ] **Step 5: Commit** — `git commit -m "feat(tokens): 12-step role ramp generation with APCA/WCAG contrast solving"`

---

### Task 8: Non-colour scales and breakpoints

**Files:**
- Create: `packages/tokens/src/scales/scales.ts`
- Create: `packages/tokens/src/breakpoints.ts`
- Test: `packages/tokens/src/scales/scales.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (all plain `as const` data — the emitter consumes these in Task 11):
  - `SPACE: Record<string, string>` — `{ '0': '0px', '1': '2px', '2': '4px', '3': '8px', '4': '12px', '5': '16px', '6': '24px', '7': '32px', '8': '48px', '9': '64px' }`
  - `TEXT: Record<string, { size: string; lineHeight: string }>` — `xs 12/16, sm 14/20, md 16/24, lg 18/28, xl 20/28, '2xl' 24/32` (px)
  - `RADIUS: Record<string, string>` — `sm 4px, md 6px, lg 10px, xl 16px, full 9999px`
  - `Z: Record<string, number>` — `sticky 1100, backdrop 1300, dialog 1400, popover 1500, toast 1600, tooltip 1700` (ADR-0016 — copy exactly)
  - `ELEVATION: Record<Mode, Record<string, string>>` — 3 shadow levels per mode; dark levels are lower-opacity (ADR-0006: dark elevation comes from lighter surfaces, not shadows)
  - `MISC: Record<string, string>` — `'focus-ring-width': '2px'`, `'focus-ring-offset': '2px'`, `'hit-target': '24px'`, `'hit-target-coarse': '44px'`, `'font-numeric': "'tnum'"`
  - From `breakpoints.ts`: `breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const` and `media = { sm: '(min-width: 640px)', md: '(min-width: 768px)', lg: '(min-width: 1024px)', xl: '(min-width: 1280px)', coarse: '(pointer: coarse)' } as const` (ADR-0017)

- [ ] **Step 1: Write failing tests** (`scales.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { ELEVATION, MISC, RADIUS, SPACE, TEXT, Z } from './scales.js'
import { breakpoints, media } from '../breakpoints.js'

describe('scales', () => {
  it('z-order encodes toast above dialog and tooltip above everything (ADR-0016)', () => {
    expect(Z['toast']!).toBeGreaterThan(Z['dialog']!)
    expect(Z['tooltip']!).toBeGreaterThan(Z['toast']!)
    expect(Z['popover']!).toBeGreaterThan(Z['dialog']!)
  })
  it('space scale starts at 0 and is strictly increasing', () => {
    const px = Object.values(SPACE).map((v) => parseInt(v, 10))
    for (let i = 1; i < px.length; i++) expect(px[i]!).toBeGreaterThan(px[i - 1]!)
  })
  it('text sizes are px pairs', () => {
    expect(TEXT['md']).toEqual({ size: '16px', lineHeight: '24px' })
  })
  it('media strings match breakpoint values', () => {
    expect(media.sm).toBe(`(min-width: ${breakpoints.sm}px)`)
    expect(media.coarse).toBe('(pointer: coarse)')
  })
  it('hit targets follow ADR-0017', () => {
    expect(MISC['hit-target']).toBe('24px')
    expect(MISC['hit-target-coarse']).toBe('44px')
  })
  it('elevation has three levels per mode', () => {
    expect(Object.keys(ELEVATION.light)).toEqual(['1', '2', '3'])
    expect(Object.keys(ELEVATION.dark)).toEqual(['1', '2', '3'])
  })
  it('radius exposes sm/md/lg/xl/full', () => {
    expect(RADIUS['full']).toBe('9999px')
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement.** `breakpoints.ts`:

```ts
export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const

export const media = {
  sm: `(min-width: ${breakpoints.sm}px)`,
  md: `(min-width: ${breakpoints.md}px)`,
  lg: `(min-width: ${breakpoints.lg}px)`,
  xl: `(min-width: ${breakpoints.xl}px)`,
  coarse: '(pointer: coarse)',
} as const
```

`scales/scales.ts`:

```ts
import type { Mode } from '../colour/types.js'

export const SPACE: Record<string, string> = {
  '0': '0px', '1': '2px', '2': '4px', '3': '8px', '4': '12px',
  '5': '16px', '6': '24px', '7': '32px', '8': '48px', '9': '64px',
}

export const TEXT: Record<string, { size: string; lineHeight: string }> = {
  xs: { size: '12px', lineHeight: '16px' },
  sm: { size: '14px', lineHeight: '20px' },
  md: { size: '16px', lineHeight: '24px' },
  lg: { size: '18px', lineHeight: '28px' },
  xl: { size: '20px', lineHeight: '28px' },
  '2xl': { size: '24px', lineHeight: '32px' },
}

export const RADIUS: Record<string, string> = {
  sm: '4px', md: '6px', lg: '10px', xl: '16px', full: '9999px',
}

export const Z: Record<string, number> = {
  sticky: 1100, backdrop: 1300, dialog: 1400, popover: 1500, toast: 1600, tooltip: 1700,
}

export const ELEVATION: Record<Mode, Record<string, string>> = {
  light: {
    '1': '0 1px 2px rgb(0 0 0 / 0.06), 0 1px 3px rgb(0 0 0 / 0.10)',
    '2': '0 2px 6px rgb(0 0 0 / 0.08), 0 4px 12px rgb(0 0 0 / 0.10)',
    '3': '0 8px 16px rgb(0 0 0 / 0.10), 0 12px 32px rgb(0 0 0 / 0.14)',
  },
  dark: {
    '1': '0 1px 2px rgb(0 0 0 / 0.30)',
    '2': '0 2px 6px rgb(0 0 0 / 0.35)',
    '3': '0 8px 20px rgb(0 0 0 / 0.45)',
  },
}

export const MISC: Record<string, string> = {
  'focus-ring-width': '2px',
  'focus-ring-offset': '2px',
  'hit-target': '24px',
  'hit-target-coarse': '44px',
  'font-numeric': "'tnum'",
}
```

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat(tokens): space/type/radius/elevation/z scales and breakpoint constants"`

---

### Task 9: Typography — font metrics table and resolution

**Files:**
- Create: `scripts/gen-font-metrics.ts`
- Create: `packages/tokens/src/typography/metrics.generated.ts` (via the script, then committed)
- Create: `packages/tokens/src/typography/fonts.ts`
- Test: `packages/tokens/src/typography/fonts.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type KnownFamily = 'Inter' | 'Roboto' | 'Open Sans' | 'Poppins' | 'Manrope'`
  - `interface FallbackMetrics { sizeAdjust: string; ascentOverride: string; descentOverride: string; lineGapOverride: string }` (percent strings, e.g. `'107.4%'`)
  - `FONT_FALLBACKS: Record<KnownFamily, FallbackMetrics>` (generated file)
  - `interface ResolvedFont { family: string; stack: string; fallbackName: string | null; metrics: FallbackMetrics | null; weights: { regular: 400; medium: 500; semibold: 600 } }`
  - `resolveFont(input?: { family: string; metrics?: FallbackMetrics }): ResolvedFont` — no input → Inter; known family → bundled metrics; unknown family → `metrics: null` unless supplied (ADR-0015)

- [ ] **Step 1: Write the generator script** (`scripts/gen-font-metrics.ts`) — dev-only; capsize computes fallback metrics against Arial:

```ts
// Dev-only script: regenerates packages/tokens/src/typography/metrics.generated.ts
// Run: npm run gen:font-metrics   — commit the output. Never edited by hand.
import { writeFileSync } from 'node:fs'
import { createFontStack } from '@capsizecss/core'
import interMetrics from '@capsizecss/metrics/inter'
import robotoMetrics from '@capsizecss/metrics/roboto'
import openSansMetrics from '@capsizecss/metrics/openSans'
import poppinsMetrics from '@capsizecss/metrics/poppins'
import manropeMetrics from '@capsizecss/metrics/manrope'
import arialMetrics from '@capsizecss/metrics/arial'

const families = [
  ['Inter', interMetrics],
  ['Roboto', robotoMetrics],
  ['Open Sans', openSansMetrics],
  ['Poppins', poppinsMetrics],
  ['Manrope', manropeMetrics],
] as const

const entries = families.map(([name, metrics]) => {
  const { fontFaces } = createFontStack([metrics, arialMetrics])
  // fontFaces is a CSS string of @font-face blocks (shape has varied across
  // capsize versions — coerce whatever it is to text and regex the overrides).
  const css = typeof fontFaces === 'string' ? fontFaces : JSON.stringify(fontFaces)
  const pick = (prop: string, fallback?: string): string => {
    const m = new RegExp(`${prop}:\\s*([\\d.]+%)`).exec(css)
    if (!m) {
      if (fallback !== undefined) return fallback
      throw new Error(`No ${prop} for ${name} — inspect createFontStack output`)
    }
    return m[1]!
  }
  return `  '${name}': { sizeAdjust: '${pick('size-adjust')}', ascentOverride: '${pick('ascent-override')}', descentOverride: '${pick('descent-override')}', lineGapOverride: '${pick('line-gap-override', '0%')}' },`
})

writeFileSync(
  'packages/tokens/src/typography/metrics.generated.ts',
  `// GENERATED by scripts/gen-font-metrics.ts — do not edit. Regenerate with: npm run gen:font-metrics
import type { FallbackMetrics, KnownFamily } from './fonts.js'

export const FONT_FALLBACKS: Record<KnownFamily, FallbackMetrics> = {
${entries.join('\n')}
}
`,
)
console.log('metrics.generated.ts written')
```

Note for the implementer: `createFontStack`'s return shape has changed between capsize versions. If `fontFaces` is not an array of strings, inspect the actual return value (`console.log(JSON.stringify(result, null, 2))`) and adapt the extraction — the four override values are what matters, not the access path. If `line-gap-override` is absent (some versions omit it when 0), default it to `'0%'`.

- [ ] **Step 2: Write failing tests** (`fonts.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { FONT_FALLBACKS } from './metrics.generated.js'
import { resolveFont } from './fonts.js'

describe('metrics table', () => {
  it('covers the preferred five', () => {
    expect(Object.keys(FONT_FALLBACKS).sort()).toEqual(
      ['Inter', 'Manrope', 'Open Sans', 'Poppins', 'Roboto'].sort(),
    )
  })
  it('all values are percent strings', () => {
    for (const m of Object.values(FONT_FALLBACKS)) {
      expect(m.sizeAdjust).toMatch(/^[\d.]+%$/)
      expect(m.ascentOverride).toMatch(/^[\d.]+%$/)
    }
  })
})

describe('resolveFont', () => {
  it('defaults to Inter with bundled metrics', () => {
    const f = resolveFont()
    expect(f.family).toBe('Inter')
    expect(f.metrics).not.toBeNull()
    expect(f.stack).toBe("'Inter', 'Inter Fallback', system-ui, sans-serif")
  })
  it('known family gets bundled metrics', () => {
    expect(resolveFont({ family: 'Poppins' }).metrics).toEqual(FONT_FALLBACKS['Poppins'])
  })
  it('unknown family gets null metrics and no fallback face', () => {
    const f = resolveFont({ family: 'Comic Neue' })
    expect(f.metrics).toBeNull()
    expect(f.fallbackName).toBeNull()
    expect(f.stack).toBe("'Comic Neue', system-ui, sans-serif")
  })
  it('unknown family with supplied metrics keeps them', () => {
    const metrics = { sizeAdjust: '100%', ascentOverride: '90%', descentOverride: '22%', lineGapOverride: '0%' }
    expect(resolveFont({ family: 'Comic Neue', metrics }).metrics).toEqual(metrics)
  })
})
```

- [ ] **Step 3: Run script, then tests**

Run: `npm run gen:font-metrics` — inspect the generated file; values should be plausible (sizeAdjust between 90% and 120%). Then `npx vitest run packages/tokens/src/typography` → FAIL (fonts.ts missing).

- [ ] **Step 4: Implement** (`fonts.ts`):

```ts
import { FONT_FALLBACKS } from './metrics.generated.js'

export type KnownFamily = 'Inter' | 'Roboto' | 'Open Sans' | 'Poppins' | 'Manrope'

export interface FallbackMetrics {
  sizeAdjust: string
  ascentOverride: string
  descentOverride: string
  lineGapOverride: string
}

export interface ResolvedFont {
  family: string
  stack: string
  fallbackName: string | null
  metrics: FallbackMetrics | null
  weights: { regular: 400; medium: 500; semibold: 600 }
}

const WEIGHTS = { regular: 400, medium: 500, semibold: 600 } as const

const isKnown = (family: string): family is KnownFamily => family in FONT_FALLBACKS

export function resolveFont(input?: { family: string; metrics?: FallbackMetrics }): ResolvedFont {
  const family = input?.family ?? 'Inter'
  const metrics = input?.metrics ?? (isKnown(family) ? FONT_FALLBACKS[family] : null)
  const fallbackName = metrics ? `${family} Fallback` : null
  const stack = fallbackName
    ? `'${family}', '${fallbackName}', system-ui, sans-serif`
    : `'${family}', system-ui, sans-serif`
  return { family, stack, fallbackName, metrics, weights: WEIGHTS }
}
```

(Note the import cycle shape: `metrics.generated.ts` imports *types* from `fonts.ts`, `fonts.ts` imports *values* from `metrics.generated.ts` — type-only in one direction, safe under `isolatedModules`.)

- [ ] **Step 5: Run to verify pass, then commit**

```bash
git add scripts/gen-font-metrics.ts packages/tokens/src/typography
git commit -m "feat(tokens): font resolution with capsize-generated fallback metrics for the preferred five"
```

---

### Task 10: Theme assembly — `generateTheme` and the Tier 2 semantic map

**Files:**
- Create: `packages/tokens/src/theme/semanticMap.ts`
- Create: `packages/tokens/src/theme/generateTheme.ts`
- Modify: `packages/tokens/src/index.ts` (public exports)
- Test: `packages/tokens/src/theme/generateTheme.test.ts`

**Interfaces:**
- Consumes: `hexToOklch`, `clampToSrgb`, `deriveSeeds`, `generateRamp`, `Ramp`, `resolveFont`, `ResolvedFont`, scales/breakpoints from Tasks 2–9.
- Produces:
  - `type RampName = 'brand' | 'neutral' | 'danger' | 'warning' | 'success' | 'info'`
  - `interface ThemeSeed { brand: string; font?: { family: string; metrics?: FallbackMetrics } }`
  - `interface Theme { seed: { brand: string }; font: ResolvedFont; ramps: Record<Mode, Record<RampName, Ramp>>; semantic: SemanticEntry[]; scales: { space; text; radius; elevation; z; misc }; breakpoints: typeof breakpoints }`
  - `interface SemanticEntry { token: string; ramp: RampName; step: number | 'onSolid' }` — e.g. `{ token: 'color-text-primary', ramp: 'neutral', step: 12 }`. Tier 2 stays a *reference* (ADR-0007); hex resolution is a lookup, not a copy.
  - `SEMANTIC_MAP: SemanticEntry[]` (same for both modes — the ramp values differ per mode, the roles do not)
  - `generateTheme(seed: ThemeSeed): Theme`
  - `resolveSemantic(theme: Theme, mode: Mode, token: string): string` — token name → hex, used by gates and report

- [ ] **Step 1: Write the semantic map** (`semanticMap.ts`) — this is ADR-0007's Tier 2 contract, verbatim:

```ts
import type { RampName } from './generateTheme.js'

export interface SemanticEntry {
  token: string
  ramp: RampName
  step: number | 'onSolid'
}

const s = (token: string, ramp: RampName, step: number | 'onSolid'): SemanticEntry => ({
  token, ramp, step,
})

export const SEMANTIC_MAP: SemanticEntry[] = [
  s('color-bg-canvas', 'neutral', 1),
  s('color-bg-surface', 'neutral', 2),
  s('color-bg-raised', 'neutral', 3),
  s('color-border-subtle', 'neutral', 6),
  s('color-border-normal', 'neutral', 7),
  s('color-border-interactive', 'neutral', 8),
  s('color-text-primary', 'neutral', 12),
  s('color-text-secondary', 'neutral', 11),
  s('color-action-bg', 'brand', 9),
  s('color-action-bg-hover', 'brand', 10),
  s('color-action-text', 'brand', 'onSolid'),
  s('color-focus-ring', 'brand', 8),
  ...(['danger', 'warning', 'success', 'info'] as const).flatMap((name) => [
    s(`color-${name}-bg`, name, 9),
    s(`color-${name}-bg-subtle`, name, 3),
    s(`color-${name}-border`, name, 7),
    s(`color-${name}-text`, name, 11),
    s(`color-${name}-on-solid`, name, 'onSolid'),
  ]),
]
```

- [ ] **Step 2: Write failing tests** (`generateTheme.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { generateTheme, resolveSemantic } from './generateTheme.js'

const theme = generateTheme({ brand: '#2e5fd9' })

describe('generateTheme', () => {
  it('produces six ramps in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      expect(Object.keys(theme.ramps[mode]).sort()).toEqual(
        ['brand', 'danger', 'info', 'neutral', 'success', 'warning'].sort(),
      )
    }
  })
  it('brand step 9 is the seed in light mode', () => {
    expect(theme.ramps.light.brand.steps[8]!.hex).toBe('#2e5fd9')
  })
  it('defaults to Inter', () => {
    expect(theme.font.family).toBe('Inter')
  })
  it('resolveSemantic maps token → hex through the ramp reference', () => {
    expect(resolveSemantic(theme, 'light', 'color-bg-canvas')).toBe(
      theme.ramps.light.neutral.steps[0]!.hex,
    )
    expect(resolveSemantic(theme, 'light', 'color-action-text')).toBe(
      theme.ramps.light.brand.onSolid,
    )
  })
  it('throws on an unknown semantic token', () => {
    expect(() => resolveSemantic(theme, 'light', 'color-nope')).toThrow()
  })
  it('rejects an invalid brand hex', () => {
    expect(() => generateTheme({ brand: 'blue' })).toThrow()
  })
})
```

- [ ] **Step 3: Run to verify failure.**

- [ ] **Step 4: Implement** (`generateTheme.ts`):

```ts
import type { Mode } from '../colour/types.js'
import { hexToOklch } from '../colour/oklch.js'
import { deriveSeeds } from '../colour/semantics.js'
import { generateRamp, type Ramp } from '../colour/ramp.js'
import { resolveFont, type FallbackMetrics, type ResolvedFont } from '../typography/fonts.js'
import { ELEVATION, MISC, RADIUS, SPACE, TEXT, Z } from '../scales/scales.js'
import { breakpoints } from '../breakpoints.js'
import { SEMANTIC_MAP, type SemanticEntry } from './semanticMap.js'

export type RampName = 'brand' | 'neutral' | 'danger' | 'warning' | 'success' | 'info'

export interface ThemeSeed {
  brand: string
  font?: { family: string; metrics?: FallbackMetrics }
}

export interface Theme {
  seed: { brand: string }
  font: ResolvedFont
  ramps: Record<Mode, Record<RampName, Ramp>>
  semantic: SemanticEntry[]
  scales: {
    space: typeof SPACE
    text: typeof TEXT
    radius: typeof RADIUS
    elevation: typeof ELEVATION
    z: typeof Z
    misc: typeof MISC
  }
  breakpoints: typeof breakpoints
}

export function generateTheme(seed: ThemeSeed): Theme {
  const brand = hexToOklch(seed.brand)
  const seeds = { brand, ...deriveSeeds(brand) }

  const modeRamps = (mode: Mode): Record<RampName, Ramp> => ({
    brand: generateRamp(seeds.brand, mode),
    neutral: generateRamp(seeds.neutral, mode),
    danger: generateRamp(seeds.danger, mode),
    warning: generateRamp(seeds.warning, mode),
    success: generateRamp(seeds.success, mode),
    info: generateRamp(seeds.info, mode),
  })

  return {
    seed: { brand: seed.brand.toLowerCase() },
    font: resolveFont(seed.font),
    ramps: { light: modeRamps('light'), dark: modeRamps('dark') },
    semantic: SEMANTIC_MAP,
    scales: { space: SPACE, text: TEXT, radius: RADIUS, elevation: ELEVATION, z: Z, misc: MISC },
    breakpoints,
  }
}

export function resolveSemantic(theme: Theme, mode: Mode, token: string): string {
  const entry = theme.semantic.find((e) => e.token === token)
  if (!entry) throw new Error(`Unknown semantic token: ${token}`)
  const ramp = theme.ramps[mode][entry.ramp]
  return entry.step === 'onSolid' ? ramp.onSolid : ramp.steps[entry.step - 1]!.hex
}
```

Update `packages/tokens/src/index.ts` to the real public surface:

```ts
export { generateTheme, resolveSemantic } from './theme/generateTheme.js'
export type { Theme, ThemeSeed, RampName } from './theme/generateTheme.js'
export { SEMANTIC_MAP } from './theme/semanticMap.js'
export type { SemanticEntry } from './theme/semanticMap.js'
export type { Oklch, Mode } from './colour/types.js'
export { hexToOklch, oklchToHex } from './colour/oklch.js'
export { wcagRatio } from './colour/wcag.js'
export { apcaLc } from './colour/apca.js'
export { breakpoints, media } from './breakpoints.js'
export { resolveFont } from './typography/fonts.js'
export type { ResolvedFont, FallbackMetrics, KnownFamily } from './typography/fonts.js'
```

Also update `index.test.ts`: replace the `VERSION` assertion with an import-surface test (`expect(typeof generateTheme).toBe('function')`) and delete the `VERSION` export.

- [ ] **Step 5: Run to verify pass** — full suite: `npm test`. Everything green.

- [ ] **Step 6: Commit** — `git commit -m "feat(tokens): generateTheme assembly and Tier 2 semantic map"`

---

### Task 11: CSS emitter

**Files:**
- Create: `packages/tokens/src/emit/cssText.ts`
- Modify: `packages/tokens/src/index.ts` (add `toCssText`, `toFallbackFontFaceCss`)
- Test: `packages/tokens/src/emit/cssText.test.ts`

**Interfaces:**
- Consumes: `Theme` from Task 10 (`resolveSemantic` is not needed here — Tier 2 emits `var()` references, not resolved hex); scales/misc/breakpoints come off the theme object.
- Produces:
  - `toCssText(theme: Theme): string` — the full stylesheet, structured exactly:
    1. `@layer ap.tokens, ap.components;` (ADR-0016 — declares order; `ap.components` is filled by Phase 4)
    2. `@layer ap.tokens { :root { …light Tier 1 + Tier 2 + scales + font… } }`
    3. dark block emitted twice: `[data-ap-scheme="dark"]` and `@media (prefers-color-scheme: dark) { :root:not([data-ap-scheme="light"]) }` (ADR-0009 three-state scheme)
    4. `@media (color-gamut: p3)` overrides for steps that carry `p3` (both modes)
    5. `@media (pointer: coarse) { :root { --ap-hit-target: 44px } }` (ADR-0017)
  - Token naming: Tier 1 `--ap-{ramp}-{step}` + `--ap-{ramp}-contrast` (onSolid); Tier 2 `--ap-{token}: var(--ap-{ramp}-{step})`; scales `--ap-space-{k}`, `--ap-text-{k}-size`/`-lh`, `--ap-radius-{k}`, `--ap-shadow-{k}`, `--ap-z-{k}`, `--ap-font-body`/`-heading`/`-mono`, `--ap-font-weight-{k}`, misc as `--ap-{key}`
  - `toFallbackFontFaceCss(theme: Theme): string` — the `@font-face` for `'{family} Fallback'` with `src: local('Arial')` and the metric overrides; empty string when `metrics` is null (ADR-0015)
  - Deterministic: tokens emitted in a fixed order (ramps in `RampName` alphabetical order, steps ascending, then semantic in map order, then scales in declaration order)

- [ ] **Step 1: Write failing tests** (`cssText.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { generateTheme } from '../theme/generateTheme.js'
import { toCssText, toFallbackFontFaceCss } from './cssText.js'

const theme = generateTheme({ brand: '#2e5fd9' })
const css = toCssText(theme)

describe('toCssText', () => {
  it('declares layer order first', () => {
    expect(css.startsWith('@layer ap.tokens, ap.components;')).toBe(true)
  })
  it('wraps everything else in @layer ap.tokens', () => {
    expect(css).toContain('@layer ap.tokens {')
  })
  it('emits Tier 1 primitives and Tier 2 references', () => {
    expect(css).toContain(`--ap-brand-9: ${theme.ramps.light.brand.steps[8]!.hex};`)
    expect(css).toContain('--ap-color-action-bg: var(--ap-brand-9);')
    expect(css).toContain('--ap-color-text-primary: var(--ap-neutral-12);')
  })
  it('emits the dark block both ways (attribute and media)', () => {
    expect(css).toContain('[data-ap-scheme="dark"]')
    expect(css).toContain('@media (prefers-color-scheme: dark)')
    expect(css).toContain(':root:not([data-ap-scheme="light"])')
  })
  it('dark attribute and media blocks are identical in content', () => {
    // the two blocks sit at different indent depths — compare trimmed lines
    const norm = (s: string): string => s.split('\n').map((l) => l.trim()).filter(Boolean).join('\n')
    const attr = /\[data-ap-scheme="dark"\] \{([^}]+)\}/.exec(css)![1]!
    const media = /:root:not\(\[data-ap-scheme="light"\]\) \{([^}]+)\}/.exec(css)![1]!
    expect(norm(attr)).toBe(norm(media))
  })
  it('P3 values appear only under the gamut media query (if any exist for this seed)', () => {
    const first = css.indexOf('display-p3')
    // the default seed may legitimately produce zero out-of-sRGB ideals;
    // the vivid-seed case in gamut.test.ts guarantees the mechanism itself.
    if (first !== -1) {
      expect(first).toBeGreaterThan(css.indexOf('@media (color-gamut: p3)'))
    }
  })
  it('bumps hit target under pointer: coarse', () => {
    expect(css).toContain('@media (pointer: coarse)')
    expect(css).toContain('--ap-hit-target: 44px;')
  })
  it('emits z-scale and font tokens', () => {
    expect(css).toContain('--ap-z-toast: 1600;')
    expect(css).toContain("--ap-font-body: 'Inter', 'Inter Fallback', system-ui, sans-serif;")
  })
  it('is deterministic', () => {
    expect(toCssText(generateTheme({ brand: '#2e5fd9' }))).toBe(css)
  })
  it('matches the committed snapshot', () => {
    expect(css).toMatchSnapshot()
  })
})

describe('toFallbackFontFaceCss', () => {
  it('emits a metric-matched @font-face for Inter', () => {
    const face = toFallbackFontFaceCss(theme)
    expect(face).toContain("font-family: 'Inter Fallback';")
    expect(face).toContain("src: local('Arial');")
    expect(face).toMatch(/size-adjust: [\d.]+%;/)
  })
  it('is empty for a metrics-less custom font', () => {
    expect(toFallbackFontFaceCss(generateTheme({ brand: '#2e5fd9', font: { family: 'X' } }))).toBe('')
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** (`cssText.ts`):

```ts
import type { Mode } from '../colour/types.js'
import type { RampName, Theme } from '../theme/generateTheme.js'

const RAMP_ORDER: RampName[] = ['brand', 'danger', 'info', 'neutral', 'success', 'warning']

function tier1Lines(theme: Theme, mode: Mode): string[] {
  const lines: string[] = []
  for (const name of RAMP_ORDER) {
    const ramp = theme.ramps[mode][name]
    ramp.steps.forEach((step, i) => lines.push(`--ap-${name}-${i + 1}: ${step.hex};`))
    lines.push(`--ap-${name}-contrast: ${ramp.onSolid};`)
  }
  return lines
}

function tier2Lines(theme: Theme): string[] {
  return theme.semantic.map((e) =>
    e.step === 'onSolid'
      ? `--ap-${e.token}: var(--ap-${e.ramp}-contrast);`
      : `--ap-${e.token}: var(--ap-${e.ramp}-${e.step});`,
  )
}

function scaleLines(theme: Theme, mode: Mode): string[] {
  const { space, text, radius, elevation, z, misc } = theme.scales
  const lines: string[] = []
  for (const [k, v] of Object.entries(space)) lines.push(`--ap-space-${k}: ${v};`)
  for (const [k, v] of Object.entries(text)) {
    lines.push(`--ap-text-${k}-size: ${v.size};`, `--ap-text-${k}-lh: ${v.lineHeight};`)
  }
  for (const [k, v] of Object.entries(radius)) lines.push(`--ap-radius-${k}: ${v};`)
  for (const [k, v] of Object.entries(elevation[mode])) lines.push(`--ap-shadow-${k}: ${v};`)
  for (const [k, v] of Object.entries(z)) lines.push(`--ap-z-${k}: ${v};`)
  lines.push(
    `--ap-font-body: ${theme.font.stack};`,
    `--ap-font-heading: var(--ap-font-body);`,
    `--ap-font-mono: ui-monospace, 'Cascadia Code', Menlo, monospace;`,
    `--ap-font-weight-regular: ${theme.font.weights.regular};`,
    `--ap-font-weight-medium: ${theme.font.weights.medium};`,
    `--ap-font-weight-semibold: ${theme.font.weights.semibold};`,
  )
  for (const [k, v] of Object.entries(misc)) {
    if (k === 'hit-target-coarse') continue // emitted under the coarse media query
    lines.push(`--ap-${k}: ${v};`)
  }
  return lines
}

/** Tokens that differ between modes: Tier 1 ramps + shadows. */
const darkLines = (theme: Theme): string[] => [
  ...tier1Lines(theme, 'dark'),
  ...Object.entries(theme.scales.elevation.dark).map(([k, v]) => `--ap-shadow-${k}: ${v};`),
]

function p3Lines(theme: Theme, mode: Mode): string[] {
  const lines: string[] = []
  for (const name of RAMP_ORDER) {
    theme.ramps[mode][name].steps.forEach((step, i) => {
      if (step.p3) lines.push(`--ap-${name}-${i + 1}: ${step.p3};`)
    })
  }
  return lines
}

const block = (selector: string, lines: string[], indent: string): string =>
  lines.length === 0 ? '' : `${indent}${selector} {\n${lines.map((l) => `${indent}  ${l}`).join('\n')}\n${indent}}`

export function toCssText(theme: Theme): string {
  const light = [...tier1Lines(theme, 'light'), ...tier2Lines(theme), ...scaleLines(theme, 'light')]
  const dark = darkLines(theme)

  const parts = [
    '@layer ap.tokens, ap.components;',
    '',
    '@layer ap.tokens {',
    block(':root', light, '  '),
    '',
    block('[data-ap-scheme="dark"]', dark, '  '),
    '',
    '  @media (prefers-color-scheme: dark) {',
    block(':root:not([data-ap-scheme="light"])', dark, '    '),
    '  }',
    '',
    '  @media (color-gamut: p3) {',
    block(':root', p3Lines(theme, 'light'), '    '),
    block('[data-ap-scheme="dark"]', p3Lines(theme, 'dark'), '    '),
    '  }',
    '',
    '  @media (pointer: coarse) {',
    block(':root', [`--ap-hit-target: ${theme.scales.misc['hit-target-coarse']};`], '    '),
    '  }',
    '}',
    '',
  ]
  return parts.filter((p) => p !== null).join('\n').replace(/\n{3,}/g, '\n\n')
}

export function toFallbackFontFaceCss(theme: Theme): string {
  const { fallbackName, metrics } = theme.font
  if (!fallbackName || !metrics) return ''
  return [
    '@font-face {',
    `  font-family: '${fallbackName}';`,
    "  src: local('Arial');",
    `  size-adjust: ${metrics.sizeAdjust};`,
    `  ascent-override: ${metrics.ascentOverride};`,
    `  descent-override: ${metrics.descentOverride};`,
    `  line-gap-override: ${metrics.lineGapOverride};`,
    '}',
    '',
  ].join('\n')
}
```

Add to `index.ts`: `export { toCssText, toFallbackFontFaceCss } from './emit/cssText.js'`

- [ ] **Step 4: Run to verify pass** — first run writes the snapshot; eyeball the generated `.snap` file before committing: layer declaration first, `:root` block present, dark blocks identical, P3 section present only if the default seed produced out-of-sRGB ideals (it may legitimately be empty for `#2e5fd9` — the vivid-seed case is covered in Task 3's tests).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(tokens): CSS emitter with cascade layers, dual dark blocks, P3 and coarse-pointer sections"`

---

### Task 12: Gates 1–3, contrast report, and the React-free guard

**Files:**
- Create: `packages/tokens/src/emit/contrastReport.ts`
- Create: `packages/tokens/src/gates/determinism.gate.test.ts`
- Create: `packages/tokens/src/gates/contrast.gate.test.ts`
- Create: `packages/tokens/src/gates/gamut.gate.test.ts`
- Create: `packages/tokens/src/gates/react-free.gate.test.ts`
- Create: `scripts/contrast-report.ts`
- Modify: `packages/tokens/src/index.ts` (export report functions)

**Interfaces:**
- Consumes: `generateTheme`, `resolveSemantic`, `wcagRatio`, `apcaLc`, `hexToOklch`, `inSrgb`.
- Produces:
  - `interface ContrastPairing { mode: Mode; fg: string; bg: string; fgHex: string; bgHex: string; ratio: number; required: number; apca: number; pass: boolean }`
  - `contrastPairings(theme: Theme): ContrastPairing[]`
  - `renderContrastReport(pairings: ContrastPairing[]): string` (markdown)
  - The default seed constant: `DEFAULT_BRAND = '#2e5fd9'` exported from `index.ts` (placeholder brand until the seed decision — it participates in gates so the gates are real from day one)

- [ ] **Step 1: Implement the pairing list** (`contrastReport.ts`) — this is ADR-0008's gate, encoded. Text pairings need 4.5, non-text 3.0:

```ts
import type { Mode } from '../colour/types.js'
import type { Theme } from '../theme/generateTheme.js'
import { resolveSemantic } from '../theme/generateTheme.js'
import { wcagRatio } from '../colour/wcag.js'
import { apcaLc } from '../colour/apca.js'

export interface ContrastPairing {
  mode: Mode
  fg: string
  bg: string
  fgHex: string
  bgHex: string
  ratio: number
  required: number
  apca: number
  pass: boolean
}

// [foreground token, background token, required WCAG ratio]
const PAIRINGS: Array<[string, string, number]> = [
  ['color-text-primary', 'color-bg-canvas', 4.5],
  ['color-text-primary', 'color-bg-surface', 4.5],
  ['color-text-primary', 'color-bg-raised', 4.5],
  ['color-text-secondary', 'color-bg-canvas', 4.5],
  ['color-text-secondary', 'color-bg-surface', 4.5],
  ['color-action-text', 'color-action-bg', 4.5],
  ['color-border-interactive', 'color-bg-canvas', 3],
  ['color-border-interactive', 'color-bg-surface', 3],
  ['color-focus-ring', 'color-bg-canvas', 3],
  ['color-focus-ring', 'color-bg-surface', 3],
  ...(['danger', 'warning', 'success', 'info'] as const).flatMap(
    (name): Array<[string, string, number]> => [
      [`color-${name}-on-solid`, `color-${name}-bg`, 4.5],
      [`color-${name}-text`, 'color-bg-canvas', 4.5],
      [`color-${name}-text`, `color-${name}-bg-subtle`, 4.5],
      [`color-${name}-border`, 'color-bg-canvas', 3],
    ],
  ),
]

export function contrastPairings(theme: Theme): ContrastPairing[] {
  return (['light', 'dark'] as Mode[]).flatMap((mode) =>
    PAIRINGS.map(([fg, bg, required]) => {
      const fgHex = resolveSemantic(theme, mode, fg)
      const bgHex = resolveSemantic(theme, mode, bg)
      const ratio = wcagRatio(fgHex, bgHex)
      return { mode, fg, bg, fgHex, bgHex, ratio, required, apca: apcaLc(fgHex, bgHex), pass: ratio >= required }
    }),
  )
}

export function renderContrastReport(pairings: ContrastPairing[]): string {
  const rows = pairings.map(
    (p) =>
      `| ${p.mode} | \`${p.fg}\` | \`${p.bg}\` | ${p.fgHex} on ${p.bgHex} | ${p.ratio.toFixed(2)} | ${p.required} | ${p.apca.toFixed(1)} | ${p.pass ? 'PASS' : '**FAIL**'} |`,
  )
  const failures = pairings.filter((p) => !p.pass).length
  return [
    '# Contrast report (WCAG 2.1 AA gate — ADR-0008)',
    '',
    `Pairings: ${pairings.length} · Failures: ${failures}`,
    '',
    '| Mode | Foreground | Background | Colours | Ratio | Required | APCA Lc | Result |',
    '|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n')
}
```

- [ ] **Step 2: Write the gate tests.**

`determinism.gate.test.ts` (gate 1):

```ts
import { describe, expect, it } from 'vitest'
import { generateTheme, toCssText, DEFAULT_BRAND } from '../index.js'

describe('gate 1: determinism', () => {
  it('two runs produce deeply equal themes', () => {
    expect(generateTheme({ brand: DEFAULT_BRAND })).toEqual(generateTheme({ brand: DEFAULT_BRAND }))
  })
  it('css output is byte-identical across runs', () => {
    expect(toCssText(generateTheme({ brand: DEFAULT_BRAND }))).toBe(
      toCssText(generateTheme({ brand: DEFAULT_BRAND })),
    )
  })
  it('the full theme matches the committed snapshot', () => {
    expect(generateTheme({ brand: DEFAULT_BRAND })).toMatchSnapshot()
  })
})
```

`contrast.gate.test.ts` (gate 2) — one test per pairing so failures name the exact pairing:

```ts
import { describe, expect, it } from 'vitest'
import { generateTheme, DEFAULT_BRAND } from '../index.js'
import { contrastPairings } from '../emit/contrastReport.js'

describe('gate 2: WCAG 2.1 AA on every Tier 2 pairing, both modes', () => {
  const pairings = contrastPairings(generateTheme({ brand: DEFAULT_BRAND }))
  for (const p of pairings) {
    it(`[${p.mode}] ${p.fg} on ${p.bg} ≥ ${p.required}:1`, () => {
      expect(p.ratio, `${p.fgHex} on ${p.bgHex} = ${p.ratio}`).toBeGreaterThanOrEqual(p.required)
    })
  }
})
```

`gamut.gate.test.ts` (gate 3):

```ts
import { describe, expect, it } from 'vitest'
import { generateTheme, hexToOklch, DEFAULT_BRAND } from '../index.js'
import { inSrgb } from '../colour/gamut.js'

describe('gate 3: every emitted sRGB value is in gamut, every P3 string is valid', () => {
  const theme = generateTheme({ brand: DEFAULT_BRAND })
  for (const mode of ['light', 'dark'] as const) {
    it(`${mode}: all ramp hexes are in sRGB and all p3 values are well-formed`, () => {
      for (const ramp of Object.values(theme.ramps[mode])) {
        for (const step of ramp.steps) {
          expect(inSrgb(hexToOklch(step.hex))).toBe(true)
          if (step.p3) {
            expect(step.p3).toMatch(/^color\(display-p3 [01](\.\d{1,4})? [01](\.\d{1,4})? [01](\.\d{1,4})?\)$/)
          }
        }
        expect(inSrgb(hexToOklch(ramp.onSolid))).toBe(true)
      }
    })
  }
})
```

`react-free.gate.test.ts` (ADR-0001 boundary):

```ts
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')

function allSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return allSourceFiles(p)
    return e.name.endsWith('.ts') && !e.name.includes('.test.') && !e.name.includes('.gate.') ? [p] : []
  })
}

describe('ADR-0001: @ap/tokens is React-free and dependency-free', () => {
  it('package.json declares no dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(SRC, '../package.json'), 'utf8'))
    expect(pkg.dependencies).toBeUndefined()
    expect(pkg.peerDependencies).toBeUndefined()
  })
  it('no source file imports react, DOM, or node builtins', () => {
    for (const file of allSourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8')
      expect(text, file).not.toMatch(/from ['"]react['"]/)
      expect(text, file).not.toMatch(/from ['"]node:/)
      expect(text, file).not.toMatch(/\b(document|window)\./)
    }
  })
})
```

(The gate test itself uses `node:fs` — that is why the file-walker skips `.gate.` and `.test.` files.)

- [ ] **Step 3: Add `DEFAULT_BRAND` and report exports to `index.ts`**

```ts
/** Placeholder default brand until the seed decision (design doc §9.1). */
export const DEFAULT_BRAND = '#2e5fd9'
export { contrastPairings, renderContrastReport } from './emit/contrastReport.js'
export type { ContrastPairing } from './emit/contrastReport.js'
```

- [ ] **Step 4: Write the report script** (`scripts/contrast-report.ts`):

```ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { contrastPairings, generateTheme, renderContrastReport, DEFAULT_BRAND } from '@ap/tokens'

const pairings = contrastPairings(generateTheme({ brand: DEFAULT_BRAND }))
mkdirSync('reports', { recursive: true })
writeFileSync('reports/contrast.md', renderContrastReport(pairings))
const failures = pairings.filter((p) => !p.pass)
console.log(`reports/contrast.md written — ${pairings.length} pairings, ${failures.length} failures`)
if (failures.length > 0) process.exit(1)
```

- [ ] **Step 5: Run everything**

```bash
npm test              # full suite green, including all three gates
npm run test:tokens   # gate 1 alone
npm run test:contrast # gate 2 alone
npm run test:gamut    # gate 3 alone
npm run report:contrast && cat reports/contrast.md
npm run typecheck
```

Expected: all green; `reports/contrast.md` shows every pairing PASS in both modes. **If any semantic pairing fails**, the fix is in generation, not in the gate. Step 11 is already solved against its own steps 1–3, so the plausible residual failure is a *cross-ramp* pairing — `color-{name}-text` on the **neutral** canvas (solved against its own near-white, checked against a slightly different near-white). If one fails by a hair, add the failing background to the solve set for that ramp in `generateRamp` (pass neutral steps 1–2 in as extra backgrounds via a parameter). Never weaken a pairing's threshold.

- [ ] **Step 6: Commit, and this is the Phase-1-complete commit**

```bash
git add -A
git commit -m "feat(tokens): gates 1-3 (determinism, contrast, gamut), contrast report, react-free guard"
```

---

## Verification (Phase 1 exit criteria, from the design doc §5)

Run in order; all must hold:

1. `npm test` — entire suite green.
2. `npm run test:tokens && npm run test:contrast && npm run test:gamut` — the three named gates pass independently.
3. `npm run report:contrast` — exits 0; `reports/contrast.md` lists every Tier 2 pairing with PASS in **both** modes. This file is the ADR-0008 compliance artifact.
4. `npm run typecheck` — clean under strict.
5. Manual eyeball: `npx tsx -e "import {generateTheme,toCssText,DEFAULT_BRAND} from '@ap/tokens'; console.log(toCssText(generateTheme({brand: DEFAULT_BRAND})))" > /tmp/theme.css` — open it, sanity-check structure and a handful of colours (paste step 9 / step 1 / step 12 hexes into any colour picker: brand-blue solid, near-white canvas, near-black text).
6. Determinism across machines is asserted by the committed snapshot: CI (Phase 2) re-runs gate 1 on Linux against the snapshot committed from Windows.

## Out of scope for this plan (deliberately)

- `@ap/vite`, fixtures, CI workflow — Phase 2.
- Tier 3 component tokens — arrive with components (Phase 4, ADR-0007).
- The final default brand seed — `DEFAULT_BRAND` is a placeholder constant; the seed decision (design doc §9.1) swaps one string and re-snapshots.
- Runtime theme *application* (`ThemeProvider`, `ThemeScript`) — `@ap/react`, Phase 4.
- Inter woff2 files and `fonts.css` assembly — `@ap/react` (ADR-0015); this plan produces `toFallbackFontFaceCss` which that file will consume.
