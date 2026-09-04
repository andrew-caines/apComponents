# Phase 4b — Tier 2 interaction tokens and Button: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `Button` — the component that proves recipe variants and `render` passthrough — and, first, close the Tier 2 gaps that building it exposed.

**Architecture:** `Button` wraps `@base-ui/react/button`, adds a vanilla-extract recipe in `@layer ap.components`, and reads Tier 3 tokens that fall back to Tier 2. Its `render` prop is Base UI's element-passthrough mechanism, which is how routing integration works without `@ap/react` depending on any router. Before any of that, `@ap/tokens` gains the interaction roles a button actually needs, and loses a naming asymmetry that would have misled every future consumer.

**Tech Stack:** `@base-ui/react@1.7.0`, vanilla-extract recipes, React 19.2.8, Vitest + Testing Library, TypeScript ESM.

**Spec:** `docs/superpowers/specs/2026-09-02-phase4-vertical-slice-design.md` (§6.1)

## Why this plan starts in `@ap/tokens`

Designing `Button`'s variants surfaced three Tier 2 problems. All three are cheapest to fix now: **no `@ap/react` component consumes `color-action-text` today** — only `@ap/tokens`' own map and tests — so the blast radius is one package plus regeneration. After Phase 5's fifteen components it is a breaking change to a published contract (ADR-0007).

1. **A naming asymmetry that inverts meaning.** `color-action-text` is the *on-solid* role (text drawn **on** the action background). But `color-danger-text` is danger-coloured text drawn **on canvas**, and `color-danger-on-solid` is its on-solid counterpart. Same `-text` suffix, opposite meanings, in one contract.
2. **No hover for any status ramp.** `color-action-bg-hover` exists; `color-danger-bg-hover` does not. A destructive button cannot express hover from tokens.
3. **No subtle brand surface.** Every status ramp has `${name}-bg-subtle` (step 3); brand has none, so a ghost or outline action button has no token for its hover surface.

## Global Constraints

- **Tier 1 ramps stay unreachable from components.** Components read Tier 3, which falls back to Tier 2. (ADR-0007.)
- **Every new Tier 2 colour role gets a contrast pairing**, and the contrast gate must pass in both modes. (ADR-0008.)
- **Generated artifacts are committed and guarded by freshness gates.** Never hand-edit `theme.css` or `contract.css.ts`; regenerate.
- **Component CSS emits into `@layer ap.components`** via `theme/layers.css.ts`. (ADR-0016.)
- **`@base-ui/react` pinned to exactly `1.7.0`**; never import a Base UI date part.
- **No browser globals at module scope or during render**; every component module carries `'use client'`.
- **No hardcoded user-facing strings** — the gate scans all of `src/`.
- **`@ap/react` takes no dependency on `react-router`.** `render` is the routing mechanism. (ADR-0001, ADR-0011.)
- **`exactOptionalPropertyTypes: true`** — expect conditional spreads; never weaken a type to compile.
- Node ≥ 22.22.0, React ≥ 19.2.7, ESM only.

---

### Task 1: Tier 2 interaction roles and the on-solid rename

**Files:**
- Modify: `packages/tokens/src/theme/semanticMap.ts`, `packages/tokens/src/emit/contrastReport.ts`, `packages/tokens/src/theme/generateTheme.test.ts`, `packages/tokens/src/emit/contrastReport.test.ts`
- Regenerate: `packages/react/src/theme/theme.css`, `packages/react/src/theme/contract.css.ts`

**Interfaces:**
- Consumes: `SEMANTIC_MAP`, `s(token, ramp, step)`, `PAIRINGS`.
- Produces these Tier 2 roles, which Task 2 reads through Tier 3:
  `color-action-on-solid`, `color-action-text`, `color-action-bg-subtle`,
  and `color-{danger,warning,success,info}-bg-hover`.

- [ ] **Step 1: Read the current map and pairings**

Read `packages/tokens/src/theme/semanticMap.ts` and `packages/tokens/src/emit/contrastReport.ts` in full before editing. Both are short, generative, and the status-ramp `flatMap` is the pattern the new roles must mirror exactly.

- [ ] **Step 2: Rename the brand on-solid role and add the missing brand roles**

In `semanticMap.ts`, replace the single line

