# Phase 5b — Textarea, Checkbox, Switch, RadioGroup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four form controls — `Textarea`, `Checkbox`, `Switch`, and `RadioGroup` + `Radio` — each wired into `Field` with ARIA derived rather than hand-passed, and each submitting uncontrolled before hydration.

**Architecture:** Thin styled wrappers over `@base-ui/react@1.7.0`, following the pattern `Input` and `Field` already established: a Tier 3 token file, a vanilla-extract recipe in the `ap.components` cascade layer, a `forwardRef` component that omits and re-declares `className`, and a story whose `play` asserts the contract. Three of the four render a `<span>` plus a sibling hidden native input, which is what carries their value into a form post; `Textarea` is `Field.Control` with a native `<textarea>` render element, because Base UI has no textarea.

**Tech Stack:** React 19.2, `@base-ui/react` 1.7.0, vanilla-extract, Vitest 4.1.11 (two projects: node and browser), Storybook 10.6, Playwright 1.62.1.

**Spec:** `docs/superpowers/specs/2026-09-04-phase5-remaining-components-design.md` — §4.1 (the nine shared decisions, which bind every task here) and §4.2 (this plan's scope).

## Global Constraints

- **Node 22.22.0** in CI. `engines.node` is `>=22.22.0`.
- **`'use client'` is the literal first line** of every `.ts`/`.tsx` under `packages/react/src`, except `index.ts` barrels, `*.css.ts`, and files named in the `use-client` gate's `TS_EXEMPTIONS`. **Every new `*.tokens.ts` must be added to that exemption list with a reason**, or the gate fails on the first run.
- **Relative imports carry `.js`**, even from a `.tsx` file. The package is `NodeNext`.
- **Every style declaration sits inside `'@layer': { [componentsLayer]: { … } }`**, with `componentsLayer` imported from `../../theme/layers.css.js`. The style gate walks the AST and rejects any other top-level key.
- **No physical CSS properties.** Use `paddingInlineStart`, `marginBlockEnd`, `insetInlineStart` and so on. The gate bans `marginLeft`, `textAlign: 'left'`, bare `left:`, and four-value shorthands of `padding`/`margin`/`inset`/`border*`.
- **No Tier 1 tokens** (`--ap-brand-9` and friends), no literal `zIndex`, no `outline: none`, no `boxShadow` inside a `:focus-visible` block.
- **Tier 3 tokens are `tier3('<component>-<role>', <Tier 2 fallback>)`**, never a `--` prefix, and the fallback is a `vars.*` leaf.
- **Every user-facing string comes from the message registry.** The gate scans `aria-label`, `title`, `placeholder`, `alt`, `label`, `hint`, `error` and all JSX text.
- **`exactOptionalPropertyTypes` is on, and Base UI's prop merge lets an explicit `undefined` win.** Spread optional props conditionally: `{...(x !== undefined ? { x } : {})}`. Never `prop={undefined}`.
- **No dependency may be added.** Everything needed is installed.
- **Never run any snapshot-update flag.**
- **Conventional commit prefixes.** Commit after every task.

## Base UI facts established before writing this plan

These were verified in `node_modules/@base-ui/react` source, not inferred. Each one changes what a task must do.

| Fact | Consequence |
|---|---|
| `Checkbox.Root`, `Switch.Root` and `Radio.Root` render a `<span role="…">` plus a sibling hidden `<input>`, and default `nativeButton` to **false** | Spec §4.1.2's decision not to expose `render` means there is nothing to derive. Do **not** reuse `Button`'s `deriveNativeButton`: its `render === undefined → true` branch is wrong here, because with no `render` these parts are spans, not buttons. |
| **`readOnly` never reaches the DOM** on Checkbox or Switch. Base UI enforces it only by calling `preventDefault` inside React's `onChange` | ADR-0011 §6.5's guarantee that a pending control stays submittable does **not** hold for these two before hydration. This is why neither gets a `loading` prop in this plan. Task 7 records the trap. |
| `Radio.Root` **has no `name` prop**; `name` comes only from `RadioGroup` context, and outside a group `checked` is computed against `''` so nothing posts | `Radio` is never usable standalone. The convenience component is the supported entry point. |
| `RadioGroup` **registers no control id**. `Field.Label`'s `htmlFor` would resolve to a generated id that is on no element | A `Field.Label` beside a `RadioGroup` emits a `<label for>` pointing at nothing and clicking it does nothing. Group labelling must come from `Fieldset.Legend`. |
| `Fieldset.Legend` renders a **`<div>`, not a `<legend>`**, and registers into the fieldset context, not the labelable context `Field` uses | The association is `aria-labelledby` only. Correct, but assert it that way rather than looking for a `<legend>` element. |
| **`Field.Item` wraps its subtree in a fresh labelable provider.** Without one, every control in a single `Field.Root` resolves to the *same* generated id | Duplicate DOM ids on every hidden input. One `Field.Item` per radio option is not stylistic; it is the fix for a real id collision. |
| `Checkbox.Indicator` and `Radio.Indicator` **unmount when unchecked** unless `keepMounted` | A CSS rule on `:not([data-checked])` on the indicator can never match by default. Style the unchecked state on the root. |
| `Field.Root`'s `name` **silently overrides** the control's own | Do not pass `name` in both places in tests or stories; it reads as working while one value is ignored. |
| Base UI has **no textarea export** at all, and `Field.Control`'s props are typed for `'input'` | `rows`, `cols` and `wrap` are invisible to the type system. `Textarea` re-declares the ones it supports. |
| `Field.Control`'s Enter-to-commit is **gated on `tagName === 'INPUT'`** | Enter in a textarea correctly inserts a newline and never commits validation. Blur is the only commit path. |

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/react/src/components/Textarea/Textarea.tokens.ts` | Tier 3 surface; reuses Input's roles where the two share a look |
| `packages/react/src/components/Textarea/Textarea.css.ts` | Recipe with `size` and `resize` variants |
| `packages/react/src/components/Textarea/Textarea.tsx` | `Field.Control` with a native `<textarea>` render element, textarea props re-declared |
| `packages/react/src/components/Textarea/{index.ts,Textarea.test.tsx,Textarea.ssr.test.tsx,Textarea.stories.tsx}` | Barrel, unit, SSR, story |
| `packages/react/src/components/Checkbox/*` | Same seven files; adds `indeterminate` |
| `packages/react/src/components/Switch/*` | Same seven files; thumb motion is a CSS transition on `[data-checked]` |
| `packages/react/src/components/RadioGroup/*` | Same seven files plus `RadioGroupParts.tsx` — it is compound |
| `packages/react/src/gates/use-client.gate.test.ts` | Four new `TS_EXEMPTIONS` entries, one per tokens file |
| `packages/react/src/index.ts` | Exports for all four, value then type, in the established order |
| `showcase/app/sections.ts` + `showcase/app/routes/form-controls.tsx` | One SSR smoke section covering all four |
| `fixtures/ssr-app/app/routes/form.tsx` | Grows the four controls, so pre-hydration submit is asserted against a real action |
| `packages/react/src/gates/ssr-render.gate.test.ts` | Assertions for the new fields in the fixture's form post |
| `docs/CONTRIBUTING.md` | The read-only trap, and the `Field.Item` id-collision rule |

---

### Task 1: `Textarea`

**Files:**
- Create: `packages/react/src/components/Textarea/Textarea.tokens.ts`, `Textarea.css.ts`, `Textarea.tsx`, `index.ts`, `Textarea.test.tsx`, `Textarea.ssr.test.tsx`
- Modify: `packages/react/src/gates/use-client.gate.test.ts`, `packages/react/src/index.ts`

**Interfaces:**
- Consumes: `Field.Control` from `packages/react/src/components/Field/FieldParts.js`; `tier3` from `../../theme/tier3.js`; `componentsLayer` from `../../theme/layers.css.js`; `vars` from `../../theme/contract.css.js`.
- Produces: `Textarea`, `TEXTAREA_TOKENS`, `type TextareaProps` with `size?: 'sm' | 'md' | 'lg'`, `resize?: 'none' | 'vertical'`, `rows?: number`, `className?: string`. Later tasks do not depend on it.

- [ ] **Step 1: Read the model you are copying**

Read these four in full before writing anything. They are the pattern, and deviating from them is a review finding:
- `packages/react/src/components/Input/Input.tokens.ts`
- `packages/react/src/components/Input/Input.css.ts`
- `packages/react/src/components/Input/Input.tsx`
- `packages/react/src/components/Input/Input.test.tsx`

- [ ] **Step 2: Write the failing unit test**

Create `packages/react/src/components/Textarea/Textarea.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Field } from '../Field/Field.js'
import { Textarea } from './Textarea.js'
import { textareaRecipe } from './Textarea.css.js'

describe('Textarea', () => {
  it('renders a real textarea, not an input', () => {
    render(<Textarea aria-label="Notes" />)
    const el = screen.getByRole('textbox', { name: 'Notes' })
    expect(el.tagName).toBe('TEXTAREA')
  })

  it('applies the recipe class for its size and resize', () => {
    render(<Textarea aria-label="Notes" size="lg" resize="none" />)
    expect(screen.getByRole('textbox').className).toBe(
      textareaRecipe({ size: 'lg', resize: 'none' }),
    )
  })

  it('forwards rows to the element, which Field.Control does not type', () => {
    render(<Textarea aria-label="Notes" rows={7} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '7')
  })

  it('takes its label and description from Field without hand-passed ids', () => {
    render(
      <Field label="Notes" hint="Markdown is supported.">
        <Textarea />
      </Field>,
    )
    const el = screen.getByRole('textbox', { name: 'Notes' })
    const ids = el.getAttribute('aria-describedby')!.split(' ').filter(Boolean)
    expect(ids.map((id) => document.getElementById(id)!.textContent)).toContain(
      'Markdown is supported.',
    )
  })

  it('submits its value uncontrolled', () => {
    const seen = vi.fn()
    const { container } = render(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          seen(new FormData(e.currentTarget).get('notes'))
        }}
      >
        <Textarea name="notes" defaultValue="hello" aria-label="Notes" />
      </form>,
    )
    fireEvent.submit(container.querySelector('form')!)
    expect(seen).toHaveBeenCalledWith('hello')
  })

  it('merges a consumer className rather than replacing the recipe', () => {
    render(<Textarea aria-label="Notes" className="mine" />)
    const cls = screen.getByRole('textbox').className
    expect(cls).toContain('mine')
    expect(cls).toContain(textareaRecipe({ size: 'md', resize: 'vertical' }).split(' ')[0])
  })
})
```

- [ ] **Step 3: Run it and watch it fail for the right reason**

Run: `npx vitest run --project unit packages/react/src/components/Textarea`
Expected: FAIL, unable to resolve `./Textarea.js`. A different error means the test file itself is wrong.

- [ ] **Step 4: Write the tokens**

Create `packages/react/src/components/Textarea/Textarea.tokens.ts`. No `'use client'` — it goes in the gate's exemption list instead.

```ts
import { vars } from '../../theme/contract.css.js'
import { tier3 } from '../../theme/tier3.js'

/**
 * A textarea is an Input that grew a second dimension, so it borrows Input's
 * Tier 2 roles deliberately rather than inventing parallel ones: a product
 * that retints its inputs should not have to retint its textareas separately.
 * The two token sets stay distinct so either can be overridden alone.
 */
export const TEXTAREA_TOKENS = {
  bg: tier3('textarea-bg', vars.color.bgSurface),
  text: tier3('textarea-text', vars.color.textPrimary),
  placeholder: tier3('textarea-placeholder', vars.color.textSecondary),
  border: tier3('textarea-border', vars.color.borderNormal),
  borderHover: tier3('textarea-border-hover', vars.color.borderInteractive),
  borderInvalid: tier3('textarea-border-invalid', vars.color.dangerBg),
  radius: tier3('textarea-radius', vars.radius.md),
  focusRing: tier3('textarea-focus-ring', vars.color.borderInteractive),
} as const
```

- [ ] **Step 5: Add the tokens file to the use-client exemption list**

In `packages/react/src/gates/use-client.gate.test.ts`, add to `TS_EXEMPTIONS`, matching the existing entries' shape:

```ts
{
  path: 'components/Textarea/Textarea.tokens.ts',
  why: 'Tier 3 token declarations — a plain object of strings, no React, no client behaviour.',
},
```

- [ ] **Step 6: Write the recipe**

Create `packages/react/src/components/Textarea/Textarea.css.ts`, keying every state off Base UI's own `data-*` attributes.

```ts
import { recipe } from '@vanilla-extract/recipes'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { TEXTAREA_TOKENS as t } from './Textarea.tokens.js'

export const textareaRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        display: 'block',
        inlineSize: '100%',
        fontFamily: vars.font.body,
        color: t.text,
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: t.radius,
        paddingBlock: vars.space['2'],
        paddingInline: vars.space['3'],
        '::placeholder': { color: t.placeholder },
        ':hover': { borderColor: t.borderHover },
        ':focus-visible': { outline: `2px solid ${t.focusRing}`, outlineOffset: '1px' },
        // Base UI's own attributes. Never invent our own state hooks.
        '&[data-invalid]': { borderColor: t.borderInvalid },
        '&[data-disabled]': { opacity: 0.6, cursor: 'not-allowed' },
      },
    },
  },
  variants: {
    size: {
      sm: { '@layer': { [componentsLayer]: { fontSize: vars.text.sm.size, lineHeight: vars.text.sm.lineHeight } } },
      md: { '@layer': { [componentsLayer]: { fontSize: vars.text.md.size, lineHeight: vars.text.md.lineHeight } } },
      lg: { '@layer': { [componentsLayer]: { fontSize: vars.text.lg.size, lineHeight: vars.text.lg.lineHeight } } },
    },
    resize: {
      none: { '@layer': { [componentsLayer]: { resize: 'none' } } },
      vertical: { '@layer': { [componentsLayer]: { resize: 'vertical' } } },
    },
  },
  defaultVariants: { size: 'md', resize: 'vertical' },
})
```

Check `vars.text.sm` really has `size` and `lineHeight` keys by reading `packages/react/src/theme/contract.css.ts` before you rely on it.

- [ ] **Step 7: Write the component**

Create `packages/react/src/components/Textarea/Textarea.tsx`:

```tsx
'use client'
import { forwardRef } from 'react'
import type { Ref, TextareaHTMLAttributes } from 'react'
import { FieldControl } from '../Field/FieldParts.js'
import type { FieldControlProps } from '../Field/FieldParts.js'
import { textareaRecipe } from './Textarea.css.js'
import { TEXTAREA_TOKENS } from './Textarea.tokens.js'

