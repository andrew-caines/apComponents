# Design Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four design follow-ups carried since Phase 5: the focus ring against `bg-raised`, the Tooltip width cap, Tabs underline vs hairline, and the stale Switch `[data-invalid]` item.

**Architecture:** Each fix lives where its decision lives. The ring is solved in the token generator, so every brand seed gets a passing ring by construction rather than by luck. The Tooltip cap becomes a Tier 3 token, like Popover's. The Tabs hairline moves inside the list's padding box, so the underline indicator paints over it.

**Tech Stack:** TypeScript, vanilla-extract, Base UI Tabs, Vitest (unit and Storybook projects), Playwright (fixture e2e and gate 9 visual).

**Spec:** There is no new spec. The decisions were made with the user on 2026-10-13 and are recorded in the project memory `temporal-progress.md`. The open items are listed in `docs/superpowers/plans/2026-10-10-phase5h-gates.md` (Still open) and in `docs/superpowers/specs/2026-09-04-phase5-remaining-components-design.md` §6.3.4 (Still deferred). The decisions:
- **Tabs:** the underline indicator covers the list's hairline.
- **Tooltip:** `max-inline-size` becomes a Tier 3 token. Its default is today's `calc(space-9 * 4)`.
- **Focus ring:** solve it against `bg-raised` by construction, through `generateRamp`'s `ringBackgrounds` in `generateTheme.ts`.
- **Switch `[data-invalid]`:** done in 5c (`Switch.css.ts:147`, `Switch.test.tsx:144`). Record it as closed.

## Global Constraints

- Tier 3 tokens are declared with `tier3(name, fallback)` from `packages/react/src/theme/tier3.ts`. The name has no `--ap-` prefix (ADR-0007).
- Component styles live in `@layer components` (`componentsLayer`) and use logical properties.
- Visual baselines (gate 9) are Linux-only. Never regenerate them locally. Use the `update-visual-baselines` PR label (`.github/workflows/visual-baselines.yml`).
- Test files stay ASCII. Check with `grep -nP '[^\x00-\x7F]' <file>`.
- Every new assertion names its perturbation in a comment, as the existing stories do: what change makes it fail.
- Work on the branch `feat/design-follow-ups`. Land it through a PR, and CI must be green.

## Review Focus

1. **A brand seed off the sweep grid.** Every seed's ring must clear 3:1 on canvas, surface and raised, not only the 135 grid seeds. Task 1's construction test pins the mechanism rather than sampling seeds.
2. **A vertical underline list in RTL.** The inline end is physical left, so the hairline must move sides with `:dir(rtl)`, and the indicator must still cover it. Task 3 adds this case to the `RightToLeft` story.
3. **Forced colours.** `box-shadow` is forced to `none` there, so the inset hairline would vanish. Task 3 restores a real border under `(forced-colors: active)` and extends the existing e2e test.
4. **An overflowing, scrolled horizontal list.** The inset hairline does not scroll with the content, but the indicator does. The hairline must still span the visible list, and the indicator must cover it at any scroll position. Task 3's `Overflow` story assertion checks after scrolling.
5. **A product overriding the Tooltip cap.** Setting `--ap-tooltip-max-inline-size` must change the rendered cap, and leaving it unset must keep today's 4 × space-9. Task 2's story covers both.

## Verification Plan

| # | Check | Success signal |
|---|---|---|
| 1 | `npx vitest run packages/tokens/src/theme/generateTheme.test.ts` | The new construction test passes; it failed before Task 1. |
| 2 | `npm run test:gates` | All gates pass. If `gen:theme-css` changed `theme.css`, the freshness gate passes on the regenerated file. |
| 3 | `npx vitest run --project storybook packages/react/src/components/Tooltip packages/react/src/components/Tabs` | The new play assertions pass; each failed before its task. |
| 4 | `npm run test:hydration` | The forced-colours test also asserts the list hairline. |
| 5 | `npm test && npm run typecheck` | Green. |
| 6 | PR CI, then the `update-visual-baselines` label, then an empty commit | All CI jobs are green, and gate 9 passes against the new Tabs baselines. |

**Proof artifact:** the green PR CI run after the baseline update. In the bot's baseline commit, only `components-tabs--*` screenshots change, in both modes.

---

### Task 1: Solve the focus ring against canvas, surface and raised

