# Phase 2 — Build Plumbing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the whole delivery path end to end — tokens compile into a stylesheet, a styled component reads them through a typed contract, and an outside repository consuming us by `file:` protocol builds successfully in both SSR and SPA modes.

**Architecture:** `@ap/tokens` (Phase 1) gains three consumers. A generated typed contract (`contract.css.ts`) maps every Tier 2/3 token to its `--ap-*` custom property so components get autocomplete and can never reference a Tier 1 primitive. A generated `theme.css` carries the actual values. `@ap/vite` wraps the one line of build config consumers need. Two fixture applications — an RR8 framework-mode app and a plain Vite consumer — are the executable proof of ADR-0005 and ADR-0002 respectively.

**Tech Stack:** TypeScript (strict, NodeNext, ESM-only), vanilla-extract (`css` 1.21.2 / `recipes` 0.5.7 / `vite-plugin` 5.2.6), React 19.2.8, React Router 8.3.1 framework mode, Vite 8.2.2, Vitest 3, Testing Library, Playwright (chromium), `@fontsource-variable/inter` 5.3.0.

**Spec:** `docs/superpowers/specs/2026-08-29-component-library-design.md` (§5 Phase 2) and ADRs 0001, 0002, 0003, 0005, 0007, 0009, 0014, 0015, 0016, 0017 in `docs/adr/`.

## Global Constraints

- **Node ≥ 22.22.0**, **React ≥ 19.2.7**, **Vite ^8.2.2**, **react-router ^8.3.1** — the React Router 8 floor (ADR-0005). CI pins Node 22.22.x exactly.
- **ESM-only** everywhere. `"type": "module"` in every package.
- Every component module begins with the `'use client'` directive (ADR-0005), enforced by a gate.
- **No `react-router` dependency in `@ap/react`** (ADR-0001/0011), enforced by a gate.
- **No browser globals** (`window`, `document`, `matchMedia`, `localStorage`) at module scope or during render; no raw `useLayoutEffect`; no `Date.now()`/`Math.random()` during render (ADR-0005), enforced by a gate.
- **Tier 1 primitives are unreachable from component code** (ADR-0007). The generated contract exposes Tier 2 and Tier 3 only; this is structural, not advisory.
- All custom properties use the **`--ap-` prefix**, non-configurable (ADR-0007).
- **Logical properties only** in component styles — `marginInlineStart`, `paddingBlock`, `insetInlineEnd`, `borderInlineStartWidth`. Never `marginLeft`, `paddingRight`, `left`, `right`. This makes RTL support nearly free later and costs nothing now; enforced by a gate. *(Controller decision, recorded as the design doc's open question §9.2 — reversible by deleting one gate assertion.)*
- **Z-index only via `vars.z.*`**; never a literal number (ADR-0016), enforced by a gate.
- **Focus styling only via `:focus-visible`**; `outline: 'none'` is forbidden unless the same rule block sets a replacement (ADR-0016), enforced by a gate.
- Generated files (`contract.css.ts`, `theme.css`, `fonts.css`, vendored `.woff2`) are **committed as source** and re-verified for freshness in CI — the same precedent as Phase 1's `metrics.generated.ts`. No `dist/` is ever committed (ADR-0002).
- `DEFAULT_BRAND` (`#2e5fd9`) remains the placeholder seed. The real seed decision is still open and swaps one constant plus snapshots.

### Deviation from ADR-0007 / ADR-0016 wording, recorded deliberately

Both ADRs say Tier-1 reference, literal z-index, and `outline: none` are "enforced by a stylelint rule." **Stylelint cannot parse `.css.ts` files** — vanilla-extract styles are TypeScript objects, not CSS. These rules are therefore implemented as source-scanning gate tests in `packages/react/src/gates/`, following Phase 1's `react-free.gate.test.ts` precedent. Same enforcement, correct tool. No stylelint is installed.

## File Structure

```
apComponents/
├── vitest.config.ts                      NEW — root config, vanilla-extract plugin
├── packages/
│   ├── tokens/                           (Phase 1, unchanged)
│   ├── react/                            NEW
│   │   ├── package.json                  deps: @ap/tokens (file:), @vanilla-extract/*
│   │   ├── tsconfig.json
│   │   ├── fonts/                        vendored Inter woff2 (committed)
│   │   └── src/
│   │       ├── index.ts                  public surface
│   │       ├── theme/
│   │       │   ├── contract.css.ts       GENERATED — typed Tier 2/3 contract
│   │       │   ├── tier3.ts              tier3() helper
│   │       │   ├── theme.css             GENERATED — token values
│   │       │   └── fonts.css             GENERATED — @font-face
│   │       ├── components/Surface/
│   │       │   ├── Surface.tsx           'use client'
│   │       │   ├── Surface.css.ts        recipe
│   │       │   ├── Surface.tokens.ts     Tier 3 declarations
│   │       │   ├── Surface.test.tsx
│   │       │   └── index.ts
│   │       └── gates/
│   │           ├── contract-drift.gate.test.ts
│   │           ├── theme-freshness.gate.test.ts
│   │           ├── use-client.gate.test.ts
│   │           ├── ssr-safety.gate.test.ts
│   │           └── style-rules.gate.test.ts
│   └── vite/                             NEW
│       ├── package.json
│       └── src/index.ts                  apComponents()
├── fixtures/                             NOT in npm workspaces — installed separately
│   ├── ssr-app/                          RR8 framework mode (gates 6 & 7)
│   └── consumer/                         plain Vite + file: protocol (gate 8)
├── scripts/
│   ├── gen-theme-contract.ts             NEW
│   ├── gen-theme-css.ts                  NEW
│   └── gen-fonts.ts                      NEW
└── .github/workflows/ci.yml              NEW
```

`fixtures/*` are deliberately **excluded** from the root `workspaces` array. If npm linked them automatically, gate 8 would prove nothing — the point is that an outside repository resolves us through `file:` and its own `npm install`.

---

### Task 1: `@ap/react` skeleton and the generated typed token contract

**Files:**
- Create: `packages/react/package.json`, `packages/react/tsconfig.json`
- Create: `packages/react/src/index.ts`, `packages/react/src/theme/tier3.ts`
- Create: `scripts/gen-theme-contract.ts`
- Create (generated, then committed): `packages/react/src/theme/contract.css.ts`
- Create: `vitest.config.ts`
- Create: `packages/react/src/gates/contract-drift.gate.test.ts`
- Test: `packages/react/src/theme/tier3.test.ts`
- Modify: root `package.json` (workspaces already covers `packages/*`; add devDeps + scripts), `.gitignore`

**Interfaces:**
- Consumes: from `@ap/tokens` — `generateTheme`, `DEFAULT_BRAND`, `SEMANTIC_MAP` (`readonly SemanticEntry[]`, each `{token, ramp, step}`), `Theme` (with `theme.scales.{space,text,radius,elevation,z,misc}` and `theme.font`).
- Produces:
  - `vars` from `packages/react/src/theme/contract.css.ts` — nested object of `var(--ap-*)` strings, camelCase keys: `vars.color.bgCanvas`, `vars.space['4']`, `vars.text.md.size`, `vars.text.md.lineHeight`, `vars.radius.md`, `vars.shadow['1']`, `vars.z.dialog`, `vars.font.body`, `vars.font.weightMedium`, `vars.misc.hitTarget`, `vars.misc.focusRingWidth`
  - `tier3(name: string, fallback: string): string` from `theme/tier3.ts` — returns `var(--ap-{name}, {fallback})`
  - `toCamel(kebab: string): string` from `scripts/gen-theme-contract.ts` (script-local, not exported from the package)

- [ ] **Step 1: Root devDependencies, scripts, and gitignore**

Add to root `package.json` `devDependencies` (keep existing entries):

```json
"@testing-library/dom": "^10.4.1",
"@testing-library/react": "^16.3.3",
"@types/react": "^19.2.2",
"@types/react-dom": "^19.2.2",
"@vanilla-extract/vite-plugin": "^5.2.6",
"jsdom": "^30.0.1",
"react": "^19.2.8",
"react-dom": "^19.2.8",
"vite": "^8.2.2"
```

Add to root `package.json` `scripts`:

```json
"gen:theme-contract": "tsx scripts/gen-theme-contract.ts",
"test:contract": "vitest run packages/react/src/gates/contract-drift.gate.test.ts"
```

Change `typecheck` to: `"typecheck": "tsc -b packages/tokens packages/react packages/vite"`.

Append to `.gitignore`:

```
fixtures/*/node_modules/
fixtures/*/build/
fixtures/*/.react-router/
fixtures/*/dist/
test-results/
playwright-report/
```

- [ ] **Step 2: `@ap/react` package skeleton**

`packages/react/package.json` — note `@ap/tokens` uses `file:` so an outside consumer resolves it transitively (ADR-0002):

```json
{
  "name": "@ap/react",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": ["*.css"],
  "exports": {
    ".": "./src/index.ts",
    "./theme.css": "./src/theme/theme.css",
    "./fonts.css": "./src/theme/fonts.css"
  },
  "dependencies": {
    "@ap/tokens": "file:../tokens",
    "@vanilla-extract/css": "^1.21.2",
    "@vanilla-extract/recipes": "^0.5.7"
  },
  "peerDependencies": {
    "react": ">=19.2.7",
    "react-dom": ">=19.2.7"
  },
  "engines": { "node": ">=22.22.0" }
}
```

`"sideEffects": ["*.css"]` matters: without it a bundler may tree-shake away a bare `import '@ap/react/theme.css'`.

`packages/react/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "jsx": "react-jsx",
    "lib": ["ES2023", "DOM", "DOM.Iterable"]
  },
  "include": ["src"],
  "references": [{ "path": "../tokens" }]
}
```

`packages/react/src/index.ts` — a placeholder for now; the real exports are added in Step 9, once the files they name exist. An index that references not-yet-created modules would break every intermediate test run:

```ts
// Public surface. Populated as modules land — see Step 9.
export {}
```

Then run `npm install` so the new workspace and its dependencies are registered. Every later step in this task depends on it — in particular the root Vitest config cannot load `@vanilla-extract/vite-plugin` until this runs.

- [ ] **Step 3: Root Vitest config so `.css.ts` imports work in tests**

`vitest.config.ts` at the repo root — without the plugin, any test importing a `.css.ts` file fails to transform:

```ts
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vanillaExtractPlugin()],
  test: {
    // packages only — fixture e2e specs belong to Playwright, not Vitest
    include: ['packages/*/src/**/*.test.{ts,tsx}'],
  },
})
```

`*.gate.test.ts` already ends in `.test.ts`, so this one pattern covers unit tests and gates alike.

React component tests select jsdom per-file with a `// @vitest-environment jsdom` docblock rather than via config globs — that syntax is stable across Vitest versions and keeps `@ap/tokens` tests in the fast node environment.

If a `.css.ts` import still fails to resolve under Vitest, add `server: { deps: { inline: [/@vanilla-extract/] } }` to the `test` block — that is the known fix, not a signal to change the approach.

- [ ] **Step 4: Write the failing test for `tier3`**

`packages/react/src/theme/tier3.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { tier3 } from './tier3.js'

describe('tier3', () => {
  it('wraps a Tier 2 value in a Tier 3 override with fallback', () => {
    expect(tier3('surface-bg', 'var(--ap-color-bg-surface)')).toBe(
      'var(--ap-surface-bg, var(--ap-color-bg-surface))',
    )
  })
  it('accepts a literal fallback', () => {
    expect(tier3('surface-radius', '6px')).toBe('var(--ap-surface-radius, 6px)')
  })
  it('rejects a name that already carries the prefix', () => {
    expect(() => tier3('--ap-surface-bg', '6px')).toThrow(/without the --ap- prefix/)
  })
})
```

- [ ] **Step 5: Run to verify failure**

Run: `npx vitest run packages/react/src/theme/tier3.test.ts`
Expected: FAIL — cannot find module `./tier3.js`.

- [ ] **Step 6: Implement `tier3`**

`packages/react/src/theme/tier3.ts`:

```ts
/**
 * Declare a Tier 3 (component-level) token that falls back to a Tier 2
 * semantic value. Components read Tier 3; a product overriding
 * `--ap-surface-bg` changes one component, overriding the Tier 2 token
 * changes the theme. See ADR-0007.
 *
 * @param name  token name WITHOUT the `--ap-` prefix, e.g. `surface-bg`
 * @param fallback  the Tier 2 value, normally `vars.color.*`
 */
export function tier3(name: string, fallback: string): string {
  if (name.startsWith('--')) {
    throw new Error(`tier3() takes a token name without the --ap- prefix, got: ${name}`)
  }
  return `var(--ap-${name}, ${fallback})`
}
```

- [ ] **Step 7: Run to verify pass**

Run: `npx vitest run packages/react/src/theme/tier3.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Write the contract generator**

`scripts/gen-theme-contract.ts`. The contract deliberately contains **no Tier 1 ramp steps** — that is how ADR-0007's "components never reference Tier 1" becomes structural rather than advisory:

```ts
// Dev-only script: regenerates packages/react/src/theme/contract.css.ts
// Run: npm run gen:theme-contract   — commit the output. Never edited by hand.
import { writeFileSync } from 'node:fs'
import { DEFAULT_BRAND, SEMANTIC_MAP, generateTheme } from '@ap/tokens'

export const toCamel = (kebab: string): string =>
  kebab.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())

