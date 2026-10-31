# `icons-core` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `packages/icons` (`@ap/icons`) with:
- the icon data format and `defineIcon`;
- the standalone duotone renderer at `@ap/icons/react`;
- the seven existing icons ported in, each with a secondary layer;
- the Icon Standard v0 and its gates;
- generated SVGs, and bundle and tree-shake checks.

`@ap/react` is **not** touched. It keeps its own seven icons until `icons-react`.

**Architecture:**
- **Icons are frozen, branded plain objects.** Each has stroked `primary` paths and an optional `secondary` (filled paths or `'halo'`), and each lives in its own module.
- **The root entry point is framework-free.** `./react` holds a hook-free `Icon` that resolves colour per the spec's table and paints secondary, then primary.
- **Gates are vitest tests.** They read the built-in set off the root export and check the Standard's machine-checkable rules.

**Tech Stack:** TypeScript 5.6 (strict, `exactOptionalPropertyTypes`), React 19.2, Vitest 4.1.11 (jsdom), Vite 8.2.2 with `@ap/vite` for bundle checks, `tsx` for scripts. **New devDependencies (root):** `lucide-static@1.58.0` (ISC) and `svg-path-bbox@2.1.0` (BSD-3-Clause), both pinned exactly.

**Spec:** `docs/superpowers/specs/2026-10-31-icons-package-design.md`. This plan implements:
- §2's `icons-core` row;
- §3 and §4 in full;
- §5.1;
- §6, as v0 plus its [gate] items;
- §8, the icons-core part;
- §9;
- the icons-core part of §10: the new ADR and the ADR-0012 pointer.

§5.2–§5.4 belong to `icons-react`. §7 belongs to `icons-pilot`.

## Global Constraints

- **Relative imports carry `.js`**, even from `.ts`/`.tsx`. House style is single quotes and no semicolons. **Never run prettier.**
- **`exactOptionalPropertyTypes` is on.** Spread optional props conditionally (precedent: `packages/react/src/icons/Icon.tsx:62-70`).
- **Node 22.22.0 in CI.** Run tests with `npx vitest run --project unit <paths>`.
- **Packages export source:** `"exports": { ".": "./src/index.ts", "./react": "./src/react/index.ts" }`. No build step (ADR-0002).
- **`STROKE = 1.5`, `HALO_STROKE = 5`, `SECONDARY_OPACITY = 0.4`, `DEFAULT_VIEWBOX = '0 0 24 24'`.** These are spec §5.1 and §6.1. Neither stroke is a prop.
- **Nothing under `packages/icons/src` outside `src/react/` and `src/gates/` imports React.** Nothing outside `src/gates/` imports `lucide-static`.
- **`@ap/icons/react`'s `Icon` has no hooks, no context and no `'use client'`.**
- **Built-in names are kebab-case. Each export name is `PascalCase(name)`.** `close` becomes `x`.
- **Do not touch `packages/react`.**
- **Sequencing:** `feat/single-react` also edits `packages/vite/src/index.ts`. If it has merged to `main` when this plan starts, rebase `feat/icons` onto `main` first. Task 1's edit is one array entry, so a later rebase conflict is trivial.

## Review Focus

1. **Two copies of `@ap/icons` in one tree.** A standalone copy and the one behind `@ap/react/icons` must recognise each other's icons. The brand is `Symbol.for('ap.icon')`, not a module-local `Symbol()`. The test is in Task 1.
2. **Lucide icons are `forwardRef` objects, not functions.** `Icon` must route anything that is not a branded definition to the foreign path, including `forwardRef` and `memo` objects. The test is in Task 3.
3. **A consumer reuses or mutates the arrays passed to `defineIcon`.** The definition holds frozen copies, so later mutation of the input never changes a rendered icon. The test is in Task 1.
4. **Duotone props on a foreign icon or on an icon with no secondary.** They render outline only, without throwing. `duoToneSecondary` must not leak onto a foreign component as a prop. The test is in Task 3.
5. **`size` given as a CSS string**, e.g. `'var(--x)'` or `'2rem'`. It passes through untouched to `style.width`/`height`, never as an attribute. The test is in Task 3.