export { TEXTAREA_TOKENS }

/**
 * Base UI has no Textarea, so this is `Field.Control` rendering a native
 * <textarea>. That works at runtime — Base UI's control reads
 * `event.currentTarget.value` and its Enter-to-commit path is gated on the
 * tag being an INPUT, so Enter inserts a newline here as it should, and blur
 * is the only validation commit path.
 *
 * The type surface is the part that needs work: FieldControlProps is typed for
 * 'input', so `rows`, `cols` and `wrap` are invisible. The supported ones are
 * re-declared below and pushed onto the render element.
 */
type TextareaOnlyProps = Pick<TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows' | 'cols' | 'wrap'>

export interface TextareaProps
  extends Omit<FieldControlProps, 'className' | 'render' | 'type' | 'size'>,
    TextareaOnlyProps {
  /** Control text size. Not the legacy character-count attribute. */
  size?: 'sm' | 'md' | 'lg'
  /**
   * `vertical` by default. Horizontal resizing is not offered: it breaks the
   * form's column grid, and `both` is the browser default we are overriding.
   * Auto-growing is deliberately out of scope for v1 — it needs measurement
   * on every keystroke.
   */
  resize?: 'none' | 'vertical'
  className?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { size = 'md', resize = 'vertical', rows, cols, wrap, className, ...rest },
  ref,
) {
  return (
    <FieldControl
      {...rest}
      ref={ref as Ref<HTMLElement>}
      className={[textareaRecipe({ size, resize }), className].filter(Boolean).join(' ')}
      render={
        <textarea
          {...(rows !== undefined ? { rows } : {})}
          {...(cols !== undefined ? { cols } : {})}
          {...(wrap !== undefined ? { wrap } : {})}
        />
      }
    />
  )
})
```

- [ ] **Step 8: Write the barrel**

Create `packages/react/src/components/Textarea/index.ts`:

```ts
export { Textarea, TEXTAREA_TOKENS } from './Textarea.js'
export type { TextareaProps } from './Textarea.js'
```

- [ ] **Step 9: Run the unit test to green**

Run: `npx vitest run --project unit packages/react/src/components/Textarea`
Expected: PASS, six tests.

- [ ] **Step 10: Write the SSR test**

Create `packages/react/src/components/Textarea/Textarea.ssr.test.tsx`. Read `packages/react/src/components/Input/Input.ssr.test.tsx` first and match it.

```tsx
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Textarea } from './Textarea.js'