```ts
  s('color-action-text', 'brand', 'onSolid'),
```

with

```ts
  // `-on-solid` is text drawn ON the solid background; `-text` is the ramp's
  // colour used AS text on a neutral surface. The status ramps below have
  // always drawn that line; brand previously used `-text` for the on-solid
  // role, which meant the same suffix carried opposite meanings depending on
  // the ramp. Renamed here, while no component consumes it yet.
  s('color-action-on-solid', 'brand', 'onSolid'),
  s('color-action-text', 'brand', 11),
  s('color-action-bg-subtle', 'brand', 3),
```

- [ ] **Step 3: Give every status ramp a hover, mirroring brand**

In the same file's `flatMap`, add one entry so the status ramps match brand's step-9 → step-10 hover relationship:

```ts
    s(`color-${name}-bg-hover`, name, 10),
```

- [ ] **Step 4: Run the tokens tests and watch them fail**

```bash
npx vitest run packages/tokens/src
```

Expected: failures naming `color-action-text` — `generateTheme.test.ts` asserts it resolves to the on-solid value, and `contrastReport.test.ts` asserts pairings that reference it. These are the tests telling you the rename is real. Do not delete them; retarget them in the next step.

- [ ] **Step 5: Retarget the existing assertions and add pairings**

In `generateTheme.test.ts`, the assertion that `color-action-text` resolves to the brand ramp's on-solid value now describes `color-action-on-solid` — rename it there.

In `contrastReport.ts`, update the two existing brand pairings and add the new ones:

```ts
  ['color-action-on-solid', 'color-action-bg', 4.5],
  // Ruling F guarantees the hover step moves away from the on-solid text
  // colour, so text on hover is never less legible than text on the solid.
  ['color-action-on-solid', 'color-action-bg-hover', 4.5],
  // The ghost/outline path: brand-coloured text on the neutral surfaces it
  // can appear on, and on its own subtle hover surface.
  ['color-action-text', 'color-bg-canvas', 4.5],
  ['color-action-text', 'color-bg-surface', 4.5],
  ['color-action-text', 'color-action-bg-subtle', 4.5],
```

and inside the status `flatMap`, add the hover pairing mirroring brand's:

```ts
      [`color-${name}-on-solid`, `color-${name}-bg-hover`, 4.5],
```

In `contrastReport.test.ts`, update the two references to `color-action-text` on `color-action-bg` / `color-action-bg-hover` to `color-action-on-solid`, keeping each assertion's intent.

- [ ] **Step 6: Run the tokens tests and the contrast gate**

```bash
npx vitest run packages/tokens/src
npm run test:contrast
```

Expected: PASS. If a new pairing fails contrast, **stop and report it** — that is a real finding about the ramp, not something to work around by lowering a threshold or dropping the pairing.

- [ ] **Step 7: Prove the new pairings are actually gated**

Temporarily change one new role's step in `semanticMap.ts` to a value that cannot meet contrast — e.g. `s('color-action-text', 'brand', 5)` — and run `npm run test:contrast`. Expected: FAIL naming `color-action-text`. Revert and re-run; expected PASS. Report the failure text. A pairing that cannot fail is not gating anything.

- [ ] **Step 8: Regenerate the artifacts**

```bash
npm run gen:theme-css
npm run gen:theme-contract
npm run report:contrast
```

Then confirm the freshness gates agree:

```bash
npm run test:freshness
npm run test:contract
```

- [ ] **Step 9: Full verification and commit**

```bash
npm test && npm run typecheck && npm run test:gates
git add -A
git commit -m "feat(tokens): symmetric on-solid naming, brand text/subtle roles, status hovers"
```

---

### Task 2: Button's Tier 3 tokens and recipe

**Files:**
- Create: `packages/react/src/components/Button/Button.tokens.ts`, `packages/react/src/components/Button/Button.css.ts`

**Interfaces:**
- Consumes: the Tier 2 roles from Task 1, via `vars` from `theme/contract.css.js`; `tier3()`; `componentsLayer`.
- Produces: `BUTTON_TOKENS`, `buttonRecipe({ variant, size, tone })` where
  `variant: 'solid' | 'outline' | 'ghost'`, `size: 'sm' | 'md' | 'lg'`, `tone: 'action' | 'danger'`.