---

### Task 1: Package skeleton, data format, `defineIcon`

**Files:**
- Create: `packages/icons/package.json`, `packages/icons/tsconfig.json`, `packages/icons/src/types.ts`, `packages/icons/src/constants.ts`, `packages/icons/src/define.ts`, `packages/icons/src/define.test.ts`, `packages/icons/src/index.ts` (temporary: exports from `define.ts`, `types.ts`, `constants.ts` only)
- Modify: `packages/vite/src/index.ts:13` (`AP_PACKAGES`), root `package.json` (`typecheck` script: add `packages/icons` after `packages/motion`; `devDependencies`: add the two pinned packages), `package-lock.json` (via `npm install`)

**Interfaces:**
- Produces:
  - `interface IconDefinition { readonly name: string; readonly primary: readonly string[]; readonly secondary?: readonly string[] | 'halo'; readonly viewBox?: string }`
  - `type IconInput`, the same shape with mutable arrays
  - `defineIcon(input: IconInput): IconDefinition`
  - `isIconDefinition(value: unknown): value is IconDefinition`
  - The constants `STROKE`, `HALO_STROKE`, `SECONDARY_OPACITY` and `DEFAULT_VIEWBOX`

**`package.json`:**
- `"name": "@ap/icons"`, `"version": "0.1.0"`, `"type": "module"`, `"sideEffects": false`
- The exports from Global Constraints
- `"peerDependencies": { "react": ">=19.2.7" }` with `"peerDependenciesMeta": { "react": { "optional": true } }`, because only `./react` needs it
- `"engines": { "node": ">=22.22.0" }`

**`tsconfig.json`:** mirror `packages/react/tsconfig.json`, with no references.

- [ ] **Step 1: Write the failing tests in `define.test.ts`**

```ts
describe('defineIcon', () => {
  it('returns a frozen definition with frozen layer arrays', ...)        // Object.isFrozen on def, def.primary, def.secondary
  it('copies its input: mutating the input array afterwards changes nothing', ...)  // push onto input.primary → def.primary.length unchanged
  it("accepts secondary: 'halo'", ...)
  it.each(['Bell', 'bell_icon', '-bell', 'bell-', ''])('rejects name %j', (name) =>
    expect(() => defineIcon({ name, primary: ['M0 0'] })).toThrow(`defineIcon: name "${name}" must be kebab-case`))
  it('rejects an empty primary', ...)        // toThrow('defineIcon(bell): primary must contain at least one path')
  it('rejects an empty path string', ...)    // primary: [''] → toThrow('defineIcon(bell): every path must be a non-empty string')
  it('rejects an empty secondary array', ...) // toThrow("defineIcon(bell): secondary must be 'halo' or a non-empty array of paths")
  it.each(['0 0 24', '0 0 0 24', 'a b c d'])('rejects viewBox %j', (viewBox) =>
    expect(() => defineIcon({ name: 'bell', primary: ['M0 0'], viewBox })).toThrow(`defineIcon(bell): viewBox "${viewBox}" must be four numbers with positive width and height`))
})
describe('isIconDefinition', () => {
  it('is true for a defineIcon result and false for a look-alike plain object', ...)
  it('is false for null, a string, a function and a forwardRef object', ...)
  it("recognises an object branded with Symbol.for('ap.icon') by another copy of the package", ...)  // Review Focus 1
  it('keeps the brand non-enumerable: Object.keys(def) is the data keys only', ...)
})
```