const theme = generateTheme({ brand: DEFAULT_BRAND })

/** `color-bg-canvas` → key `bgCanvas` under the `color` group. */
const colorEntries = SEMANTIC_MAP.map((e) => {
  const withoutGroup = e.token.replace(/^color-/, '')
  return [toCamel(withoutGroup), e.token] as const
})

const lines: string[] = []
const group = (name: string, entries: readonly (readonly [string, string])[]): void => {
  lines.push(`  ${name}: {`)
  for (const [key, token] of entries) lines.push(`    ${JSON.stringify(key)}: '${token}',`)
  lines.push('  },')
}

lines.push('export const vars = createGlobalThemeContract(')
lines.push('  {')
group('color', colorEntries)
group(
  'space',
  Object.keys(theme.scales.space).map((k) => [k, `space-${k}`] as const),
)
// text is nested one level deeper: vars.text.md.size / .lineHeight
lines.push('  text: {')
for (const k of Object.keys(theme.scales.text)) {
  lines.push(`    ${JSON.stringify(toCamel(k))}: {`)
  lines.push(`      size: 'text-${k}-size',`)
  lines.push(`      lineHeight: 'text-${k}-lh',`)
  lines.push('    },')
}
lines.push('  },')
group(
  'radius',
  Object.keys(theme.scales.radius).map((k) => [k, `radius-${k}`] as const),
)
group(
  'shadow',
  Object.keys(theme.scales.elevation.light).map((k) => [k, `shadow-${k}`] as const),
)
group(
  'z',
  Object.keys(theme.scales.z).map((k) => [k, `z-${k}`] as const),
)
group('font', [
  ['body', 'font-body'],
  ['heading', 'font-heading'],
  ['mono', 'font-mono'],
  ['weightRegular', 'font-weight-regular'],
  ['weightMedium', 'font-weight-medium'],
  ['weightSemibold', 'font-weight-semibold'],
])
group(
  'misc',
  Object.keys(theme.scales.misc)
    .filter((k) => k !== 'hit-target-coarse') // only ever set inside the coarse media query
    .map((k) => [toCamel(k), k] as const),
)
lines.push('  },')
lines.push("  (value) => `ap-${value}`,")
lines.push(')')

const file = `// GENERATED by scripts/gen-theme-contract.ts — do not edit.
// Regenerate with: npm run gen:theme-contract
//
// Tier 2 semantic tokens and scales ONLY. Tier 1 ramp primitives
// (--ap-brand-9 etc.) are deliberately absent so component code cannot
// reference them — ADR-0007's tier rule, enforced structurally.
import { createGlobalThemeContract } from '@vanilla-extract/css'

${lines.join('\n')}
`

writeFileSync('packages/react/src/theme/contract.css.ts', file)
console.log('contract.css.ts written')
```

- [ ] **Step 9: Generate the contract, eyeball it, and populate the index**

Run: `npm run gen:theme-contract`
Then read `packages/react/src/theme/contract.css.ts`. Verify: it calls `createGlobalThemeContract`, has `color.bgCanvas: 'color-bg-canvas'`, has `text.md.size`/`text.md.lineHeight`, contains **no** ramp-step names like `brand-9`, and ends with the `` (value) => `ap-${value}` `` mapper.

Now replace the placeholder `packages/react/src/index.ts` with the real surface:

```ts
export { vars } from './theme/contract.css.js'
export { tier3 } from './theme/tier3.js'
```

- [ ] **Step 10: Write the drift gate**

`packages/react/src/gates/contract-drift.gate.test.ts` — the guard that keeps the generated contract honest against the token engine:

```ts
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
```

- [ ] **Step 11: Run the gate and the full suite**

Run: `npm run test:contract` — expected PASS (4 tests).
Run: `npm test` — all Phase 1 tests still pass plus the new ones.
Run: `npm run typecheck` — clean.

**If `tsc -b` fails with TS6059 ("not under rootDir") or TS6307 ("not listed within the file list")**, the cause is TypeScript project references interacting with our `exports` map pointing at `./src/index.ts` rather than a declaration file. Do not restructure the packages. The sanctioned fallback is to drop project references entirely: remove `"composite": true` from `tsconfig.base.json`, remove the `"references"` array from `packages/react/tsconfig.json`, and change the root script to `"typecheck": "tsc -p packages/tokens && tsc -p packages/react && tsc -p packages/vite"`. Each package then typechecks `@ap/tokens` from source, which is what consumers do anyway. Record which route you took in your report.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(react): package skeleton, tier3 helper, generated Tier 2/3 token contract with drift gate"
```