The ring (brand step 8) is solved today against brand steps 1–2 and the status subtle fills. The surfaces it actually sits on are neutral steps 1–3 (`bg-canvas`, `bg-surface`, `bg-raised`, `semanticMap.ts:15-17`). The contrast gate checks all three pairings (`contrastReport.ts:40-43`), but they pass by luck: brand 1–2 have the same target lightness as neutral 1–2, and nothing solves against neutral 3. Canvas and surface go in alongside raised, since they have the same gap.

**Files:**
- Modify: `packages/tokens/src/theme/generateTheme.ts:43-58`
- Modify: `packages/tokens/src/emit/contrastReport.ts:42` (comment only)
- Test: `packages/tokens/src/theme/generateTheme.test.ts`

**Interfaces:**
- Consumes: `generateRamp(seed, mode, ringBackgrounds)` from `colour/ramp.ts`, and `deriveSeeds` from `colour/semantics.ts`.
- Produces: nothing new. `generateTheme`'s output shape does not change.

- [ ] **Step 1: Write the failing test** in `generateTheme.test.ts`

```ts
// The ring is solved against every surface it is drawn on, so a passing
// ring is guaranteed for any seed rather than observed on the sweep grid.
// Perturbation: dropping the neutral fills from `ringBackgrounds` fails this.
it('solves the brand focus ring against canvas, surface, raised and the status subtle fills', () => {
  for (const brand of ['#2e5fd9', '#d92e8a', '#8a6a00']) {
    const t = generateTheme({ brand })
    const seeds = { brand: hexToOklch(brand), ...deriveSeeds(hexToOklch(brand)) }
    for (const mode of ['light', 'dark'] as const) {
      const r = t.ramps[mode]
      const ringBgs = [
        ...[r.danger, r.warning, r.success, r.info].map((x) => x.steps[2]!.hex),
        ...[0, 1, 2].map((i) => r.neutral.steps[i]!.hex),
      ]
      expect(r.brand).toEqual(generateRamp(seeds.brand, mode, ringBgs))
    }
  }
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run packages/tokens/src/theme/generateTheme.test.ts`
Expected: FAIL for at least one seed or mode. If it passes for all three seeds, find a seed where brand step 8 differs once the neutral fills are added, and add it. The failure must be real, not vacuous.

- [ ] **Step 3: Implement.** In `modeRamps`, generate `neutral` before `brand`, and pass `[...subtleFills, ...neutral.steps.slice(0, 3).map((s) => s.hex)]` as the brand ramp's `ringBackgrounds`. Rewrite the comment above it to name all three neutral surfaces. Also rewrite the `ringBackgrounds` JSDoc in `ramp.ts:168-173` and the `contrastReport.ts:42` comment, so they say the ring is solved against these surfaces.

- [ ] **Step 4: Run the tokens tests and gates**

Run: `npx vitest run packages/tokens && npm run test:gates`
Expected: PASS. If the determinism snapshot or `theme.css` changed, run `npm run gen:theme-css`, and update the snapshot with `-u` only after checking that the only diffs are brand step-8 / `color-focus-ring` values. Note any changed values in the commit body.

- [ ] **Step 5: Commit**

```bash
git add packages/tokens packages/react/src/theme
git commit -m "fix(tokens): solve the focus ring against canvas, surface and raised by construction"
```

---

### Task 2: Tooltip `max-inline-size` as a Tier 3 token

**Files:**
- Modify: `packages/react/src/components/Tooltip/Tooltip.tokens.ts`
- Modify: `packages/react/src/components/Tooltip/Tooltip.css.ts:16-30`
- Test: `packages/react/src/components/Tooltip/Tooltip.stories.tsx` (new story `WidthCap`)

**Interfaces:**
- Produces: `TOOLTIP_TOKENS.maxInlineSize = tier3('tooltip-max-inline-size', \`calc(${vars.space['9']} * 4)\`)`. The custom property is `--ap-tooltip-max-inline-size`.

- [ ] **Step 1: Write the failing story `WidthCap`.** It renders an open tooltip (`defaultOpen`) with a label of at least 300 characters, so the cap binds.

Play assertions:
- Default: the popup's computed `max-inline-size` in px equals 4 × the computed value of `--ap-space-9` resolved in px. Measure it from a probe element styled `inline-size: var(--ap-space-9)`. The popup's `getBoundingClientRect().width` is ≤ that cap + 0.5.
- Override: set `document.documentElement.style.setProperty('--ap-tooltip-max-inline-size', '10rem')` and restore it in a `finally`. The popup's computed `max-inline-size` is `160px`, and its width is ≤ 160.5.
- Perturbation comment: with the hard-coded `calc` still in `Tooltip.css.ts`, the override half fails.