- [ ] **Step 2: Run** `npx vitest run --project unit packages/icons`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `types.ts`, `constants.ts` and `define.ts`**
  - The brand is `Symbol.for('ap.icon')`, set with `Object.defineProperty(def, BRAND, { value: true })` before `Object.freeze`.
  - `secondary` and `viewBox` are copied only when present, to satisfy `exactOptionalPropertyTypes`.
  - The name regex is `/^[a-z0-9]+(-[a-z0-9]+)*$/`.

- [ ] **Step 4: Wire the package in**
  - Add `'@ap/icons'` to `AP_PACKAGES`.
  - Add `packages/icons` to `typecheck`.
  - Add `"lucide-static": "1.58.0"` and `"svg-path-bbox": "2.1.0"` to the root `devDependencies`.
  - Run `npm install`.

- [ ] **Step 5: Verify**
  - Run `npx vitest run --project unit packages/icons packages/vite`. Expected: PASS. `packages/vite/src/index.test.ts` enumerates `packages/`, so it fails if Step 4 missed the array.
  - Run `npm run typecheck`. Expected: exit 0.
  - Run `npm run check:lockfiles`. Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/icons packages/vite/src/index.ts package.json package-lock.json
git commit -m "feat(icons): @ap/icons package, IconDefinition format and defineIcon"
```

---

### Task 2: Port the seven icons, plus the catalogue manifest

**Files:**
- Create: one module per icon in `packages/icons/src/icons/`: `check.ts`, `x.ts`, `chevron-down.ts`, `info.ts`, `alert-circle.ts`, `check-circle.ts`, `alert-triangle.ts`
- Create: `packages/icons/src/catalogue.ts`, `packages/icons/src/icons.test.ts`
- Modify: `packages/icons/src/index.ts`, which re-exports each icon by name

**Interfaces:**
- Consumes: `defineIcon` (Task 1).
- Produces:
  - Value exports `Check`, `X`, `ChevronDown`, `Info`, `AlertCircle`, `CheckCircle`, `AlertTriangle` from `@ap/icons`.
  - `CATALOGUE: Readonly<Record<string, { readonly lucide: string | null }>>`, keyed by icon name.
  - `PENDING_REDRAW: readonly string[]`, initially `[]`. Task 5 fills it.

`catalogue.ts` is internal and is **not** re-exported from `index.ts`.

**Port the paths unchanged** from `packages/react/src/icons/paths.ts` (`close` becomes `x`). Add the secondaries:

| Icon | `secondary` | `lucide` |
|---|---|---|
| `check`, `x`, `chevron-down` | `'halo'` | `check`, `x`, `chevron-down` |
| `info`, `alert-circle`, `check-circle` | `['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z']` | `info`, `circle-alert`, `circle-check` |
| `alert-triangle` | `['M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z']` | `triangle-alert` |

- [ ] **Step 1: Write the failing test `icons.test.ts`**
  - `builtIns()` is `Object.values(await import('./index.js')).filter(isIconDefinition)`. Task 4 reuses it.
  - Assert the sorted names equal `['alert-circle','alert-triangle','check','check-circle','chevron-down','info','x']`.
  - Assert every export key equals `PascalCase(def.name)`.
  - Assert the `CATALOGUE` keys equal the built-in names exactly, with no extras and none missing.

- [ ] **Step 2: Run** `npx vitest run --project unit packages/icons/src/icons.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the seven modules, `catalogue.ts` and the `index.ts` re-exports.** Put `builtIns()` and `pascalCase(name: string): string` in `packages/icons/src/gates/builtIns.ts`, so Task 4's gates share them.

- [ ] **Step 4: Run** the same command. Expected: PASS.

- [ ] **Step 5: Commit** with `git commit -m "feat(icons): port the seven component icons with secondary layers"`.

---

### Task 3: The standalone renderer, `@ap/icons/react`

**Files:**
- Create: `packages/icons/src/react/Icon.tsx`, `packages/icons/src/react/index.ts`, `packages/icons/src/react/Icon.test.tsx`