---

### Task 2: `theme.css` generation and freshness gate

**Files:**
- Create: `scripts/gen-theme-css.ts`
- Create (generated, then committed): `packages/react/src/theme/theme.css`
- Create: `packages/react/src/gates/theme-freshness.gate.test.ts`
- Modify: root `package.json` (scripts)

**Interfaces:**
- Consumes: `generateTheme`, `DEFAULT_BRAND`, `toCssText` from `@ap/tokens`.
- Produces: `packages/react/src/theme/theme.css`, importable as `@ap/react/theme.css`.

- [ ] **Step 1: Add the scripts**

Add to root `package.json` `scripts`:

```json
"gen:theme-css": "tsx scripts/gen-theme-css.ts",
"test:freshness": "vitest run packages/react/src/gates/theme-freshness.gate.test.ts"
```

- [ ] **Step 2: Write the generator**

`scripts/gen-theme-css.ts`:

```ts
// Dev-only script: regenerates packages/react/src/theme/theme.css
// Run: npm run gen:theme-css   — commit the output. Never edited by hand.
import { writeFileSync } from 'node:fs'
import { DEFAULT_BRAND, generateTheme, toCssText } from '@ap/tokens'

const HEADER = `/* GENERATED by scripts/gen-theme-css.ts — do not edit.
   Regenerate with: npm run gen:theme-css
   Seed: ${DEFAULT_BRAND} (placeholder until the brand decision) */
`

writeFileSync(
  'packages/react/src/theme/theme.css',
  HEADER + toCssText(generateTheme({ brand: DEFAULT_BRAND })),
)
console.log('theme.css written')
```

- [ ] **Step 3: Generate and eyeball**

Run: `npm run gen:theme-css`
Read the first 30 lines of `packages/react/src/theme/theme.css`. Verify: header comment, then `@layer ap.tokens, ap.components;` as the first CSS line, then `@layer ap.tokens {` and a `:root {` block containing `--ap-brand-9: #2e5fd9;` and `--ap-color-bg-canvas: var(--ap-neutral-1);`.

- [ ] **Step 4: Write the freshness gate**

`packages/react/src/gates/theme-freshness.gate.test.ts` — this is the ADR-0014-style guard that a committed generated artifact can never silently drift from its generator:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_BRAND, generateTheme, toCssText } from '@ap/tokens'

const THEME_CSS = join(import.meta.dirname, '../theme/theme.css')

describe('gate: theme.css is fresh', () => {
  const committed = readFileSync(THEME_CSS, 'utf8')
  const expected = toCssText(generateTheme({ brand: DEFAULT_BRAND }))

  it('committed theme.css matches the generator output', () => {
    const body = committed.slice(committed.indexOf('@layer'))
    expect(
      body,
      'theme.css is stale — run `npm run gen:theme-css` and commit the result',
    ).toBe(expected)
  })

  it('carries the do-not-edit header naming the regen command', () => {
    expect(committed).toContain('GENERATED by scripts/gen-theme-css.ts')
    expect(committed).toContain('npm run gen:theme-css')
  })

  it('declares the cascade layer order first (ADR-0016)', () => {
    const body = committed.slice(committed.indexOf('@layer'))
    expect(body.startsWith('@layer ap.tokens, ap.components;')).toBe(true)
  })
})
```

- [ ] **Step 5: Run the gate**

Run: `npm run test:freshness` — expected PASS (3 tests).
Then prove the gate actually bites: append a stray line to `theme.css`, re-run, confirm FAIL with the "stale" message, then restore with `npm run gen:theme-css`.

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test && npm run typecheck` — both clean.

```bash
git add -A
git commit -m "feat(react): generate committed theme.css with a freshness gate"
```

---

### Task 3: Vendored Inter and generated `fonts.css`

**Files:**
- Create: `scripts/gen-fonts.ts`
- Create (vendored, committed): `packages/react/fonts/inter-latin.woff2`, `packages/react/fonts/inter-latin-ext.woff2`
- Create (generated, committed): `packages/react/src/theme/fonts.css`
- Test: `packages/react/src/gates/fonts.gate.test.ts`
- Modify: root `package.json` (devDeps + scripts)

**Interfaces:**
- Consumes: `generateTheme`, `DEFAULT_BRAND`, `toFallbackFontFaceCss` from `@ap/tokens`; `@fontsource-variable/inter` (devDependency only — the woff2 files are copied into our tree, so consumers never install it).
- Produces: `packages/react/src/theme/fonts.css`, importable as `@ap/react/fonts.css`.

Why vendor rather than depend: ADR-0015 requires first-party font hosting (Google Fonts CDN leaks user IPs — a live GDPR exposure for an EU HR product). Copying the woff2 into our tree keeps a single artifact set that travels with the git submodule.

- [ ] **Step 1: Add dependency and scripts**

Add to root `devDependencies`: `"@fontsource-variable/inter": "^5.3.0"`.
Add to root `scripts`:

```json
"gen:fonts": "tsx scripts/gen-fonts.ts",
"test:fonts": "vitest run packages/react/src/gates/fonts.gate.test.ts"
```

Run `npm install`.

- [ ] **Step 2: Write the vendoring + generation script**

`scripts/gen-fonts.ts`. It discovers the woff2 by pattern rather than hard-coded path, because fontsource's layout has changed between majors — a loud failure with a directory listing beats a silent wrong file:

```ts
// Dev-only script: vendors Inter woff2 into packages/react/fonts/ and
// regenerates packages/react/src/theme/fonts.css.
// Run: npm run gen:fonts   — commit both outputs. Never edited by hand.
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { DEFAULT_BRAND, generateTheme, toFallbackFontFaceCss } from '@ap/tokens'

const require = createRequire(import.meta.url)
const pkgDir = dirname(require.resolve('@fontsource-variable/inter/package.json'))
const filesDir = join(pkgDir, 'files')
const available = readdirSync(filesDir)

const pick = (pattern: RegExp): string => {
  const hit = available.find((f) => pattern.test(f))
  if (!hit) {
    throw new Error(
      `No file matching ${pattern} in ${filesDir}.\nAvailable:\n  ${available.join('\n  ')}`,
    )
  }
  return hit
}

const OUT_FONTS = 'packages/react/fonts'
mkdirSync(OUT_FONTS, { recursive: true })

const subsets = [
  { name: 'latin', file: pick(/^inter-latin-wght-normal\.woff2$/), out: 'inter-latin.woff2',
    unicodeRange:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' },
  { name: 'latin-ext', file: pick(/^inter-latin-ext-wght-normal\.woff2$/), out: 'inter-latin-ext.woff2',
    unicodeRange:
      'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF' },
]

for (const s of subsets) copyFileSync(join(filesDir, s.file), join(OUT_FONTS, s.out))

const theme = generateTheme({ brand: DEFAULT_BRAND })

const faces = subsets
  .map((s) =>
    [
      '@font-face {',
      "  font-family: 'Inter';",
      '  font-style: normal;',
      '  font-display: swap;',
      '  font-weight: 100 900;',
      `  src: url('../../fonts/${s.out}') format('woff2-variations');`,
      `  unicode-range: ${s.unicodeRange};`,
      '}',
      '',
    ].join('\n'),
  )
  .join('\n')

const file = `/* GENERATED by scripts/gen-fonts.ts — do not edit.
   Regenerate with: npm run gen:fonts
   Inter is SIL Open Font License 1.1, vendored from @fontsource-variable/inter.
   Self-hosted deliberately: no third-party font requests (ADR-0015). */

${faces}${toFallbackFontFaceCss(theme)}`

writeFileSync('packages/react/src/theme/fonts.css', file)
console.log(`fonts.css written; vendored ${subsets.length} woff2 files`)
```

- [ ] **Step 3: Run the generator and eyeball**

Run: `npm run gen:fonts`
Verify: `packages/react/fonts/` contains two `.woff2` files, each roughly 40–120 KB. Read `packages/react/src/theme/fonts.css` — two `@font-face` blocks for `'Inter'` with `font-weight: 100 900`, then one for `'Inter Fallback'` with `src: local('Arial')` and four metric override lines.

If `pick()` throws, read the printed directory listing and adjust the two regexes to the actual names — do not hard-code a path you have not seen.

- [ ] **Step 4: Write the gate**

`packages/react/src/gates/fonts.gate.test.ts`:

```ts
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_BRAND, generateTheme, toFallbackFontFaceCss } from '@ap/tokens'

const ROOT = join(import.meta.dirname, '../..')
const FONTS_CSS = join(ROOT, 'src/theme/fonts.css')

describe('gate: fonts', () => {
  const css = readFileSync(FONTS_CSS, 'utf8')

  it('vendors both woff2 subsets with plausible sizes', () => {
    for (const f of ['inter-latin.woff2', 'inter-latin-ext.woff2']) {
      const p = join(ROOT, 'fonts', f)
      expect(existsSync(p), `${f} missing`).toBe(true)
      expect(statSync(p).size).toBeGreaterThan(10_000)
    }
  })

  it('references the vendored files by relative path, never a remote URL', () => {
    expect(css).toContain("url('../../fonts/inter-latin.woff2')")
    expect(css).toContain("url('../../fonts/inter-latin-ext.woff2')")
    expect(css).not.toMatch(/https?:\/\//)
  })

  it('emits the metric-matched fallback face verbatim from the token engine', () => {
    expect(css).toContain(toFallbackFontFaceCss(generateTheme({ brand: DEFAULT_BRAND })))
  })

  it('uses font-display: swap on the real faces', () => {
    expect(css.match(/font-display: swap;/g)?.length).toBe(2)
  })
})
```

The third assertion is the load-bearing one: it ties `fonts.css` to `toFallbackFontFaceCss` so the shift-free fallback can never drift from the metrics table.

- [ ] **Step 5: Run, then commit**

Run: `npm run test:fonts` — PASS (4 tests). Then `npm test && npm run typecheck` — clean.

```bash
git add -A
git commit -m "feat(react): vendor Inter woff2 and generate fonts.css with metric-matched fallback"
```

---

### Task 4: The `Surface` component — proving the styling pipeline

**Files:**
- Create: `packages/react/src/components/Surface/Surface.tokens.ts`
- Create: `packages/react/src/components/Surface/Surface.css.ts`
- Create: `packages/react/src/components/Surface/Surface.tsx`
- Create: `packages/react/src/components/Surface/index.ts`
- Test: `packages/react/src/components/Surface/Surface.test.tsx`
- Modify: `packages/react/src/index.ts`

**Interfaces:**
- Consumes: `vars` (Task 1), `tier3` (Task 1).
- Produces:
  - `Surface` — `React.ForwardRefExoticComponent<SurfaceProps & React.RefAttributes<HTMLDivElement>>`
  - `interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> { tone?: 'canvas' | 'surface' | 'raised'; pad?: 'none' | 'sm' | 'md' | 'lg' }`
  - `surfaceRecipe` from `Surface.css.ts` — a vanilla-extract recipe function
  - `SURFACE_TOKENS` from `Surface.tokens.ts` — the documented Tier 3 override surface

Surface is deliberately the *only* component in Phase 2. Its job is to exercise every mechanism the pipeline depends on — typed contract, Tier 3 fallback, recipe variants, data attributes, `'use client'`, ref forwarding, SSR-safety — so that when it renders correctly inside a consumer's build, everything behind it is proven too.

- [ ] **Step 1: Write the failing test**

`packages/react/src/components/Surface/Surface.test.tsx`:

```tsx
// @vitest-environment jsdom
import { createRef } from 'react'
import { renderToString } from 'react-dom/server'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Surface } from './Surface.js'

describe('Surface', () => {
  it('renders its children in a div', () => {
    render(<Surface>hello</Surface>)
    expect(screen.getByText('hello').tagName).toBe('DIV')
  })

  it('exposes tone and pad as data attributes for styling hooks', () => {
    render(
      <Surface tone="raised" pad="lg">
        x
      </Surface>,
    )
    const el = screen.getByText('x')
    expect(el.getAttribute('data-ap-tone')).toBe('raised')
    expect(el.getAttribute('data-ap-pad')).toBe('lg')
  })

  it('defaults to tone=surface and pad=md', () => {
    render(<Surface>y</Surface>)
    const el = screen.getByText('y')
    expect(el.getAttribute('data-ap-tone')).toBe('surface')
    expect(el.getAttribute('data-ap-pad')).toBe('md')
  })

  it('merges className rather than replacing the recipe class', () => {
    render(<Surface className="mine">z</Surface>)
    const el = screen.getByText('z')
    expect(el.classList.contains('mine')).toBe(true)
    expect(el.classList.length).toBeGreaterThan(1)
  })

  it('forwards refs and spreads unknown props', () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <Surface ref={ref} id="s1" aria-label="panel">
        w
      </Surface>,
    )
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(ref.current?.id).toBe('s1')
    expect(ref.current?.getAttribute('aria-label')).toBe('panel')
  })

  it('renders to a string on the server without touching browser globals', () => {
    const html = renderToString(<Surface tone="canvas">ssr</Surface>)
    expect(html).toContain('ssr')
    expect(html).toContain('data-ap-tone="canvas"')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/react/src/components/Surface/Surface.test.tsx`
Expected: FAIL — cannot find module `./Surface.js`.

- [ ] **Step 3: Declare the Tier 3 tokens**

`packages/react/src/components/Surface/Surface.tokens.ts` — this file *is* the component's documented override surface (ADR-0007):

```ts
import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for Surface. Each falls back to a Tier 2 semantic value,
 * so a product can restyle just this component by setting the Tier 3
 * custom property, or restyle the whole theme via Tier 2.
 */
export const SURFACE_TOKENS = {
  bgCanvas: tier3('surface-bg-canvas', vars.color.bgCanvas),
  bgSurface: tier3('surface-bg-surface', vars.color.bgSurface),
  bgRaised: tier3('surface-bg-raised', vars.color.bgRaised),
  border: tier3('surface-border', vars.color.borderSubtle),
  text: tier3('surface-text', vars.color.textPrimary),
  radius: tier3('surface-radius', vars.radius.md),
  shadowRaised: tier3('surface-shadow-raised', vars.shadow['1']),
} as const
```

- [ ] **Step 4: Write the recipe**

`packages/react/src/components/Surface/Surface.css.ts`. Every dimension uses **logical properties** per the global constraints:

```ts
import { recipe } from '@vanilla-extract/recipes'
import { vars } from '../../theme/contract.css.js'
import { SURFACE_TOKENS as t } from './Surface.tokens.js'

export const surfaceRecipe = recipe({
  base: {
    boxSizing: 'border-box',
    color: t.text,
    fontFamily: vars.font.body,
    fontSize: vars.text.md.size,
    lineHeight: vars.text.md.lineHeight,
    borderRadius: t.radius,
    borderStyle: 'solid',
    borderWidth: '1px',
    borderColor: t.border,
  },
  variants: {
    tone: {
      canvas: { background: t.bgCanvas },
      surface: { background: t.bgSurface },
      raised: { background: t.bgRaised, boxShadow: t.shadowRaised },
    },
    pad: {
      none: { padding: vars.space['0'] },
      sm: { padding: vars.space['3'] },
      md: { padding: vars.space['5'] },
      lg: { padding: vars.space['6'] },
    },
  },
  defaultVariants: { tone: 'surface', pad: 'md' },
})
```

The variant unions are written out by hand in `SurfaceProps` rather than derived via `RecipeVariants`. For a public API the explicit union is what appears in a consumer's autocomplete and in generated docs, and the two are kept honest by the tests that assert each default.

- [ ] **Step 5: Write the component**

`packages/react/src/components/Surface/Surface.tsx`:

```tsx
'use client'

import { forwardRef, type HTMLAttributes } from 'react'
import { surfaceRecipe } from './Surface.css.js'

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  /** Background role. Defaults to `surface`. */
  tone?: 'canvas' | 'surface' | 'raised'
  /** Internal spacing. Defaults to `md`. */
  pad?: 'none' | 'sm' | 'md' | 'lg'
}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface(
  { tone = 'surface', pad = 'md', className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={[surfaceRecipe({ tone, pad }), className].filter(Boolean).join(' ')}
      data-ap-tone={tone}
      data-ap-pad={pad}
      {...rest}
    >
      {children}
    </div>
  )
})
```

`packages/react/src/components/Surface/index.ts`:

```ts
export { Surface } from './Surface.js'
export type { SurfaceProps } from './Surface.js'
export { SURFACE_TOKENS } from './Surface.tokens.js'
```

Add to `packages/react/src/index.ts`:

```ts
export { Surface, SURFACE_TOKENS } from './components/Surface/index.js'
export type { SurfaceProps } from './components/Surface/index.js'
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run packages/react/src/components/Surface/Surface.test.tsx`
Expected: PASS (6 tests).

If the `.css.ts` import fails to transform, apply the `server.deps.inline` fix noted in Task 1 Step 3 rather than restructuring the component.

- [ ] **Step 7: Run the full suite and commit**