- [ ] **Step 2: Run it and confirm the override half fails**

Run: `npx vitest run --project storybook packages/react/src/components/Tooltip`
Expected: FAIL on the override assertion. The computed `max-inline-size` stays at 4 × space-9.

- [ ] **Step 3: Implement.** Add `maxInlineSize` to `TOOLTIP_TOKENS`, and add a JSDoc sentence that mirrors Popover's. Use `t.maxInlineSize` in `tooltipPopupClass`. Update that class's JSDoc: the cap's default is four of the largest space step, and a product can override it.

- [ ] **Step 4: Run the Tooltip stories and unit tests**

Run: `npx vitest run --project storybook packages/react/src/components/Tooltip && npx vitest run packages/react/src/components/Tooltip`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/components/Tooltip
git commit -m "feat(tooltip): make the width cap a Tier 3 token"
```

---

### Task 3: The Tabs underline indicator covers the list hairline

Today the hairline is the list's `border-block-end` (or `border-inline-end`), and the indicator sits at `inset-block-end: 0`, which is the padding edge, so it lands 1px inside the border. A negative inset cannot reach the border: a horizontal list is a scroll container (`overflowX: 'auto'`), and it clips at its padding box.

The fix draws the hairline inside the padding box, as an inset `box-shadow` on the list. The indicator is a positioned descendant, so it paints over the list's own shadow and covers the hairline under the selected tab. Under forced colours, `box-shadow` is forced to `none`, so there the list keeps a real border (today's `LIST_BORDER`), and the indicator sits beside it as it does today.

**Files:**
- Modify: `packages/react/src/components/Tabs/Tabs.css.ts` (`LIST_BORDER`, the `tabsListRecipe` compound variants, and their JSDoc)
- Modify: `packages/react/src/components/Tabs/Tabs.tokens.ts` (the `listBorder` JSDoc: "under" now means "covered by the indicator")
- Test: `packages/react/src/components/Tabs/Tabs.stories.tsx` (`Default`, `Vertical`, `RightToLeft`, `Overflow`)
- Test: `fixtures/ssr-app/e2e/disclosure.spec.ts` (forced-colours test)

**Interfaces:**
- Consumes: `TABS_TOKENS.listBorder` and `TABS_TOKENS.indicatorThickness`, both unchanged.
- Produces: no API change. The list's computed `border-*-width` is `0px` outside forced colours.

- [ ] **Step 1: Write the failing assertions**

Add a helper next to `expectInlineAligned`:

```ts
/** The underline sits on the list's own edge, over the hairline, within 0.5 px. */
const expectCoversHairline = (indicator: HTMLElement, list: HTMLElement, edge: 'bottom' | 'left' | 'right') => {
  expect(Math.abs(indicator.getBoundingClientRect()[edge] - list.getBoundingClientRect()[edge])).toBeLessThanOrEqual(0.5)
  expect(getComputedStyle(list).boxShadow).not.toBe('none')
}
```

- `Default`: after selection, `expectCoversHairline(indicator, list, 'bottom')`. Perturbation: restoring `borderBlockEnd` leaves a 1px gap.
- `Vertical`: replace the `i.right - l.right ≤ 2` check and its "inside the list's 1 px border" comment with `expectCoversHairline(indicator, list, 'right')`.
- `RightToLeft`: add a vertical underline list (`orientation="vertical"`, `aria-label="Vertical project"`) to the render, and a step asserting `expectCoversHairline(indicator, list, 'left')`. Perturbation: dropping the `:dir(rtl)` shadow puts the hairline on the right.
- `Overflow`: after the existing scroll to the last tab, assert `expectCoversHairline(indicator, list, 'bottom')`.
- `disclosure.spec.ts`, forced-colours test: under `forcedColors: 'active'`, the `Employee sections` list's computed `border-block-end-width` is > 0. After `forcedColors: 'none'` it is `0px`. Perturbation: dropping the forced-colours border leaves no hairline in High Contrast.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run --project storybook packages/react/src/components/Tabs`
Expected: `Default`, `Vertical`, `RightToLeft` and `Overflow` FAIL with a 1px edge gap, or with `boxShadow` being `none`.