**Interfaces:**
- Consumes: `IconDefinition`, `isIconDefinition`, and the constants (Task 1); `Check` and `Info` (Task 2) in tests.
- Produces:
  - `type ForeignIconProps = { className?: string; style?: CSSProperties; role?: string; 'aria-label'?: string; 'aria-hidden'?: boolean; focusable?: boolean }`
  - `type IconValue = IconDefinition | ComponentType<ForeignIconProps>`
  - `interface IconProps { icon: IconValue; label?: string; size?: number | string; color?: string; duoTone?: boolean; duoTonePrimary?: string; duoToneSecondary?: string; className?: string }`
  - `function Icon(props: IconProps): JSX.Element`, with `size` defaulting to `'1em'`
- `icons-react` wraps this `Icon`. Its prop names are therefore the contract.

**Behaviour:**
- Follow spec §5.1 exactly: the resolution table and the render sketch.
- Duotone is active only when `duoTone` is truthy **and** `icon` is a definition with a `secondary`.
- The halo group redraws `primary` at `HALO_STROKE`, using `stroke` and `strokeOpacity`.
- The filled group uses `fill` and `fillOpacity`.
- The default opacity is `SECONDARY_OPACITY`, and an explicit `duoToneSecondary` is drawn at full opacity.
- The aria contract is copied from `packages/react/src/icons/Icon.tsx:40-45`.

- [ ] **Step 1: Write the failing tests in `Icon.test.tsx`.** Use `@testing-library/react` `render`, and query `container.querySelector('svg')`.

```ts
it('renders outline only by default: one <g>, stroke-width 1.5, stroke currentColor, no style.color')
it('color sets style.color when duotone is not active')
it('ignores duoTonePrimary and duoToneSecondary when duoTone is absent')        // spec §5.1 row 1
it('ignores them when duoTone={false}')
it('duoTone on a filled icon (Info) paints the secondary group first with fill-opacity 0.4, then the outline')
it("duoTone on a halo icon (Check) paints primary paths at stroke-width 5, stroke-opacity 0.4, under the outline")
it('duoTonePrimary wins over color for the outline when active')
it('color is the outline when active and duoTonePrimary is absent')
it('duoToneSecondary is used as given, with no opacity attribute')
it('duoTone on a definition with no secondary renders outline only and does not throw')
it('a size number becomes px in style; a string passes through: size="var(--x)" gives style.width "var(--x)"')   // Review Focus 5
it('no width/height attributes on the svg')
it('decorative by default: aria-hidden, focusable false, no role')
it('label gives role="img" and aria-label, and no aria-hidden')
it('a function component receives className, style (with color) and aria props only')
it('a forwardRef component is rendered as foreign, not mistaken for a definition')   // Review Focus 2
it('duoTone and duoToneSecondary on a foreign component render it and are not passed to it as props')   // Review Focus 4
it('renders under renderToString (react-dom/server) with no error')
it("Icon.tsx does not start with 'use client' and imports no React hook")   // readFileSync the source; assert no /\buse[A-Z]\w*\(/ and no 'use client'
```

- [ ] **Step 2: Run** `npx vitest run --project unit packages/icons/src/react`. Expected: FAIL.

- [ ] **Step 3: Implement `Icon.tsx` and the `react/index.ts` re-exports** (`Icon`, `IconProps`, `IconValue`, `ForeignIconProps`).

- [ ] **Step 4: Run** the same command. Expected: PASS. Then run `npm run typecheck`. Expected: exit 0.

- [ ] **Step 5: Commit** with `git commit -m "feat(icons): standalone duotone Icon renderer at @ap/icons/react"`.

---

### Task 4: Icon Standard v0, LICENSE, and the standard gates

**Files:**
- Create: `packages/icons/STANDARD.md`, `packages/icons/LICENSE`, `packages/icons/src/gates/standard.gate.test.ts`, `packages/icons/src/gates/isolation.gate.test.ts`, `packages/icons/src/gates/license.gate.test.ts`
- Modify: root `package.json`. Add `"test:icons": "vitest run packages/icons/src/gates"`, and append `&& npm run test:icons` to `test:gates`.