Run: `npm test && npm run typecheck` — clean.

```bash
git add -A
git commit -m "feat(react): Surface component with typed contract, Tier 3 tokens and recipe variants"
```

---

### Task 5: Source guard gates

**Files:**
- Create: `packages/react/src/gates/use-client.gate.test.ts`
- Create: `packages/react/src/gates/ssr-safety.gate.test.ts`
- Create: `packages/react/src/gates/style-rules.gate.test.ts`
- Modify: root `package.json` (scripts)

**Interfaces:**
- Consumes: nothing from earlier tasks — these scan source text.
- Produces: `npm run test:guards` covering all three.

These implement the ADR-0005/0007/0016 enforcement clauses. As recorded in Global Constraints, they are source-scanning tests rather than stylelint rules because stylelint cannot parse `.css.ts`.

- [ ] **Step 1: Add the script**

Add to root `package.json` `scripts`:

```json
"test:guards": "vitest run packages/react/src/gates/use-client.gate.test.ts packages/react/src/gates/ssr-safety.gate.test.ts packages/react/src/gates/style-rules.gate.test.ts"
```

- [ ] **Step 2: Write the `'use client'` gate**

`packages/react/src/gates/use-client.gate.test.ts`:

```ts
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const COMPONENTS = join(import.meta.dirname, '../components')

function componentModules(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return componentModules(p)
    const isComponent =
      e.name.endsWith('.tsx') && !e.name.includes('.test.') && !e.name.includes('.stories.')
    return isComponent ? [p] : []
  })
}

describe('gate: every component module is a client module (ADR-0005)', () => {
  const files = componentModules(COMPONENTS)

  it('finds component modules to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    it(`${file.split('components')[1]} starts with 'use client'`, () => {
      const first = readFileSync(file, 'utf8').trimStart().split('\n')[0]!.trim()
      expect(first).toBe("'use client'")
    })
  }
})
```

- [ ] **Step 3: Write the SSR-safety gate**

`packages/react/src/gates/ssr-safety.gate.test.ts`:

```ts
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')

function runtimeSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return e.name === 'gates' ? [] : runtimeSources(p)
    const isRuntime =
      (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) &&
      !e.name.includes('.test.') &&
      !e.name.endsWith('.css.ts')
    return isRuntime ? [p] : []
  })
}

const FORBIDDEN: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /\bwindow\./, why: 'no window during render — use useHydrated/useMediaQuery' },
  { pattern: /\bdocument\./, why: 'no document during render' },
  { pattern: /\bglobalThis\.(window|document)\b/, why: 'no browser globals via globalThis' },
  { pattern: /\blocalStorage\b|\bsessionStorage\b/, why: 'storage reads belong in an effect' },
  { pattern: /\bmatchMedia\b/, why: 'use the SSR-safe useMediaQuery wrapper' },
  { pattern: /\buseLayoutEffect\b/, why: 'use useIsomorphicLayoutEffect — plain useLayoutEffect warns on the server' },
  { pattern: /\bDate\.now\(\)/, why: 'non-deterministic render causes hydration mismatch' },
  { pattern: /\bMath\.random\(\)/, why: 'non-deterministic render causes hydration mismatch' },
  { pattern: /from ['"]react-router['"]/, why: '@ap/react must not depend on react-router (ADR-0001)' },
  { pattern: /from ['"]node:/, why: 'no Node built-ins in runtime source' },
]

describe('gate: runtime source is SSR-safe (ADR-0005)', () => {
  const files = runtimeSources(SRC)

  it('finds runtime sources to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    it(`${file.split('src')[1]} is clean`, () => {
      const text = readFileSync(file, 'utf8')
      const hits = FORBIDDEN.filter((r) => r.pattern.test(text)).map(
        (r) => `${r.pattern} — ${r.why}`,
      )
      expect(hits, `${file}:\n  ${hits.join('\n  ')}`).toEqual([])
    })
  }
})
```

- [ ] **Step 4: Write the style-rules gate**

`packages/react/src/gates/style-rules.gate.test.ts`:

```ts
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
      const removals = text.match(/outline:\s*['"](none|0)['"]/g)
      expect(removals ?? [], 'outline: none is forbidden — style :focus-visible instead').toEqual([])
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
```

- [ ] **Step 5: Run the guards, then prove each bites**

Run: `npm run test:guards` — expected PASS.

Now verify the gates are not vacuous. One at a time, make the violation, confirm the specific test FAILS, then revert:
1. Delete the `'use client'` line from `Surface.tsx` → use-client gate fails.
2. Add `const w = window.innerWidth` to `Surface.tsx` → ssr-safety gate fails.
3. Add `marginLeft: '4px'` to the recipe base in `Surface.css.ts` → style-rules logical-properties gate fails.
4. Add `zIndex: 5` to the recipe base → style-rules z-index gate fails.

Record in the report that all four were confirmed to fail and were reverted.

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test && npm run typecheck` — clean.

```bash
git add -A
git commit -m "feat(react): use-client, SSR-safety and style-rule source gates"
```

---

### Task 6: The `@ap/vite` consumer preset

**Files:**
- Create: `packages/vite/package.json`, `packages/vite/tsconfig.json`
- Create: `packages/vite/src/index.ts`
- Test: `packages/vite/src/index.test.ts`
- Modify: root `package.json` (scripts)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `apComponents(options?: ApComponentsOptions): PluginOption[]` from `@ap/vite`
  - `interface ApComponentsOptions { vanillaExtract?: Parameters<typeof vanillaExtractPlugin>[0] }`
  - `AP_PACKAGES: readonly string[]` — the package names that must be bundled rather than externalised

This is ADR-0002's "one line, not config archaeology". The `ssr.noExternal` entry is the load-bearing part: without it, an SSR build externalises our packages, never runs the vanilla-extract transform on `.css.ts`, and fails at runtime with an unresolvable import.

- [ ] **Step 1: Write the failing test**

`packages/vite/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { AP_PACKAGES, apComponents } from './index.js'

/** Pull the config object the preset contributes via its `config` hook. */
function presetConfig(): Record<string, any> {
  const plugins = apComponents().flat()
  const cfgPlugin = plugins.find(
    (p: any) => p && typeof p === 'object' && p.name === 'ap-components:config',
  ) as any
  expect(cfgPlugin, 'preset must contribute a config plugin').toBeDefined()
  return cfgPlugin.config()
}