describe('Textarea under SSR', () => {
  it('runs with no DOM at all', () => {
    expect(typeof window).toBe('undefined')
  })

  it('server-renders a textarea carrying its name and default value', () => {
    const html = renderToString(<Textarea name="notes" defaultValue="hello" aria-label="Notes" />)
    expect(html).toContain('<textarea')
    expect(html).toContain('name="notes"')
    // A textarea's value is its child text, not an attribute.
    expect(html).toContain('hello')
    expect(html).not.toContain('<input')
  })

  it('server-renders rows, which the control does not type', () => {
    const html = renderToString(<Textarea rows={7} aria-label="Notes" />)
    expect(html).toContain('rows="7"')
  })
})
```

- [ ] **Step 11: Export it from the package**

In `packages/react/src/index.ts`, add in the position the existing grouping implies:

```ts
export { Textarea, TEXTAREA_TOKENS } from './components/Textarea/index.js'
export type { TextareaProps } from './components/Textarea/index.js'
```

- [ ] **Step 12: Run the full unit suite and the guards**

```bash
npm test
npm run test:guards
npm run typecheck
```

Expected: all pass. The unit test count rises by more than your six tests, because a gate emits two sub-tests per source file it walks — that is expected. If `test:guards` fails on `use-client`, Step 5 is missing or misspelt.

- [ ] **Step 13: Commit**

```bash
git add packages/react/src/components/Textarea packages/react/src/gates/use-client.gate.test.ts packages/react/src/index.ts
git commit -m "feat(react): Textarea over Field.Control with a native textarea