**Interfaces:**
- Consumes: `builtIns()` and `pascalCase` (Task 2). `svgPathBbox` from `svg-path-bbox` returns `[minX, minY, maxX, maxY]`.

**`STANDARD.md`:**
- Version `v0`, with the status "frozen as v1 at the end of icons-pilot".
- The content is spec §6.1–§6.5, carried over as normative text with the decided values (1.5px, 5px). Each [gate] item names the test that enforces it.
- It credits Lucide as the starting point.

**`LICENSE`:** our copyright line for the original work, then a heading "Portions derived from Lucide", then the **verbatim** contents of `node_modules/lucide-static/LICENSE`.

- [ ] **Step 1: Write the failing gates**

`standard.gate.test.ts`, with one `it.each` over `builtIns()` per rule:
- every built-in has a `secondary` (§6.2.4);
- every built-in leaves `viewBox` undefined;
- the bbox union of all its paths lies within `[1, 23]` on both axes (§6.1);
- when `secondary === 'halo'`, the bbox union of `primary` lies within `[2.5, 21.5]` (§6.2.5);
- names are unique.

A failing case names the icon and the offending bbox.

`isolation.gate.test.ts`:
- List the files with `readdirSync(SRC, { recursive: true })`, filtered to `.ts`/`.tsx` and excluding `*.test.*`.
- Any file outside `react/` and `gates/` matching `/from ['"]react(\/|['"])/` fails.
- Any file outside `gates/` containing `lucide` fails.
- Each failure names the file.

`license.gate.test.ts`: `packages/icons/LICENSE` contains `readFileSync('node_modules/lucide-static/LICENSE').trim()` verbatim.

- [ ] **Step 2: Run** `npm run test:icons`. Expected: the license gate FAILS because `LICENSE` doesn't exist yet. The standard gates should PASS on the Task 2 data. If a bounds case fails, fix the data, not the gate, and note the fix in the commit message.

- [ ] **Step 3: Write `STANDARD.md` and `LICENSE`.**

- [ ] **Step 4: Run** `npm run test:icons`. Expected: PASS.

- [ ] **Step 5: Commit** with `git commit -m "feat(icons): Icon Standard v0, Lucide licence notice, standard gates"`.

---

### Task 5: The Lucide divergence gate

**Files:**
- Create: `packages/icons/src/gates/lucide-divergence.gate.test.ts`
- Modify: `packages/icons/src/catalogue.ts` (`PENDING_REDRAW`)

**Interfaces:**
- Consumes: `CATALOGUE`, `PENDING_REDRAW` (Task 2), `builtIns()`.

**Rule (spec §6.5):**
- **Lucide paths:** for each built-in whose `CATALOGUE[name].lucide` is not `null`, read `node_modules/lucide-static/icons/<lucide>.svg`. Collect every `<path d="…">` value, with whitespace collapsed to single spaces and trimmed.
- **Identical:** the icon counts as *identical* when any of its normalised `primary` paths is in that set.
- **Fail:**
  - when an identical icon is not in `PENDING_REDRAW`;
  - when an icon in `PENDING_REDRAW` is no longer identical (stale entry: remove it);
  - when a `lucide` name has no file in `lucide-static`.

- [ ] **Step 1: Write the gate.** Run `npm run test:icons`. Expected: it FAILS and names the ported icons that are still byte-identical to Lucide. It will probably name `check` and `chevron-down`.

- [ ] **Step 2: Set `PENDING_REDRAW`** to exactly the names the failure reported, with a comment: "Ported unchanged in icons-core. icons-pilot redraws them and empties this list."

- [ ] **Step 3: Run** `npm run test:icons`. Expected: PASS.

- [ ] **Step 4: Commit** with `git commit -m "feat(icons): Lucide divergence gate with the icons-core pending-redraw list"`.