**Design note:** read `packages/react/src/components/Surface/Surface.tokens.ts` and `Surface.css.ts` first — they are the pattern. Every declaration goes inside `'@layer': { [componentsLayer]: { … } }`; a declaration outside it ships unlayered and inverts ADR-0016.

- [ ] **Step 1: Write the Tier 3 tokens**

`packages/react/src/components/Button/Button.tokens.ts`:

```ts
import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for Button. Each falls back to a Tier 2 semantic value, so a
 * product can restyle just this component by setting the Tier 3 custom
 * property, or restyle every component by overriding Tier 2 (ADR-0007).
 */
export const BUTTON_TOKENS = {
  actionBg: tier3('button-action-bg', vars.color.actionBg),
  actionBgHover: tier3('button-action-bg-hover', vars.color.actionBgHover),
  actionOnSolid: tier3('button-action-on-solid', vars.color.actionOnSolid),
  actionText: tier3('button-action-text', vars.color.actionText),
  actionSubtle: tier3('button-action-subtle', vars.color.actionBgSubtle),
  dangerBg: tier3('button-danger-bg', vars.color.dangerBg),
  dangerBgHover: tier3('button-danger-bg-hover', vars.color.dangerBgHover),
  dangerOnSolid: tier3('button-danger-on-solid', vars.color.dangerOnSolid),
  dangerText: tier3('button-danger-text', vars.color.dangerText),
  dangerSubtle: tier3('button-danger-subtle', vars.color.dangerBgSubtle),
  border: tier3('button-border', vars.color.borderInteractive),
  radius: tier3('button-radius', vars.radius.md),
  focusRing: tier3('button-focus-ring', vars.color.focusRing),
} as const
```

- [ ] **Step 2: Write the recipe**

`packages/react/src/components/Button/Button.css.ts`. Use `Surface.css.ts`'s shape. Requirements, each of which a later step tests:

- `base` sets `boxSizing`, `display: 'inline-flex'`, `alignItems: 'center'`, `justifyContent: 'center'`, `gap: vars.space['2']`, the body font, `borderRadius: t.radius`, `borderStyle: 'solid'`, `borderWidth: '1px'`, `cursor: 'pointer'`, and `textDecoration: 'none'` (it matters once `render` makes it an `<a>`).
- A `:focus-visible` selector applies the focus ring using `vars.focusRingWidth`, `vars.focusRingOffset` and `t.focusRing`. **Use `outline`, never `boxShadow`** — the style-rules gate enforces this, and an outline survives forced-colors mode.
- `&[data-disabled]` sets `cursor: 'default'` and reduced opacity. Base UI sets that attribute; do not invent your own.
- `size` variants `sm` / `md` / `lg` differ in `paddingInline`, `paddingBlock`, `fontSize` and `lineHeight`, taken from `vars.space.*` and `vars.text.*`.
- `variant` × `tone` is expressed with `compoundVariants`, not by flattening six names — the tone selects the colour set and the variant selects how it is applied:
  - `solid`: background from the tone's `Bg`, text from its `OnSolid`, hover background from its `BgHover`, transparent border.
  - `outline`: transparent background, text from the tone's `Text`, border from `t.border`, hover background from the tone's `Subtle`.
  - `ghost`: transparent background and border, text from the tone's `Text`, hover background from the tone's `Subtle`.
- `defaultVariants: { variant: 'solid', size: 'md', tone: 'action' }`.

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck && npm test && npm run test:gates
git add -A
git commit -m "feat(react): Button Tier 3 tokens and recipe"
```

---

### Task 3: The `Button` component and its tests

**Files:**
- Create: `packages/react/src/components/Button/Button.tsx`, `Button.test.tsx`, `Button.ssr.test.tsx`, `index.ts`
- Modify: `packages/react/src/index.ts`

**Interfaces:**
- Consumes: `buttonRecipe` (Task 2); `Button as BaseButton` from `@base-ui/react/button`.
- Produces:
  ```ts
  export interface ButtonProps extends Omit<BaseButtonProps, 'className'> {
    variant?: 'solid' | 'outline' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    tone?: 'action' | 'danger'
    className?: string
  }
  export const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLElement>>
  ```

**The `nativeButton` trap — read this before writing the component.** Base UI's `Button` accepts a `nativeButton` prop meaning "the element I render is a real `<button>`". It defaults to `true`. When a consumer passes `render={<a href="…" />}` or `render={<Link to="…" />}`, the rendered element is **not** a button, and leaving `nativeButton` at its default makes Base UI apply button semantics to an anchor — the wrong ARIA and the wrong keyboard behaviour.

Consumers must not have to know this. **Derive it:** when `render` is present and the element it renders is not a `<button>`, pass `nativeButton={false}`. A `render` element whose type is the string `'button'` keeps `nativeButton` true. When `render` is a function, we cannot inspect the result — default to `false` and document why, because an anchor wrongly treated as a button is worse than a button wrongly treated as a generic element.

- [ ] **Step 1: Write the failing tests**

`packages/react/src/components/Button/Button.test.tsx` (jsdom — add the `// @vitest-environment jsdom` docblock, matching `Surface.test.tsx`):

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './Button.js'