- [ ] **Step 3: Implement in `Tabs.css.ts`.** Replace `LIST_BORDER` in the two underline compound variants:
  - horizontal: `boxShadow: inset 0 -1px 0 ${t.listBorder}`;
  - vertical: `boxShadow: inset -1px 0 0 ${t.listBorder}`, with `selectors: { '&:dir(rtl)': { boxShadow: inset 1px 0 0 ${t.listBorder} } }`;
  - each one gets `'@media': { '(forced-colors: active)': { borderBlockEnd | borderInlineEnd: LIST_BORDER } }`. Reuse the existing `FORCED_COLORS` constant by moving it above `tabsListRecipe`.

  Rewrite the `LIST_BORDER` JSDoc to say why: the scroll container clips at the padding box, the indicator paints over the inset shadow, and forced colours drop shadows.

- [ ] **Step 4: Run the Tabs stories, unit tests and the fixture e2e**

Run: `npx vitest run --project storybook packages/react/src/components/Tabs && npx vitest run packages/react/src/components/Tabs && npm run test:hydration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/components/Tabs fixtures/ssr-app/e2e/disclosure.spec.ts
git commit -m "fix(tabs): the underline indicator covers the list hairline"
```

---

### Task 4: Close out, PR and baselines

**Files:**
- Modify: `docs/superpowers/plans/2026-10-10-phase5h-gates.md` (Still open)
- Modify: `docs/superpowers/specs/2026-09-04-phase5-remaining-components-design.md` §6.3.4 (Still deferred)
- Modify: this plan (retrospective)

- [ ] **Step 1: Mark the deferred items resolved.** In both lists, annotate each closed item in place with the commit that closed it: the focus ring, underline vs hairline, Switch `[data-invalid]` ("done in 5c; `Switch.css.ts` `&[data-invalid]`"), and the Tooltip width cap. Do not delete the lines. The date-only ISO default was closed by the Temporal work (`f1f1d17`), so annotate it too.

- [ ] **Step 2: Full local check**

Run: `npm test && npm run test:gates && npm run typecheck && npm run test:stories`
Expected: all PASS.

- [ ] **Step 3: Append a retrospective** to this plan: what shipped, what was found, and what is still open. Then commit.

- [ ] **Step 4: Push, open the PR, and get baselines**

```bash
git push -u origin feat/design-follow-ups
gh pr create --title "fix: design follow-ups (focus ring, Tooltip cap, Tabs hairline)" --body "<summary, link to this plan, the verification table with results>"
gh pr edit --add-label update-visual-baselines
```

Then pull the bot's baseline commit and push an empty commit to re-run CI (`docs/CONTRIBUTING.md`, gate 9).
Expected: the bot commit changes only `components-tabs--*.png` in both modes, and all CI jobs are green. Any other screenshot changing means Task 1 moved a ring colour that is visible in a story. Explain it in the PR before merging.

## Retrospective

### What shipped
- **Focus ring.** `generateTheme` hands the brand ramp the neutral surfaces (canvas, surface, raised) as well as the status subtle fills, so step 8 is solved against every surface it is drawn on. No theme value changed.
- **Tooltip.** The width cap is the Tier 3 token `--ap-tooltip-max-inline-size`. Its default is still `calc(space-9 * 4)`.
- **Tabs.** The underline list's hairline is an inset `box-shadow`, and the indicator paints over it. Under forced colours the list keeps a real border.
- **Closed:** Switch `[data-invalid]` (done in 5c), and the date-only ISO default (done by the Temporal work). The Phase 5 deferred lists are annotated.

### Found while building
- **Task 1's planned test was vacuous.** The equality test passed before the change. A scan of 2,520 seeds (72 hues × 7 lightnesses × 5 chromas) found no ring that the neutral fills would move. The tightest was `#80ff88` in light mode, at 3.017:1 on `bg-raised`, so the pairing really was passing by a thin margin. The test is now a passthrough `vi.mock` of `generateRamp` that asserts what the brand ramp is solved against (`generateTheme.ring.test.ts`).
- **The computed `box-shadow` serialises colour first and `inset` last.** The RTL assertion matches `' 1px 0px 0px 0px inset'`.
- **Line endings.** Python on Windows writes CRLF in text mode, and git normalised it on commit. Later edits used `newline=''`.

### Still open
- Gate 9 baselines for `components-tabs--*` are regenerated on the PR, not locally.
- The Phase 6 docs-tooling minors and the parked 5h CI minors, as before.