---

### Task 6: Generated SVGs and the freshness gate

**Files:**
- Create: `packages/icons/src/svg.ts`, `packages/icons/src/svg.test.ts`, `scripts/gen-icons.ts`, `packages/icons/src/gates/svg-freshness.gate.test.ts`, `packages/icons/svg/*.svg` (generated)
- Modify: root `package.json`. Add `"gen:icons": "tsx scripts/gen-icons.ts"`.

**Interfaces:**
- Consumes: `IconDefinition` and the constants (Task 1); `builtIns()` (Task 2).
- Produces: `toSvg(def: IconDefinition, opts: { duoTone: boolean }): string` (internal, not exported from `index.ts`).

**Exact output.** Each element is on its own line, with two-space indentation inside the root, and the file ends with a newline:

```
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <g fill="currentColor" fill-opacity="0.4" stroke="none">        ← duoTone + filled secondary only
    <path d="…"/>
  </g>
  <g stroke-width="5" stroke-opacity="0.4">                        ← duoTone + halo only (repeats primary paths)
    <path d="…"/>
  </g>
  <path d="…"/>                                                    ← primary paths
</svg>
```

- **`gen-icons.ts`:**
  - writes `packages/icons/svg/<name>.svg` (`duoTone: false`) and `<name>.duotone.svg` (`duoTone: true`) for every built-in;
  - deletes any other `.svg` in that directory;
  - prints the count written.
- **The gate:**
  - the set of files in `svg/` equals the expected set exactly;
  - each file's content equals `toSvg(...)`;
  - the failure message says to run `npm run gen:icons`.

- [ ] **Step 1: Write `svg.test.ts`.** It covers the exact string for `Info` outline, `Info` duotone and `Check` duotone, written out in full. Write the gate too. Run `npx vitest run --project unit packages/icons/src/svg.test.ts packages/icons/src/gates/svg-freshness.gate.test.ts`. Expected: FAIL.

- [ ] **Step 2: Implement `toSvg` and `scripts/gen-icons.ts`.** Run `npm run gen:icons`. Expected: "wrote 14 files".

- [ ] **Step 3: Run** the Step 1 command. Expected: PASS. Then run `npm run typecheck` (it covers `scripts/`). Expected: exit 0.

- [ ] **Step 4: Commit** with `git add packages/icons scripts/gen-icons.ts package.json` and `git commit -m "feat(icons): generated SVG files and freshness gate"`.

---

### Task 7: Tree-shake gate and bundle budgets

**Files:**
- Modify:
  - `scripts/size/measure.ts`: extract `bundle(entry: string): Promise<{ js: string; css: string }>` from `measure`, which then calls it. Add three entries to `checks()`.
  - `packages/react/size-budget.json`: add three entries.
- Create: `scripts/size/tree-shake.test.ts`

**Interfaces:**
- Produces: `bundle(entry)`, the same build `measure` runs today, returning the concatenated JS and CSS source.

**New `checks()` entries:**
- `'icons:renderer': "export { Icon } from '@ap/icons/react'"`
- `'icons:one': "export { Check } from '@ap/icons'"`
- `'icons:all': "export * from '@ap/icons'"`

None of the three starts with `import:`, so `evaluate` applies no index ratio to them (`scripts/size/budget.ts:57`).