describe('apComponents()', () => {
  it('returns the vanilla-extract plugin plus our config plugin', () => {
    const names = apComponents()
      .flat()
      .filter((p: any) => p && typeof p === 'object' && 'name' in p)
      .map((p: any) => p.name as string)
    expect(names).toContain('ap-components:config')
    expect(names.some((n) => n.includes('vanilla-extract'))).toBe(true)
  })

  it('marks every ap package as ssr.noExternal so .css.ts is transformed', () => {
    expect(presetConfig()['ssr'].noExternal).toEqual([...AP_PACKAGES])
  })

  it('excludes ap packages from dep pre-bundling', () => {
    expect(presetConfig()['optimizeDeps'].exclude).toEqual([...AP_PACKAGES])
  })

  it('covers @ap/react and @ap/tokens', () => {
    expect(AP_PACKAGES).toContain('@ap/react')
    expect(AP_PACKAGES).toContain('@ap/tokens')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/vite/src/index.test.ts`
Expected: FAIL — cannot find module `./index.js`.

- [ ] **Step 3: Create the package**

`packages/vite/package.json`:

```json
{
  "name": "@ap/vite",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": false,
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@vanilla-extract/vite-plugin": "^5.2.6"
  },
  "peerDependencies": {
    "vite": "^7.0.0 || ^8.0.0"
  },
  "engines": { "node": ">=22.22.0" }
}
```

`packages/vite/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}
```

- [ ] **Step 4: Implement the preset**

`packages/vite/src/index.ts`:

```ts
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import type { PluginOption } from 'vite'

/**
 * Packages whose source the consumer compiles. They must be bundled rather
 * than externalised, or an SSR build never runs the vanilla-extract
 * transform over their `.css.ts` files. See ADR-0002.
 */
export const AP_PACKAGES = ['@ap/react', '@ap/tokens'] as const

export interface ApComponentsOptions {
  /** Passed straight through to `vanillaExtractPlugin`. */
  vanillaExtract?: Parameters<typeof vanillaExtractPlugin>[0]
}

/**
 * Everything a product needs to consume apComponents from a vendored
 * submodule:
 *
 * ```ts
 * export default defineConfig({
 *   plugins: [reactRouter(), apComponents()],
 * })
 * ```
 */
export function apComponents(options: ApComponentsOptions = {}): PluginOption[] {
  return [
    vanillaExtractPlugin(options.vanillaExtract),
    {
      name: 'ap-components:config',
      config: () => ({
        ssr: { noExternal: [...AP_PACKAGES] },
        optimizeDeps: { exclude: [...AP_PACKAGES] },
      }),
    },
  ]
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm install` (registers the new workspace), then `npx vitest run packages/vite/src/index.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test && npm run typecheck` — clean.

```bash
git add -A
git commit -m "feat(vite): apComponents() preset wiring vanilla-extract and SSR externalisation"
```

---

### Task 7: SSR + SPA fixture application (gates 6 and 7, markup half)

**Files:**
- Create: `fixtures/ssr-app/package.json`, `react-router.config.ts`, `vite.config.ts`, `tsconfig.json`
- Create: `fixtures/ssr-app/app/root.tsx`, `app/routes.ts`, `app/routes/home.tsx`, `app/routes/streamed.tsx`
- Create: `packages/react/src/gates/ssr-render.gate.test.ts`
- Modify: root `package.json` (scripts)

**Interfaces:**
- Consumes: `Surface` from `@ap/react`; `apComponents()` from `@ap/vite`.
- Produces: a built RR8 app whose server entry is `fixtures/ssr-app/build/server/index.js`; npm scripts `test:ssr` and `test:spa`.

`fixtures/ssr-app` is **not** a workspace member. It installs its own dependencies through `file:` specifiers, which is exactly the consumption path ADR-0002 describes.

- [ ] **Step 1: Create the fixture package**

`fixtures/ssr-app/package.json`:

```json
{
  "name": "ap-fixture-ssr-app",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "react-router build",
    "start": "react-router-serve ./build/server/index.js"
  },
  "dependencies": {
    "@ap/react": "file:../../packages/react",
    "@ap/vite": "file:../../packages/vite",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "react-router": "^8.3.1"
  },
  "devDependencies": {
    "@react-router/dev": "^8.3.1",
    "@react-router/node": "^8.3.1",
    "@react-router/serve": "^8.3.1",
    "@types/node": "^22.20.1",
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "typescript": "^5.6.0",
    "vite": "^8.2.2"
  }
}
```

`@react-router/dev`'s other peers (`wrangler`, `@vitejs/plugin-rsc`, `react-server-dom-webpack`) are all declared optional, so this install stays lean — no RSC or Cloudflare toolchain is pulled in.
```

`fixtures/ssr-app/react-router.config.ts` — one app, two modes, selected by env var so the SPA gate needs no second fixture:

```ts
import type { Config } from '@react-router/dev/config'

export default {
  // AP_SPA=1 builds the same app as a client-only SPA (ADR-0005).
  ssr: process.env['AP_SPA'] !== '1',
} satisfies Config
```

`fixtures/ssr-app/vite.config.ts` — the entire consumer-side integration, in two plugin calls:

```ts
import { reactRouter } from '@react-router/dev/vite'
import { apComponents } from '@ap/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [reactRouter(), apComponents()],
})
```

`fixtures/ssr-app/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"],
    "lib": ["ES2023", "DOM", "DOM.Iterable"]
  },
  "include": ["app", "*.ts"]
}
```

- [ ] **Step 2: Write the app**

`fixtures/ssr-app/app/root.tsx` — imports both stylesheets, which is what proves the `exports` map and the vendored font path resolve through a real bundler:

```tsx
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'
import '@ap/react/fonts.css'
import '@ap/react/theme.css'

export default function Root() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
```

`fixtures/ssr-app/app/routes.ts`:

```ts
import { index, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('streamed', 'routes/streamed.tsx'),
] satisfies RouteConfig
```

If the build rejects this shape, check the exports of `@react-router/dev/routes` (`index`, `route`, `layout`) before changing anything else — the route config is the most version-sensitive file here.

`fixtures/ssr-app/app/routes/home.tsx`:

```tsx
import { Surface } from '@ap/react'

export default function Home() {
  return (
    <main>
      <h1>ap fixture</h1>
      {/* `id`, not `data-testid`: SurfaceProps extends HTMLAttributes, which
          does not admit arbitrary `data-*` keys on a component. */}
      <Surface tone="raised" pad="lg" id="surface-raised">
        server rendered surface
      </Surface>
      <Surface tone="canvas" pad="sm">
        canvas surface
      </Surface>
    </main>
  )
}
```

`fixtures/ssr-app/app/routes/streamed.tsx` — a deliberately slow Suspense boundary, so gate 6 exercises content that flushes *after* the shell (ADR-0014):

```tsx
import { Suspense } from 'react'
import { Await } from 'react-router'
import { Surface } from '@ap/react'
import type { Route } from './+types/streamed'

export async function loader() {
  // Deliberately deferred: this content flushes after the shell.
  const slow = new Promise<string>((resolve) => {
    setTimeout(() => resolve('streamed surface content'), 120)
  })
  return { slow }
}

export default function Streamed({ loaderData }: Route.ComponentProps) {
  return (
    <main>
      <h1>streamed</h1>
      <Suspense fallback={<p>loading…</p>}>
        <Await resolve={loaderData.slow}>
          {(value: string) => (
            <Surface tone="surface" pad="md" id="streamed-surface">
              {value}
            </Surface>
          )}
        </Await>
      </Suspense>
    </main>
  )
}
```

If the generated `./+types/streamed` types are unavailable (they are produced by `react-router typegen` during build), type `loaderData` as `{ slow: Promise<string> }` inline instead — the fixture's job is the runtime behaviour, not its typings.

- [ ] **Step 3: Install and build the fixture by hand once**

```bash
cd fixtures/ssr-app && npm install && npm run build && cd ../..
```

Expected: `fixtures/ssr-app/build/server/index.js` and `fixtures/ssr-app/build/client/assets/*.css` exist. Confirm the emitted CSS contains `--ap-color-bg-canvas` (proving `theme.css` was bundled) and a hashed Surface class.

If the build fails on an unresolved `.css.ts`, the cause is almost always `ssr.noExternal` not reaching the config — verify `apComponents()` is in the plugin list and re-check Task 6.

- [ ] **Step 4: Add the gate scripts**

Add to root `package.json` `scripts`:

```json
"fixture:install": "npm --prefix fixtures/ssr-app install && npm --prefix fixtures/consumer install",
"test:ssr": "vitest run packages/react/src/gates/ssr-render.gate.test.ts"
```

- [ ] **Step 5: Write the SSR/SPA gate**

`packages/react/src/gates/ssr-render.gate.test.ts` — builds, boots the real server, and asserts over HTTP. This is the artifact that makes the SSR claim true (ADR-0014 gate 6):

```ts
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const APP = join(import.meta.dirname, '../../../../fixtures/ssr-app')
const PORT = 3111
const BASE = `http://127.0.0.1:${PORT}`
const isWin = process.platform === 'win32'
const npm = isWin ? 'npm.cmd' : 'npm'
// Node refuses to spawn a .cmd without a shell (the CVE-2024-27980 fix),
// so Windows needs shell:true or every fixture gate dies with EINVAL.
const shell = isWin

let server: ChildProcess

async function waitForServer(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`server did not start within ${timeoutMs}ms`)
}

beforeAll(async () => {
  execFileSync(npm, ['run', 'build'], {
    cwd: APP,
    stdio: 'inherit',
    shell,
    env: { ...process.env },
  })
  server = spawn(npm, ['run', 'start'], {
    cwd: APP,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
    shell,
  })
  await waitForServer()
}, 180_000)

afterAll(() => {
  server?.kill()
})

describe('gate 6: React Router 8 framework-mode SSR', () => {
  it('server-renders Surface markup into the HTML, not an empty shell', async () => {
    const html = await (await fetch(BASE)).text()
    expect(html).toContain('server rendered surface')
    expect(html).toContain('data-ap-tone="raised"')
    expect(html).toContain('data-ap-pad="lg"')
    expect(html).toContain('data-ap-tone="canvas"')
  })

  it('links the compiled stylesheet from the server HTML', async () => {
    const html = await (await fetch(BASE)).text()
    expect(html).toMatch(/<link[^>]+rel="stylesheet"[^>]+\.css/)
  })

  it('flushes Suspense content that resolves after the shell', async () => {
    const html = await (await fetch(`${BASE}/streamed`)).text()
    expect(html).toContain('streamed surface content')
    expect(html).toContain('id="streamed-surface"')
  })

  it('emits token custom properties into the built CSS', () => {
    const assets = join(APP, 'build/client/assets')
    const css = readdirSync(assets)
      .filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(join(assets, f), 'utf8'))
      .join('\n')
    expect(css).toContain('--ap-color-bg-canvas')
    expect(css).toContain('@layer ap.tokens')
  })
})