Base UI has no Textarea. Field.Control with render={<textarea />} works at
runtime — the control reads currentTarget.value, and its Enter-to-commit path
is gated on tagName === 'INPUT', so Enter inserts a newline and blur is the
only validation commit. The type surface is what needed work: FieldControlProps
is typed for 'input', so rows/cols/wrap are invisible and are re-declared.

Scope is rows and resize (none | vertical). No auto-grow: it needs measurement
on every keystroke, which is a layout-effect question this phase has no reason
to answer. No horizontal resize: it breaks the form's column grid."
```

---

### Task 2: `Checkbox`

**Files:**
- Create: `packages/react/src/components/Checkbox/Checkbox.tokens.ts`, `Checkbox.css.ts`, `Checkbox.tsx`, `index.ts`, `Checkbox.test.tsx`, `Checkbox.ssr.test.tsx`
- Modify: `packages/react/src/gates/use-client.gate.test.ts`, `packages/react/src/index.ts`

**Interfaces:**
- Consumes: `Checkbox` namespace from `@base-ui/react/checkbox`; `Icon` from `../../icons/Icon.js`; the same theme imports as Task 1.
- Produces: `Checkbox`, `CHECKBOX_TOKENS`, `type CheckboxProps` with `size?: 'sm' | 'md' | 'lg'`, `label: string`, `indeterminate?: boolean`, `className?: string`.

- [ ] **Step 1: Write the failing unit test**

Create `packages/react/src/components/Checkbox/Checkbox.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox } from './Checkbox.js'