- [ ] **Step 1: Write `tree-shake.test.ts`.** It runs `bundle("export { Icon } from '@ap/icons/react'; export { Check } from '@ap/icons'")` with a 60s timeout, then asserts:
  - the JS contains `M20 6 9 17l-5-5` (Check's path);
  - it contains neither `M18 6 6 18M6 6l12 12` (X) nor `M12 16v-5` (Info);
  - `must be kebab-case` occurs at most once.

  Run `npx vitest run --project unit scripts/size/tree-shake.test.ts`. Expected: FAIL (`bundle` is not exported).

- [ ] **Step 2: Extract `bundle`.** Run the test. Expected: PASS. If X's path is present, tree-shaking is broken. Check `"sideEffects": false` and that `index.ts` only re-exports. **Do not weaken the assertion.**

- [ ] **Step 3: Add the three `checks()` entries.** Run `npm run size`. Expected: exit 1 with exactly three problems, `no budget for icons:*`, and every existing row unchanged.

- [ ] **Step 4: Add the three budgets by hand.** Each is the measured brotli value × 1.1, rounded up to the next 100, with `css: 0`. **Never use `--seed`**, which would loosen every existing budget. Run `npm run size`. Expected: exit 0.

- [ ] **Step 5: Commit** with `git add scripts/size packages/react/size-budget.json` and `git commit -m "feat(icons): tree-shake gate and icons bundle budgets"`.

---

### Task 8: ADR, changelog, and the full verification sweep

**Files:**
- Create: `docs/adr/0018-icons-package.md`, `packages/icons/CHANGELOG.md`
- Modify: `docs/adr/README.md` (index row), `docs/adr/0012-cross-cutting-services.md` (the Icons section gains "Superseded by [ADR-0018](0018-icons-package.md)" as its first line; nothing else changes)

**ADR-0018** uses the house ADR format (see `0017-responsive-adaptive.md`). It records:
- the package split, and that apps import through `@ap/react/icons`;
- imported values over string names;
- the data format, including `'halo'`;
- the duotone rules and colour resolution;
- the 1.5px and 5px strokes;
- Lucide as reference only (devDependency, divergence gate);
- the rejected alternatives: string names, peer-depending on Lucide, separate component modules per icon.

It links the spec. The ADR-0011 §6.3 colour amendment is **not** here; that is `icons-react`.

**`CHANGELOG.md`:** `## 0.1.0 (unreleased)`. Package created; seven icons ported from `@ap/react` (`close` renamed to `x`); duotone renderer; Standard v0.

- [ ] **Step 1: Write the ADR, the README row, the ADR-0012 pointer and the CHANGELOG.**

- [ ] **Step 2: Run the verification sweep** (next section) in order. Every check must meet its success signal.

- [ ] **Step 3: Commit** with `git commit -m "docs(icons): ADR-0018, ADR-0012 pointer, changelog"`.

---

## Verification plan (icons-core)

| # | Command | Success signal |
|---|---|---|
| 1 | `npm run typecheck` | Exit 0. |
| 2 | `npm test` | All green, including `packages/icons/**` and `scripts/size/tree-shake.test.ts`. |
| 3 | `npm run test:icons` | Every gate green: standard, isolation, license, lucide-divergence, svg-freshness. |
| 4 | `npm run test:gates` | Exit 0. The existing gates are unaffected, and `test:icons` runs at the end. |
| 5 | `npm run size` | Exit 0. The `icons:*` rows are present, and every pre-existing row is byte-identical to `main`'s report. |
| 6 | `npm run check:lockfiles` | Exit 0. |
| 7 | `git diff main --stat -- packages/react/src` | Empty. `@ap/react` is untouched. |

**Proof artifact:** the output of checks 3 and 5, pasted into the PR description: the gate list and the `icons:*` size rows. It also includes one rendered `svg/info.duotone.svg` opened in a browser, as a screenshot showing the 40% fill under the 1.5px outline.

## Self-review notes

- **Spec coverage:**
  - §3: Tasks 1, 6, 8;
  - §4: Tasks 1, 2;
  - §5.1: Task 3;
  - §6 gates: Tasks 4, 5;
  - §8: Task 7;
  - §9: Task 4;
  - §10 (core part): Task 8.
- **Deferred by design:**
  - to `icons-react`: §5.2–§5.4 and the ADR-0011 amendment;
  - to `icons-pilot`: §7, emptying `PENDING_REDRAW`, and freezing STANDARD v1.