describe('gate 7: the same app builds and serves as an SPA', () => {
  it('produces a client-only build with an index.html', () => {
    execFileSync(npm, ['run', 'build'], {
      cwd: APP,
      stdio: 'inherit',
      shell,
      env: { ...process.env, AP_SPA: '1' },
    })
    const indexHtml = join(APP, 'build/client/index.html')
    expect(existsSync(indexHtml), 'SPA build should emit build/client/index.html').toBe(true)
    const html = readFileSync(indexHtml, 'utf8')
    expect(html).toMatch(/<link[^>]+rel="stylesheet"[^>]+\.css/)
  })
}, 180_000)
```

Note the SPA assertion checks for a *shell* with the stylesheet linked — a client-rendered app deliberately does not contain Surface markup in its HTML. That difference is the whole point of the distinction in ADR-0005.

Because the SPA build overwrites `build/`, run gate 7 last within the file (Vitest runs `describe` blocks in declaration order) and rebuild in SSR mode before any later suite that needs the server build.

- [ ] **Step 6: Run the gate**

Run: `npm run test:ssr`
Expected: PASS. First run takes a couple of minutes (build + boot).

If the server never becomes ready, run `npm --prefix fixtures/ssr-app run start` by hand and read its output — the most common cause is the SPA build from a previous run leaving no server bundle. Rebuild with `npm --prefix fixtures/ssr-app run build`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(fixtures): RR8 framework-mode SSR/SPA fixture with markup and streaming gates"
```

---

### Task 8: Hydration gate (gate 6, hydration half)

**Files:**
- Create: `fixtures/ssr-app/playwright.config.ts`
- Create: `fixtures/ssr-app/e2e/hydration.spec.ts`
- Modify: `fixtures/ssr-app/package.json` (devDeps + script), root `package.json` (scripts)

**Interfaces:**
- Consumes: the built SSR fixture from Task 7.
- Produces: `npm run test:hydration`.

Hydration warnings are the single most common way an SSR-safe library stops being SSR-safe, and they only appear in a real browser console. Playwright is the honest instrument; it also serves gate 9 (visual regression) in Phase 6, so the dependency is not single-use.

- [ ] **Step 1: Add Playwright to the fixture**

Add to `fixtures/ssr-app/devDependencies`: `"@playwright/test": "^1.62.1"`.
Add to `fixtures/ssr-app/scripts`: `"test:e2e": "playwright test"`.
Add to root `scripts`: `"test:hydration": "npm --prefix fixtures/ssr-app run test:e2e"`.

Then:

```bash
cd fixtures/ssr-app && npm install && npx playwright install chromium && cd ../..
```

- [ ] **Step 2: Write the Playwright config**

`fixtures/ssr-app/playwright.config.ts` — Playwright builds and boots the server itself, so the gate is self-contained:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3112' },
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://127.0.0.1:3112',
    env: { PORT: '3112' },
    timeout: 180_000,
    reuseExistingServer: false,
  },
})
```

- [ ] **Step 3: Write the hydration spec**

`fixtures/ssr-app/e2e/hydration.spec.ts`:

```ts
import { expect, test, type ConsoleMessage } from '@playwright/test'

/** React hydration problems surface as console errors/warnings with these markers. */
const HYDRATION_MARKERS = [
  'Hydration failed',
  'did not match',
  'server rendered HTML',
  'Text content does not match',
  'There was an error while hydrating',
  'server-rendered',
]

/**
 * Noise that is not a defect in the library. Keep this list short and
 * justified — never add a hydration marker to it.
 */
const IGNORED = [/favicon/i, /Download the React DevTools/i]

function collect(page: import('@playwright/test').Page): string[] {
  const messages: string[] = []
  const keep = (text: string): boolean => !IGNORED.some((r) => r.test(text))
  page.on('console', (m: ConsoleMessage) => {
    if ((m.type() === 'error' || m.type() === 'warning') && keep(m.text())) messages.push(m.text())
  })
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`))
  return messages
}

test('home route hydrates with no React warnings or page errors', async ({ page }) => {
  const messages = collect(page)
  await page.goto('/')
  await expect(page.locator('#surface-raised')).toBeVisible()
  await page.waitForTimeout(500) // let hydration settle

  const hydration = messages.filter((m) => HYDRATION_MARKERS.some((k) => m.includes(k)))
  expect(hydration, `hydration problems:\n${hydration.join('\n')}`).toEqual([])
  expect(messages, `unexpected console output:\n${messages.join('\n')}`).toEqual([])
})

test('streamed route hydrates cleanly after late Suspense content', async ({ page }) => {
  const messages = collect(page)
  await page.goto('/streamed')
  await expect(page.locator('#streamed-surface')).toBeVisible()
  await page.waitForTimeout(500)

  expect(messages, `unexpected console output:\n${messages.join('\n')}`).toEqual([])
})

test('token custom properties resolve to real computed values in the browser', async ({ page }) => {
  await page.goto('/')
  const bg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--ap-color-bg-canvas').trim(),
  )
  expect(bg, 'theme.css did not reach the browser').not.toBe('')

  const surfaceBg = await page.evaluate(() => {
    const el = document.querySelector('#surface-raised')!
    return getComputedStyle(el).backgroundColor
  })
  expect(surfaceBg, 'Surface has no resolved background').not.toBe('rgba(0, 0, 0, 0)')
})

test('Inter loads from our own origin, never a third party (ADR-0015)', async ({ page }) => {
  const external: string[] = []
  page.on('request', (r) => {
    const url = new URL(r.url())
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') external.push(r.url())
  })
  await page.goto('/')
  await page.waitForTimeout(500)
  expect(external, `third-party requests: ${external.join(', ')}`).toEqual([])
})
```

The last test is worth its cost: it converts ADR-0015's GDPR argument from prose into something CI enforces.

- [ ] **Step 4: Run the hydration gate**

Run: `npm run test:hydration`
Expected: 4 passed.

If a benign console message trips the strict "no console output" assertion (a dev-mode notice, a favicon 404), add that exact string to an explicit allowlist in the spec with a comment explaining why — never relax the hydration-marker assertion itself.

- [ ] **Step 5: Rebuild in SSR mode and commit**

```bash
npm --prefix fixtures/ssr-app run build
git add -A
git commit -m "feat(fixtures): Playwright hydration gate covering streaming, tokens and font origin"
```

---

### Task 9: Consumer fixture (gate 8)

**Files:**
- Create: `fixtures/consumer/package.json`, `vite.config.ts`, `index.html`, `tsconfig.json`
- Create: `fixtures/consumer/src/main.tsx`
- Create: `packages/react/src/gates/consumer-build.gate.test.ts`
- Modify: root `package.json` (scripts)

**Interfaces:**
- Consumes: `@ap/react` and `@ap/vite` by `file:` protocol; `Surface`.
- Produces: `npm run test:consumer`.

This is the gate that makes ADR-0002's submodule claim true. The fixture is a plain Vite + React app — no React Router — because a consumer must be able to use us without adopting our router assumptions.

- [ ] **Step 1: Create the fixture**

`fixtures/consumer/package.json` — the `file:` specifiers are precisely what a product's `package.json` contains after vendoring us at `vendor/apComponents/`:

```json
{
  "name": "ap-fixture-consumer",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build"
  },
  "dependencies": {
    "@ap/react": "file:../../packages/react",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@ap/vite": "file:../../packages/vite",
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "@vitejs/plugin-react": "^6.1.1",
    "typescript": "^5.6.0",
    "vite": "^8.2.2"
  }
}
```

`fixtures/consumer/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import { apComponents } from '@ap/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), apComponents()],
})
```

`fixtures/consumer/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>ap consumer fixture</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`fixtures/consumer/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Surface, type SurfaceProps } from '@ap/react'
import '@ap/react/fonts.css'
import '@ap/react/theme.css'