describe('Checkbox', () => {
  it('exposes the checkbox role with its label as the accessible name', () => {
    render(<Checkbox label="Email me" />)
    expect(screen.getByRole('checkbox', { name: 'Email me' })).toBeTruthy()
  })

  it('renders a real hidden input, which is what a form posts', () => {
    const { container } = render(<Checkbox label="Email me" name="email" value="yes" />)
    const input = container.querySelector('input[type="checkbox"]')!
    expect(input).toBeTruthy()
    expect(input).toHaveAttribute('name', 'email')
    expect(input).toHaveAttribute('value', 'yes')
  })

  it('reports indeterminate as mixed rather than as a third checked value', () => {
    render(<Checkbox label="All" indeterminate />)
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed')
  })

  it('submits uncontrolled when checked by default', () => {
    const seen = vi.fn()
    const { container } = render(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          seen(new FormData(e.currentTarget).get('email'))
        }}
      >
        <Checkbox label="Email me" name="email" value="yes" defaultChecked />
      </form>,
    )
    fireEvent.submit(container.querySelector('form')!)
    expect(seen).toHaveBeenCalledWith('yes')
  })

  it('toggles on click and reports the new state', () => {
    render(<Checkbox label="Email me" />)
    const box = screen.getByRole('checkbox')
    expect(box).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(box)
    expect(box).toHaveAttribute('aria-checked', 'true')
  })

  it('shows a check glyph rather than relying on colour alone', () => {
    const { container } = render(<Checkbox label="Email me" defaultChecked />)
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project unit packages/react/src/components/Checkbox`
Expected: FAIL, cannot resolve `./Checkbox.js`.

- [ ] **Step 3: Write the tokens**

Create `Checkbox.tokens.ts` with roles for `bg`, `bgChecked`, `border`, `borderChecked`, `glyph`, `radius` and `focusRing`, each `tier3('checkbox-<role>', <Tier 2 fallback>)`. Use `vars.color.actionBg` for the checked background and `vars.color.actionText` for the glyph, so the checked state inherits the action role rather than a hardcoded blue. Add the file to `TS_EXEMPTIONS` in the same step, with the same wording as Task 1's.

- [ ] **Step 4: Write the recipe**

Create `Checkbox.css.ts` with a `size` variant driving the box's `inlineSize`/`blockSize` from `vars.icon`, and states keyed on Base UI's attributes: `&[data-checked]`, `&[data-indeterminate]`, `&[data-disabled]`, `&[data-invalid]`, `:focus-visible`.

**Style the unchecked state on the root, not the indicator.** `Checkbox.Indicator` unmounts when unchecked unless `keepMounted`, so a rule on the indicator's `:not([data-checked])` can never match.

Export a second `style()` for the indicator wrapper so the glyph can be centred.

- [ ] **Step 5: Write the component**

Create `Checkbox.tsx`. Points that carry the design:

- `label` is a **required prop**, and the accessible name comes from it. A checkbox with no name is the single most common accessibility failure and the type system should make it unreachable.
- Wrap in a `<label>` so the text is clickable, with the `Checkbox.Root` and the text as siblings inside it.
- Render `<Icon name="check" />` inside `Checkbox.Indicator`, and `<Icon name="chevron-down" />` is **not** the indeterminate glyph — use a CSS bar drawn on the indicator, or add a `minus` icon to `paths.ts` in this step if you prefer a glyph. Whichever you choose, the indeterminate state must be visible without colour, per ADR-0011 §5. Record which you chose and why in your report.
- **Do not expose `render`**, per spec §4.1.2. That also means there is nothing to derive for `nativeButton`; leave it at Base UI's default.
- The label text is a consumer-supplied string, so it does not come from the message registry. Nothing else in this component has user-facing copy.

- [ ] **Step 6: Run to green, then write the SSR test**

Run the unit test to green. Then create `Checkbox.ssr.test.tsx` asserting: no `window`; the hidden input is present in server HTML with its `name` and `value`; `checked` appears when `defaultChecked` is set; and `aria-checked="mixed"` appears when `indeterminate` is set.

**Do not assert `input.indeterminate`** — Base UI sets that imperatively in a layout effect, so it is absent from server HTML by design. Add a comment saying so, because its absence looks like a bug.

- [ ] **Step 7: Export, run everything, commit**

Add the exports to `packages/react/src/index.ts`. Run `npm test && npm run test:guards && npm run typecheck`. Commit with a `feat(react):` prefix whose message records that `label` is required by design and that the indeterminate glyph is not colour alone.

---

### Task 3: `Switch`

**Files:**
- Create: the same seven files under `packages/react/src/components/Switch/`
- Modify: `packages/react/src/gates/use-client.gate.test.ts`, `packages/react/src/index.ts`

**Interfaces:**
- Consumes: `Switch` namespace from `@base-ui/react/switch`.
- Produces: `Switch`, `SWITCH_TOKENS`, `type SwitchProps` with `size?: 'sm' | 'md' | 'lg'`, `label: string`, `className?: string`.

- [ ] **Step 1: Write the failing unit test**

Cover: the `switch` role with `label` as its accessible name; `aria-checked` is `'true'`/`'false'` and **never** `'mixed'` (a switch has no third state); the hidden input carries `name` and `value`; uncontrolled submit with `defaultChecked`; clicking toggles; and the thumb element exists and carries `data-checked` when on.

Run it and confirm it fails before writing the component.

- [ ] **Step 2: Tokens, recipe, component**

Tokens: `trackBg`, `trackBgChecked`, `thumbBg`, `radius`, `focusRing`. Add to `TS_EXEMPTIONS`.

Recipe: a track with `borderRadius: vars.radius.full`, a `size` variant setting track and thumb dimensions from the space scale, and the thumb positioned with `insetInlineStart` — **never `left`**, which the style gate bans.

**The thumb's motion is a CSS transition on `[data-checked]`, not an animation.** Verified in Base UI's source: `Switch.Thumb` has no transition-status attributes, so there is nothing for `@ap/motion`'s enter/exit motions to hook. Use a duration token for the transition, and add a comment recording why this component is the one exception to reaching for `@ap/motion` — there is no discrete enter or exit, only a position that changes.

Component: same shape as Checkbox. `label` required, wrapped in a `<label>`, no `render`.

- [ ] **Step 3: SSR test, export, run everything, commit**

The SSR test asserts the hidden input, `name`, `value`, and that `role="switch"` with `aria-checked` is in the server HTML. Then export, run `npm test && npm run test:guards && npm run typecheck`, and commit.

---

### Task 4: `RadioGroup` + `Radio`

This is the only compound component in the plan, and the only one whose labelling cannot use `Field.Label`.

**Files:**
- Create: `packages/react/src/components/RadioGroup/RadioGroup.tokens.ts`, `RadioGroup.css.ts`, `RadioGroupParts.tsx`, `RadioGroup.tsx`, `index.ts`, `RadioGroup.test.tsx`, `RadioGroupParts.test.tsx`, `RadioGroup.ssr.test.tsx`
- Modify: `packages/react/src/gates/use-client.gate.test.ts`, `packages/react/src/index.ts`

**Interfaces:**
- Consumes: `RadioGroup` from `@base-ui/react/radio-group`, `Radio` from `@base-ui/react/radio`, `Fieldset` from `@base-ui/react/fieldset`, `Field` from `@base-ui/react/field`.
- Produces: `RadioGroup` (with `.Root`, `.Item` statics), `RADIO_GROUP_TOKENS`, `type RadioGroupProps` with `label: string`, `name: string`, `options: ReadonlyArray<{ value: string; label: string; hint?: string }>`, `defaultValue?: string`, `size?: 'sm' | 'md' | 'lg'`, `className?: string`.

- [ ] **Step 1: Read the compound precedent**

Read `packages/react/src/components/Field/FieldParts.tsx` and `Field.tsx` in full. `Field` is the repository's model for a convenience component built *on* compound parts, per ADR-0011 §2, and `RadioGroup` must follow it: the parts are exported and usable, and the convenience component is assembled only from them.

- [ ] **Step 2: Write the failing unit test**

Create `RadioGroup.test.tsx` covering these, each of which encodes a fact established from Base UI's source:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RadioGroup } from './RadioGroup.js'

const OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'Text message' },
  { value: 'none', label: 'Do not contact me' },
] as const

describe('RadioGroup', () => {
  it('exposes a radiogroup named by its label', () => {
    render(<RadioGroup label="How should we reach you?" name="contact" options={OPTIONS} />)
    expect(screen.getByRole('radiogroup', { name: 'How should we reach you?' })).toBeTruthy()
  })

  it('renders one radio per option, each named by its own label', () => {
    render(<RadioGroup label="Contact" name="contact" options={OPTIONS} />)
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: 'Text message' })).toBeTruthy()
  })

  it('gives every option a distinct id, which one Field.Item per option is what buys', () => {
    // Without a Field.Item wrapper per option, every hidden input resolves to
    // the same generated id from the shared labelable provider — duplicate DOM
    // ids across the whole group. This is the assertion that catches it.
    const { container } = render(<RadioGroup label="Contact" name="contact" options={OPTIONS} />)
    const ids = [...container.querySelectorAll('input[type="radio"]')].map((el) => el.id)
    expect(ids.filter(Boolean)).toHaveLength(3)
    expect(new Set(ids)).toHaveProperty('size', 3)
  })

  it('posts the selected value under the group name', () => {
    const seen = vi.fn()
    const { container } = render(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          seen(new FormData(e.currentTarget).get('contact'))
        }}
      >
        <RadioGroup label="Contact" name="contact" options={OPTIONS} defaultValue="sms" />
      </form>,
    )
    fireEvent.submit(container.querySelector('form')!)
    expect(seen).toHaveBeenCalledWith('sms')
  })

  it('moves selection with the arrow keys', () => {
    render(<RadioGroup label="Contact" name="contact" options={OPTIONS} defaultValue="email" />)
    const first = screen.getByRole('radio', { name: 'Email' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(screen.getByRole('radio', { name: 'Text message' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('renders an option hint as a description of that option alone', () => {
    render(
      <RadioGroup
        label="Contact"
        name="contact"
        options={[{ value: 'sms', label: 'Text message', hint: 'Standard rates apply.' }]}
      />,
    )
    const radio = screen.getByRole('radio', { name: 'Text message' })
    const ids = radio.getAttribute('aria-describedby')!.split(' ').filter(Boolean)
    expect(ids.map((id) => document.getElementById(id)!.textContent)).toContain(
      'Standard rates apply.',
    )
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run --project unit packages/react/src/components/RadioGroup`
Expected: FAIL, cannot resolve.

- [ ] **Step 4: Write the parts**

Create `RadioGroupParts.tsx` exporting styled wrappers over Base UI's parts, each omitting and re-declaring `className`: `RadioGroupRoot`, `RadioGroupItem` (a `Field.Item` wrapping a `<label>`, a `Radio.Root` with its `Radio.Indicator`, the option text, and an optional `Field.Description`).

**The `Field.Item` wrapper is load-bearing, not decorative.** It creates a fresh labelable provider per option, which is what gives each hidden input its own id and each hint its own description scope. Put that reasoning in a comment above it, because a reader will otherwise see a redundant div and remove it.

- [ ] **Step 5: Write the convenience component**

Create `RadioGroup.tsx`, assembled only from the parts.

**Labelling comes from `Fieldset.Legend`, not `Field.Label`.** Base UI's radio group registers no control id, so a `Field.Label` beside it emits a `<label for>` pointing at a generated id that is on no element — clicking it would do nothing. Wrap the group in `Fieldset.Root` and render the `label` prop through `Fieldset.Legend`. Note in a comment that the legend renders a `<div>`, not a `<legend>`, and the association is `aria-labelledby`; assert it that way rather than looking for a `<legend>` element.

Attach the parts as statics (`RadioGroup.Root`, `RadioGroup.Item`) the way `Field` does, so a consumer who needs custom option markup has the same escape hatch.

- [ ] **Step 6: Parts test, SSR test, export, commit**

Create `RadioGroupParts.test.tsx` asserting each part merges `className`, forwards its ref, and carries Base UI's `data-*` attributes — mirror `FieldParts.test.tsx`.

Create `RadioGroup.ssr.test.tsx` asserting the server HTML contains three radio inputs, the group name on each, `checked` on the one matching `defaultValue`, and `role="radiogroup"` with an `aria-labelledby` that resolves to the legend's id.

Then export from `packages/react/src/index.ts` — value, then every part type in one braced block, as `Field`'s exports do. Run `npm test && npm run test:guards && npm run typecheck` and commit.

---

### Task 5: Stories for all four

**Files:**
- Create: `Textarea.stories.tsx`, `Checkbox.stories.tsx`, `Switch.stories.tsx`, `RadioGroup.stories.tsx`, each beside its component

**Interfaces:**
- Consumes: the four components. Every story is already wrapped in `ApProvider` by `storybook/.storybook/preview.tsx`.
- Produces: story ids `components-<name>--<story>`.

- [ ] **Step 1: Read the existing stories**

Read `packages/react/src/components/Input/Input.stories.tsx` and `Field/Field.stories.tsx`. Match their shape: `satisfies Meta<typeof X>`, `argTypes` with a control for every union prop, one story per meaningful state, and a grid story rather than one story per cross-product combination.

- [ ] **Step 2: Write the four story files**

For each component: a default story, a story per size or a single grid covering all sizes, the disabled state, the invalid state inside a `Field`, and a `play` function asserting the contract rather than that rendering happened.

The `play` functions must assert these specifically:
- **Textarea**: typing a newline stays in the field and does not submit its form. This is the concrete payoff of Base UI gating Enter-to-commit on `INPUT`.
- **Checkbox**: `aria-checked` goes `false` → `true` on click, and `mixed` when `indeterminate`.
- **Switch**: `aria-checked` toggles, and is never `mixed`.
- **RadioGroup**: arrow-key navigation moves the selection, and each option's accessible name is its own label.

**Accessibility checking genuinely fails a run on any violation** — that was proven repeatedly in the previous plan. If a story fails on an axe violation, that is a real finding about the component. Fix the component or the story; do not add a story-level parameter override to silence it. If you believe the component is at fault, stop and report it.

- [ ] **Step 3: Run the story suite and commit**

```bash
npm run test:stories
npm --prefix storybook run typecheck
```

Expected: PASS, with the file count up by four. Commit with a `test(storybook):` prefix.

---

### Task 6: SSR fixture and the showcase

**Files:**
- Modify: `fixtures/ssr-app/app/routes/form.tsx`, `packages/react/src/gates/ssr-render.gate.test.ts`, `showcase/app/sections.ts`
- Create: `showcase/app/routes/form-controls.tsx`

**Interfaces:**
- Consumes: all four components.
- Produces: a `form-controls` showcase section, and gate 6 assertions for the four new fields.

- [ ] **Step 1: Read what the fixture already proves**

Read `fixtures/ssr-app/app/routes/form.tsx` and the parts of `packages/react/src/gates/ssr-render.gate.test.ts` that exercise it. It has an `action` that echoes the submitted value and renders with `noValidate`, so only server validation decides — that is the progressive-enhancement proof, and your four controls join it.

- [ ] **Step 2: Add the four controls to the fixture form**

Give each a `name` and a `defaultValue` or `defaultChecked` so a pre-hydration post carries a known value. **Do not also set `name` on a wrapping `Field`** — Base UI lets the field's `name` silently override the control's, which reads as working while one value is ignored.

- [ ] **Step 3: Assert the pre-hydration post in the gate**

Extend `ssr-render.gate.test.ts` so the form post asserts all four values arrive at the action. This is gate 6's real guarantee for this plan: these controls submit without JavaScript.

- [ ] **Step 4: Add the showcase section**

Add one `SECTIONS` entry (`{ slug: 'form-controls', title: 'Form controls', file: 'routes/form-controls.tsx', blurb: … }`) and create the route. **Renders only, no prose** — the showcase's job is SSR smoke and Storybook owns the gallery. Read `showcase/app/routes/spinner.tsx` for the current minimal shape.

- [ ] **Step 5: Run everything and commit**

```bash
npm run test:ssr && npm run test:spa
npm --prefix showcase run typecheck && npm run showcase:test
```

Expected: pass, with the showcase smoke count up by one section.

---

### Task 7: Documentation

**Files:**
- Modify: `docs/CONTRIBUTING.md`

**Interfaces:** none.

- [ ] **Step 1: Record the two traps found while writing this plan**

Both were verified in Base UI's source and both will bite someone later. Add them to the section of `docs/CONTRIBUTING.md` that already collects Base UI traps — search for "Base UI" to find it.

**The read-only trap.** Base UI does not put `readOnly` on the hidden input of `Checkbox` or `Switch`; it enforces read-only only by calling `preventDefault` inside React's `onChange`. So before hydration a read-only checkbox is fully toggleable and posts its new value. State plainly that ADR-0011 §6.5's guarantee — a pending control stays submittable and refuses edits — **does not hold for these two controls pre-hydration**, and that this is why neither has a `loading` prop. Name the source file so the next person can re-check it against a new Base UI version.

**The `Field.Item` id-collision rule.** Without one `Field.Item` per option, every control inside a single `Field.Root` resolves to the same generated id from the shared labelable provider, producing duplicate DOM ids across the group. Say that the wrapper looks redundant and is not, and point at the test that catches it.

- [ ] **Step 2: Update "adding a component" if this plan taught it anything**

Read the existing steps. If anything in this plan was needed and is not listed — the tokens-file exemption in the `use-client` gate is the likely candidate — add it.

- [ ] **Step 3: Verify and commit**

Run `npm run typecheck` to confirm nothing executable changed, and commit with a `docs:` prefix.

---

### Task 8: CI and the full sweep

**Files:** none expected. This task is verification.

- [ ] **Step 1: Run every suite locally**

```bash
npm run typecheck
npm test
npm run test:stories
npm run test:gates
npm run test:ssr && npm run test:spa && npm run test:consumer
npm --prefix showcase run typecheck && npm run showcase:test
npm --prefix storybook run typecheck && npm --prefix storybook run build
```

Record the real numbers for each.

- [ ] **Step 2: Push and open a pull request**

Push the branch and open a pull request against `main` titled `Phase 5b: Textarea, Checkbox, Switch, RadioGroup`. The body should say what shipped, name the two Base UI traps this plan documented, and state which contracts are asserted where — unit tests for DOM and ARIA wiring, `play` functions for behaviour in a browser, gate 6 for pre-hydration submission.

- [ ] **Step 3: Watch CI to green**

Six jobs. If any fails, diagnose from the logs and fix it. Report the result of every job.

---

## Verification plan

Ordered; each is a command whose output is the evidence. Success signals name the perturbation that must make the check fail.

| # | Claim | Command | Success signal |
|---|---|---|---|
| 1 | `Textarea` is a real textarea, not a styled input | `npm test` | `tagName === 'TEXTAREA'`. Perturb by dropping the `render` prop → must fail with an `<input>` |
| 2 | Textarea props the control does not type still reach the element | `npm test` | `rows="7"` present. Perturb by removing the conditional spread → attribute disappears |
| 3 | Every control's ARIA is derived, not hand-passed | `npm test` | Each `aria-describedby` resolves to a real element's text, with no `id` written by us |
| 4 | Indeterminate is `mixed`, not a third checked value | `npm test` | `aria-checked="mixed"`. Perturb by passing `checked` instead → must fail |
| 5 | A switch never reports `mixed` | `npm test` | Only `'true'`/`'false'` |
| 6 | Every radio option has a distinct id | `npm test` | Three ids, three unique. **Perturb by removing the `Field.Item` wrapper → must fail with duplicates.** This is the assertion that justifies the wrapper |
| 7 | Arrow keys move radio selection | `npm test` and `play` | Selection follows focus |
| 8 | All four submit uncontrolled, before hydration | `test:ssr` | The fixture's action receives all four values from a JavaScript-blocked post |
| 9 | All four server-render their form-carrying input | `npm test` | Each `.ssr.test.tsx` finds the element and its `name` in the string |
| 10 | Enter in a textarea inserts a newline rather than submitting | `play` | The value gains a newline and the form does not submit |
| 11 | Zero axe violations across every new story | `test:stories` | Passes. Perturb by removing a `label` prop → must fail naming that story |
| 12 | No state is expressed by colour alone | `npm test` | Checked and indeterminate both render a glyph |
| 13 | Every gate still green | `npm run test:gates` | Pass. A missing tokens-file exemption fails `use-client`; a physical CSS property fails `style-rules` |
| 14 | SPA build renders every component | `test:spa` | Same app with `ssr: false` |

**Final proof artifact:** a green CI run on the Phase 5b pull request, six jobs, plus `npm run typecheck && npm test && npm run test:stories && npm run test:gates && npm run test:ssr && npm run test:consumer` green locally.

---

## What actually happened

*(Written during execution. Record deviations, unfalsifiable checks, harness bugs, and anything the plan got wrong.)*