describe('Button', () => {
  it('renders a real <button> by default', () => {
    render(<Button>Save</Button>)
    const el = screen.getByRole('button', { name: 'Save' })
    expect(el.tagName).toBe('BUTTON')
  })

  it('applies recipe classes for the default variants', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button').className).not.toBe('')
  })

  it('merges className rather than replacing it', () => {
    render(<Button className="mine">Save</Button>)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('mine')
    expect(cls.trim().split(/\s+/).length).toBeGreaterThan(1)
  })

  it('gives different variants different classes', () => {
    const { rerender } = render(<Button variant="solid">A</Button>)
    const solid = screen.getByRole('button').className
    rerender(<Button variant="ghost">A</Button>)
    expect(screen.getByRole('button').className).not.toBe(solid)
  })

  it('gives different tones different classes', () => {
    const { rerender } = render(<Button tone="action">A</Button>)
    const action = screen.getByRole('button').className
    rerender(<Button tone="danger">A</Button>)
    expect(screen.getByRole('button').className).not.toBe(action)
  })

  // ADR-0011 §3: this is the whole routing story. A real <a href> means
  // middle-click, right-click-copy-link and browser history all work, none of
  // which a click handler on a <button> can reproduce.
  it('becomes a real anchor through render, keeping its classes', () => {
    render(
      <Button render={<a href="/employees/42" />} variant="ghost">
        View
      </Button>,
    )
    const el = screen.getByRole('link', { name: 'View' })
    expect(el.tagName).toBe('A')
    expect(el.getAttribute('href')).toBe('/employees/42')
    expect(el.className).not.toBe('')
  })

  it('does not tell Base UI an anchor is a native button', () => {
    // If nativeButton stayed true for an <a>, Base UI would apply button
    // semantics to it. The observable consequence is a type/role mismatch:
    // a native button gets `type="button"`, an anchor must not.
    render(<Button render={<a href="/x" />}>View</Button>)
    expect(screen.getByRole('link').hasAttribute('type')).toBe(false)
  })

  it('keeps native button semantics when render is itself a button', () => {
    render(<Button render={<button data-x="1" />}>Save</Button>)
    const el = screen.getByRole('button', { name: 'Save' })
    expect(el.tagName).toBe('BUTTON')
    expect(el.getAttribute('data-x')).toBe('1')
  })

  it('forwards a ref to the rendered element', () => {
    let node: HTMLElement | null = null
    render(<Button ref={(n) => { node = n }}>Save</Button>)
    expect(node).not.toBeNull()
    expect(node!.tagName).toBe('BUTTON')
  })

  it('preserves Base UI state attributes for styling', () => {
    render(<Button disabled>Save</Button>)
    expect(screen.getByRole('button').hasAttribute('data-disabled')).toBe(true)
  })

  it('spreads unknown props onto the root element', () => {
    render(<Button data-testid="x" aria-describedby="hint">Save</Button>)
    const el = screen.getByTestId('x')
    expect(el.getAttribute('aria-describedby')).toBe('hint')
  })
})
```

`packages/react/src/components/Button/Button.ssr.test.tsx` — **no environment docblock**, so it runs under node:

```tsx
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Button } from './Button.js'