// Type-level proof that the published types resolve for a consumer.
const tone: SurfaceProps['tone'] = 'raised'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Surface tone={tone} pad="lg">
      consumer fixture
    </Surface>
  </StrictMode>,
)
```

`fixtures/consumer/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "lib": ["ES2023", "DOM", "DOM.Iterable"]
  },
  "include": ["src", "*.ts"]
}
```

- [ ] **Step 2: Install and build by hand once**

```bash
cd fixtures/consumer && npm install && npm run build && cd ../..
```

Expected: `fixtures/consumer/dist/assets/*.css` exists and contains `--ap-color-bg-canvas`.

Note what this proves: npm resolved `@ap/react` through `file:`, then resolved *its* `@ap/tokens": "file:../tokens"` dependency transitively — the mechanism ADR-0002 relies on so products never hand-maintain our dependency list.

- [ ] **Step 3: Write the gate**

`packages/react/src/gates/consumer-build.gate.test.ts`:

```ts
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const APP = join(import.meta.dirname, '../../../../fixtures/consumer')
const DIST = join(APP, 'dist')
const isWin = process.platform === 'win32'
const npm = isWin ? 'npm.cmd' : 'npm'

let css = ''

beforeAll(() => {
  // shell:true on Windows — Node will not spawn a .cmd without it.
  execFileSync(npm, ['run', 'build'], { cwd: APP, stdio: 'inherit', shell: isWin })
  const assets = join(DIST, 'assets')
  css = readdirSync(assets)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(join(assets, f), 'utf8'))
    .join('\n')
}, 180_000)

describe('gate 8: a file:-protocol consumer builds against our source', () => {
  it('produces a build', () => {
    expect(existsSync(join(DIST, 'index.html'))).toBe(true)
  })

  it('bundles the token custom properties', () => {
    expect(css).toContain('--ap-color-bg-canvas')
    expect(css).toContain('--ap-brand-9')
  })

  it('bundles the cascade layers (ADR-0016)', () => {
    expect(css).toContain('@layer ap.tokens')
  })

  it('actually ran the vanilla-extract transform over our .css.ts', () => {
    // The recipe's own declarations only exist if `.css.ts` was compiled,
    // rather than the package being externalised.
    expect(css).toMatch(/var\(--ap-surface-bg-surface,\s*var\(--ap-color-bg-surface\)\)/)
  })

  it('inlines the vendored font faces and no remote font URL', () => {
    expect(css).toContain('Inter Fallback')
    expect(css).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
  })
})
```

The fourth assertion is the one that catches the specific failure ADR-0002 warns about: if `ssr.noExternal`/plugin wiring regresses, the build may still succeed while silently shipping no component CSS.

- [ ] **Step 4: Add the script and run**

Add to root `scripts`: `"test:consumer": "vitest run packages/react/src/gates/consumer-build.gate.test.ts"`.

Run: `npm run test:consumer` — expected PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(fixtures): file:-protocol consumer fixture proving the submodule build path"
```

---

### Task 10: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `docs/CONTRIBUTING.md`
- Modify: root `package.json` (scripts)

**Interfaces:**
- Consumes: every script defined in Tasks 1–9.
- Produces: a CI pipeline running ADR-0014's gates, with `reports/contrast.md` as an uploaded artifact.

- [ ] **Step 1: Add an aggregate script**

Add to root `package.json` `scripts`:

```json
"test:gates": "npm run test:tokens && npm run test:contrast && npm run test:gamut && npm run test:sweep && npm run test:contract && npm run test:freshness && npm run test:fonts && npm run test:guards"
```

- [ ] **Step 2: Write the workflow**

`.github/workflows/ci.yml`. Node is pinned to an exact minor because Phase 1's determinism rests on V8's transcendental-function stability — a floating Node version could shift a generated hex by one bit and fail the snapshot gate for reasons unrelated to any change:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

env:
  NODE_VERSION: '22.22.0'

jobs:
  unit:
    name: Unit tests, gates and typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run test:gates
      - name: Generate the contrast report
        run: npm run report:contrast
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: contrast-report
          path: reports/contrast.md

  generated-artifacts-are-fresh:
    name: Generated artifacts are fresh
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm run gen:theme-contract
      - run: npm run gen:theme-css
      - run: npm run gen:fonts
      - run: npm run gen:font-metrics
      - name: Fail if any generated file drifted from its generator
        run: |
          if ! git diff --exit-code; then
            echo "::error::Generated files are stale. Run the gen:* scripts and commit the result."
            exit 1
          fi

  consumer:
    name: Consumer build (gate 8)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm --prefix fixtures/consumer install
      - run: npm run test:consumer

  ssr:
    name: SSR and SPA (gates 6 and 7)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm --prefix fixtures/ssr-app install
      - run: npm run test:ssr
      - run: npx --prefix fixtures/ssr-app playwright install --with-deps chromium
      - run: npm run test:hydration
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: fixtures/ssr-app/playwright-report/
```

The `generated-artifacts-are-fresh` job is the CI half of the committed-generated-source policy: every `gen:*` script re-runs and any diff fails the build. It is what makes committing generated files safe.

- [ ] **Step 3: Write the contributor notes**

`docs/CONTRIBUTING.md`:

```markdown
# Contributing

## Requirements

Node 22.22.0 or later (React Router 8's floor). npm 10+.

## Setup

    npm install
    npm --prefix fixtures/ssr-app install
    npm --prefix fixtures/consumer install
    npx --prefix fixtures/ssr-app playwright install chromium

## Everyday commands

| Command | What it does |
|---|---|
| `npm test` | Full Vitest suite |
| `npm run typecheck` | `tsc -b` across all packages |
| `npm run test:gates` | Token, contrast, gamut, sweep, freshness, guard and contract gates |
| `npm run test:ssr` | Builds and serves the RR8 fixture, asserts SSR markup and streaming |
| `npm run test:hydration` | Playwright: zero hydration warnings, tokens resolve, no third-party requests |
| `npm run test:consumer` | Builds the `file:`-protocol consumer fixture |
| `npm run report:contrast` | Writes `reports/contrast.md` (the WCAG compliance artifact) |

## Generated files

These are generated and **committed**. Never edit them by hand; CI fails if they drift.

| File | Regenerate with |
|---|---|
| `packages/tokens/src/typography/metrics.generated.ts` | `npm run gen:font-metrics` |
| `packages/react/src/theme/contract.css.ts` | `npm run gen:theme-contract` |
| `packages/react/src/theme/theme.css` | `npm run gen:theme-css` |
| `packages/react/src/theme/fonts.css` + `packages/react/fonts/*.woff2` | `npm run gen:fonts` |

## Rules the gates enforce

- Every component module starts with `'use client'`.
- No browser globals, `useLayoutEffect`, `Date.now()`, `Math.random()` or `react-router`
  imports in `@ap/react` runtime source.
- Component styles reference Tier 2/3 tokens only — never a Tier 1 ramp step.
- Logical properties only (`marginInlineStart`, not `marginLeft`).
- No literal `zIndex`; use `vars.z.*`.
- Never `outline: 'none'` — style `:focus-visible` instead.

## Adding a component

Copy the shape of `packages/react/src/components/Surface/`: a `.tsx` module with
`'use client'`, a `.css.ts` recipe, a `.tokens.ts` file declaring the Tier 3 override
surface, a test, and an `index.ts`. Nothing else in the tree needs to change.
```

- [ ] **Step 4: Full local verification**

Run every gate in order and confirm each is green:

```bash
npm run typecheck
npm test
npm run test:gates
npm run report:contrast
npm run test:consumer
npm run test:ssr
npm run test:hydration
```

Then confirm the freshness job would pass locally:

```bash
npm run gen:theme-contract && npm run gen:theme-css && npm run gen:fonts && npm run gen:font-metrics
git diff --exit-code && echo "generated artifacts are fresh"
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "ci: gate pipeline with pinned Node, freshness job and fixture builds; contributor docs"
```

---

## Verification (Phase 2 exit criteria)

Run in order; all must hold:

1. `npm run typecheck` — clean across `@ap/tokens`, `@ap/react`, `@ap/vite`.
2. `npm test` — full suite green, including Phase 1's 186 tests.
3. `npm run test:gates` — token, contrast, gamut, sweep, freshness, guard and contract gates all pass independently.
4. `npm run test:consumer` — **gate 8.** A `file:`-protocol consumer builds, and its CSS contains both token custom properties and compiled `.css.ts` output. *This is the artifact that makes the submodule claim true.*
5. `npm run test:ssr` — **gates 6 and 7.** The RR8 app server-renders Surface markup, flushes late Suspense content, emits the token layer into its CSS, and also builds as an SPA.
6. `npm run test:hydration` — **gate 6, hydration half.** Zero hydration warnings, zero unexpected console output, custom properties resolve in a real browser, and no third-party requests.
7. Regenerate everything and `git diff --exit-code` — no drift.

**Proof artifact:** a green CI run on `main` with all four jobs passing, plus `reports/contrast.md` from that run. That single link demonstrates the token engine still produces accessible output, the component library builds, it server-renders and hydrates cleanly, and an outside repository can consume it.

## Out of scope for this plan (deliberately)

- `@ap/motion` and the motion token system — Phase 3.
- Base UI primitives and the real component set — Phase 4. (Note: Base UI's current published version is `1.0.0-rc.0`, not a 1.x stable; ADR-0004's version claim needs correcting before Phase 4 pins it.)
- Storybook and the docs site — Phase 6.
- Visual regression (gate 9) and bundle budgets (gate 10) — Phase 6. Playwright arriving here means gate 9 has its runner already.
- The real default brand seed — `DEFAULT_BRAND` stays the placeholder; changing it re-runs `gen:theme-css` and the snapshots.
- ESLint. The ADR-mandated rules are covered by the source gates; general TS linting can be added whenever it earns its keep.
- `ThemeProvider`, `ThemeScript` and the runtime theming path (ADR-0009) — Phase 4, alongside the hooks that need them.