describe('Button renders on the server', () => {
  it('runs with no browser globals present', () => {
    // Asserted first: without it the rest of this file could be silently
    // passing under jsdom and proving nothing about SSR.
    expect(typeof window).toBe('undefined')
    const html = renderToString(<Button>Save</Button>)
    expect(html).toContain('<button')
    expect(html).toContain('Save')
  })

  it('renders an anchor through render on the server too', () => {
    const html = renderToString(<Button render={<a href="/x" />}>View</Button>)
    expect(html).toContain('<a')
    expect(html).toContain('href="/x"')
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run packages/react/src/components/Button
```

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the component**

`packages/react/src/components/Button/Button.tsx`. It must:

- start with `'use client'`
- wrap `Button` from `@base-ui/react/button`
- pass `className={[buttonRecipe({ variant, size, tone }), className].filter(Boolean).join(' ')}`
- derive `nativeButton` per the trap described above
- forward `ref` and spread every remaining prop
- carry a docblock explaining the `nativeButton` derivation, because the next reader will otherwise delete it as redundant

- [ ] **Step 4: Run the tests and watch them pass**

```bash
npx vitest run packages/react/src/components/Button
```

Expected: PASS, 13 tests.

- [ ] **Step 5: Barrel and export**

`packages/react/src/components/Button/index.ts`:

```ts
export { Button, BUTTON_TOKENS } from './Button.js'
export type { ButtonProps } from './Button.js'
```

Re-export `BUTTON_TOKENS` from `Button.tsx` (as `Surface` does) and add to `packages/react/src/index.ts`:

```ts
export { Button, BUTTON_TOKENS } from './components/Button/index.js'
export type { ButtonProps } from './components/Button/index.js'
```

- [ ] **Step 6: Full verification and commit**

```bash
npm test && npm run typecheck && npm run test:guards && npm run test:gates
git add -A
git commit -m "feat(react): Button with recipe variants and render passthrough"
```

---

### Task 4: Contributor documentation

**Files:**
- Modify: `docs/CONTRIBUTING.md`

- [ ] **Step 1: Document the two things a future contributor cannot infer**

Add to the "Rules the gates enforce" section (match the file's existing voice — it explains *why* a rule exists, not just what it is):

- **The `-text` / `-on-solid` distinction.** `color-<ramp>-on-solid` is text drawn **on** that ramp's solid background; `color-<ramp>-text` is that ramp's colour used **as** text on a neutral surface. Brand once used `-text` for the on-solid role, which made the same suffix mean opposite things depending on the ramp; it was renamed in Phase 4b while no component consumed it. Every new colour role needs a contrast pairing in `contrastReport.ts`, or it is ungated.
- **`nativeButton` and `render`.** Base UI's `Button` assumes it renders a real `<button>`. `render` can replace that element with an anchor, at which point button semantics are wrong. `Button` derives `nativeButton` from the render element so consumers never pass it — if you add another component wrapping a Base UI part that accepts `render`, check whether it has the same trap.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs: the -text/-on-solid distinction and the nativeButton trap"
```

---

## Verification for this plan

| # | Check | Command | Signal |
|---|---|---|---|
| 1 | New Tier 2 roles exist and are gated | `npm run test:contrast` | Passes; perturbing a new role's step fails naming it |
| 2 | Generated artifacts match their generators | `npm run test:freshness && npm run test:contract` | Both green after regeneration |
| 3 | Button renders a real button by default | `npm test` | `tagName === 'BUTTON'` |
| 4 | `render` yields a real anchor with classes intact | `npm test` | `<a href>` present, `className` non-empty |
| 5 | An anchor is not treated as a native button | `npm test` | No `type` attribute on the link |
| 6 | Recipe variants produce distinct classes | `npm test` | solid ≠ ghost, action ≠ danger |
| 7 | Base UI state attributes survive | `npm test` | `data-disabled` present when disabled |
| 8 | Button server-renders with no browser globals | `npx vitest run packages/react/src/components/Button/Button.ssr.test.tsx` | `typeof window === 'undefined'` asserted first, 2 passed |
| 9 | Nothing regressed | `npm test && npm run typecheck && npm run test:gates` | 554+ tests green, all Phase 1–4a gates passing |

**Proof artifact for 4b:** `npm run test:gates` green with the regenerated theme, plus `reports/contrast.md` showing every new pairing passing AA in both modes, plus `Button.ssr.test.tsx` passing under node.
