# Phase 4c — Field + Input: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `Input` and the `Field` compound family — the components that prove compound context, derived ARIA wiring, and uncontrolled-first forms — and prove the progressive-enhancement claim end to end in a real browser with JavaScript blocked.

**Architecture:** `Input` wraps `@base-ui/react/input`; `Field.Root/.Label/.Control/.Description/.Error` wrap `@base-ui/react/field`. Base UI already owns the id/`aria-describedby`/`aria-invalid` derivation through its `LabelableProvider` context — our wrappers add styling, Tier 3 tokens, and the one structural rule Base UI does not enforce: an error is an icon **and** text, never colour alone (ADR-0011 §5). The `Field` convenience component is assembled **only** from the public compound parts, and a test asserts the two produce identical DOM.

**Tech Stack:** `@base-ui/react@1.7.0`, vanilla-extract recipes + `style()`, React 19.2.8, Vitest + Testing Library, React Router 8.3.1 + Playwright 1.62.1 (fixture only), TypeScript ESM.

**Spec:** `docs/superpowers/specs/2026-09-02-phase4-vertical-slice-design.md` (§6.2, and §8 checks 5–9)

## Why the progressive-enhancement proof is in this plan, not 4e

Spec §8 check 9 ("Uncontrolled submit works before hydration") is the entire reason ADR-0011 §4 chose uncontrolled-first over controlled-first. It is a claim about `Input`, and it is cheapest to prove in the plan that introduces `Input` — a claim proved two plans after the code lands is a claim nobody was holding a gate over in between. Task 4 therefore builds it here. 4e still owns the SPA gate (`test:spa`), Storybook, and gates 4–5.

## Global Constraints

- **Tier 1 ramps stay unreachable from components.** Components read Tier 3, which falls back to Tier 2. (ADR-0007.) Enforced by `style-rules.gate.test.ts` over both `.css.ts` and `.tokens.ts`.
- **Component CSS emits into `@layer ap.components`** via `theme/layers.css.ts`, with every declaration inside the `'@layer': { [componentsLayer]: { … } }` wrapper. (ADR-0016.) A property written as a direct sibling of `base` fails the gate by path.
- **Focus rings use `outline`, never `boxShadow`** — outline survives forced-colors mode. Enforced by `style-rules.gate.test.ts`.
- **No physical CSS properties** — `paddingInline`/`paddingBlock`/`marginBlockStart`/`insetInlineStart`, never `paddingLeft`/`marginTop`/`left`. Enforced by `style-rules.gate.test.ts`.
- **No hardcoded user-facing strings** — the gate scans all of `src/` except `gates/`, flagging `aria-label`, `title`, `placeholder`, `alt`, `label`, and any `JsxText` containing a letter. Strings come from the message registry (`providers/messages.ts`).
- **Every shipped `.ts`/`.tsx` module carries `'use client'`**, except barrels, `.css.ts`, and the individually-named exemptions in `use-client.gate.test.ts`. **A new `.tokens.ts` file must be added to that file's `TS_EXEMPTIONS` list with its reason, or the gate fails.**
- **No browser globals at module scope or during render**; no `node:` imports, no `Date.now()`/`Math.random()` in runtime source. (`ssr-safety.gate.test.ts`.)
- **`@base-ui/react` pinned to exactly `1.7.0`**; never import a Base UI date part.
- **`@ap/react` takes no dependency on `react-router`.** (ADR-0001, ADR-0011 §3.)
- **`exactOptionalPropertyTypes: true`** — expect conditional spreads (`{...(cond ? { x: true } : {})}`); never weaken a type to compile.
- **`className` is merged, never replaced**; refs are forwarded; unknown props spread to the root element. (ADR-0011 §6.)
- Node ≥ 22.22.0, React ≥ 19.2.7, ESM only.

## Facts about `@base-ui/react@1.7.0`'s Field that this plan depends on

Verified by reading the installed package. An implementer should not re-derive these.

1. **`import { Field } from '@base-ui/react/field'`** yields a namespace: `Field.Root`, `Field.Label`, `Field.Control`, `Field.Description`, `Field.Error`, `Field.Validity`, `Field.Item`. Prop types are exported as named types from the same module: `FieldRootProps`, `FieldLabelProps`, `FieldControlProps`, `FieldDescriptionProps`, `FieldErrorProps`.
2. **ARIA wiring is Base UI's, not ours.** `internals/labelable-provider/LabelableProvider.mjs` owns `controlId`, `labelId` and a `messageIds` array. `Field.Description` and `Field.Error` each push their own id into `messageIds` from a layout effect; the control merges them into `aria-describedby`. `aria-invalid` comes from `field/root/useFieldValidation.mjs`. **Our wrappers must not compute or pass any of these.**
3. **`aria-describedby` is client-only by construction.** Because description/error ids register in a layout effect, `messageIds` is empty on the server pass and on the first client render. The attribute appears after mount. This is not a hydration mismatch (both passes agree), but it means **server HTML has no `aria-describedby`** — never assert one there. The label↔control association (`for`/`id`) *is* server-rendered, and is what the SSR test asserts.
4. **`Field.Error` renders its children over the validity message.** In `FieldError.mjs` the element props are `[{ id, children: errorMessage }, elementProps]`, and later entries win — so consumer `children` replace Base UI's message, and omitting children yields the native validity message. Our wrapper must preserve both behaviours.
5. **`Field.Error` renders nothing unless it matches.** With no `match` prop it renders only when `validityData.state.valid === false` (or a `Form` reports an error for the field's `name`). `match={true}` always renders — that is the hook for an externally supplied error string.
6. **`render` accepts a function.** `ComponentRenderFn<Props, State> = (props, state) => React.ReactElement<unknown>`, where `props` are the fully merged element props including the resolved `children`. This is how `Field.Error` gets an icon wrapped around whichever message won.
7. **`Base UI`'s `Input` is `Field.Control` with a nicer name** — it works inside `Field.Root` with no wiring, and standalone outside one.
8. **Base UI types Input's ref as `HTMLElement`** (`React.RefAttributes<HTMLElement>`), though the rendered element is genuinely an `<input>`.
9. **`data-invalid` / `data-valid` / `data-disabled` / `data-dirty` / `data-touched` / `data-filled` / `data-focused`** are the state attributes Base UI stamps (`internals/field-constants/constants.mjs`). Style against those, never against an attribute we invent.

## File structure

| File | Responsibility |
|---|---|
| `packages/react/src/components/Input/Input.tokens.ts` | Tier 3 token strings for Input, each falling back to a Tier 2 role |
| `packages/react/src/components/Input/Input.css.ts` | `inputRecipe` — one `size` variant group, all state styling via Base UI's `data-*` |
| `packages/react/src/components/Input/Input.tsx` | The component: size variant, className merge, ref forward |
| `packages/react/src/components/Input/Input.test.tsx` | Unit + interaction (jsdom) |
| `packages/react/src/components/Input/Input.ssr.test.tsx` | `renderToString` assertion, node environment |
| `packages/react/src/components/Input/index.ts` | Barrel |
| `packages/react/src/components/Field/Field.tokens.ts` | Tier 3 tokens for all Field parts |
| `packages/react/src/components/Field/Field.css.ts` | `fieldRootClass`, `fieldLabelClass`, `fieldDescriptionClass`, `fieldErrorClass`, `fieldErrorIconClass` |
| `packages/react/src/components/Field/FieldParts.tsx` | The five compound parts — the public compound API |
| `packages/react/src/components/Field/FieldParts.test.tsx` | ARIA derivation, icon-not-colour-alone, className merge |
| `packages/react/src/components/Field/Field.tsx` | The convenience component, assembled from the parts, plus the exported `Field` namespace |
| `packages/react/src/components/Field/Field.test.tsx` | Convenience behaviour **and** the compound-equivalence assertion |
| `packages/react/src/components/Field/Field.ssr.test.tsx` | `renderToString` assertion, node environment |
| `packages/react/src/components/Field/index.ts` | Barrel |
| `fixtures/ssr-app/app/routes/form.tsx` | RR8 route with an `action`, rendering `Field` + `Input` |
| `fixtures/ssr-app/e2e/progressive-enhancement.spec.ts` | Playwright: submit with client JS blocked, assert the action ran |

Modified: `packages/react/src/index.ts` (exports), `packages/react/src/gates/use-client.gate.test.ts` (two `.tokens.ts` exemptions), `fixtures/ssr-app/app/routes.ts` (route registration), `packages/react/src/gates/ssr-render.gate.test.ts` (server-HTML assertions for the new route).

---

### Task 1: `Input` — Tier 3 tokens, recipe, component

**Files:**
- Create: `packages/react/src/components/Input/Input.tokens.ts`
- Create: `packages/react/src/components/Input/Input.css.ts`
- Create: `packages/react/src/components/Input/Input.tsx`
- Create: `packages/react/src/components/Input/index.ts`
- Test: `packages/react/src/components/Input/Input.test.tsx`
- Test: `packages/react/src/components/Input/Input.ssr.test.tsx`
- Modify: `packages/react/src/gates/use-client.gate.test.ts` (add the `Input.tokens.ts` exemption)
- Modify: `packages/react/src/index.ts` (export `Input`, `INPUT_TOKENS`, `InputProps`)

**Interfaces:**
- Consumes: `tier3(name, fallback)` from `../../theme/tier3.js`; `vars` from `../../theme/contract.css.js`; `componentsLayer` from `../../theme/layers.css.js`.
- Produces:
  - `INPUT_TOKENS` — frozen-in-practice `as const` object of Tier 3 strings.
  - `inputRecipe({ size })` — `size: 'sm' | 'md' | 'lg'`, default `'md'`.
  - `Input` — `forwardRef<HTMLInputElement, InputProps>`.
  - `interface InputProps extends Omit<BaseInputNamespace.Props, 'className' | 'size'> { size?: 'sm' | 'md' | 'lg'; className?: string }`.

- [ ] **Step 1: Write the Tier 3 token module**

Create `packages/react/src/components/Input/Input.tokens.ts`:

```ts
import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for Input. Each falls back to a Tier 2 semantic value, so a
 * product can restyle just this component by setting the Tier 3 custom
 * property, or restyle every component by overriding Tier 2 (ADR-0007).
 *
 * `borderInvalid` is `dangerBorder` (ramp step 7) and not `dangerBg` (step 9):
 * step 7 is the gated border role, contrast-checked at 3:1 against the
 * surfaces, which is the ratio WCAG 1.4.11 asks of a non-text boundary.
 */
export const INPUT_TOKENS = {
  bg: tier3('input-bg', vars.color.bgSurface),
  text: tier3('input-text', vars.color.textPrimary),
  placeholder: tier3('input-placeholder', vars.color.textSecondary),
  border: tier3('input-border', vars.color.borderNormal),
  borderHover: tier3('input-border-hover', vars.color.borderInteractive),
  borderInvalid: tier3('input-border-invalid', vars.color.dangerBorder),
  radius: tier3('input-radius', vars.radius.md),
  focusRing: tier3('input-focus-ring', vars.color.focusRing),
} as const
```

- [ ] **Step 2: Register the new `.tokens.ts` with the use-client gate**

`use-client.gate.test.ts` requires every shipped `.ts` module to carry `'use client'` unless it is named in `TS_EXEMPTIONS`. Add this entry to that array, immediately after the existing `Button.tokens.ts` entry:

```ts
  {
    path: join(SRC, 'components', 'Input', 'Input.tokens.ts'),
    why: 'a frozen object of Tier 3 token strings, built with tier3() — pure data like Button.tokens.ts',
  },
```

- [ ] **Step 3: Run the guards to confirm the exemption is wired**

Run: `npm run test:guards`
Expected: PASS. (If `Input.tokens.ts` were left out of the exemption list, this fails naming the file — check that first if it goes red.)

- [ ] **Step 4: Write the recipe**

Create `packages/react/src/components/Input/Input.css.ts`:

```ts
import { recipe } from '@vanilla-extract/recipes'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { INPUT_TOKENS as t } from './Input.tokens.js'

export const inputRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        boxSizing: 'border-box',
        inlineSize: '100%',
        fontFamily: vars.font.body,
        color: t.text,
        background: t.bg,
        borderStyle: 'solid',
        borderWidth: '1px',
        borderColor: t.border,
        borderRadius: t.radius,
        selectors: {
          '&::placeholder': {
            color: t.placeholder,
            // Some engines apply a UA opacity to the placeholder; pin it so the
            // colour we contrast-checked is the colour that renders.
            opacity: 1,
          },
          '&:hover:not([data-disabled])': {
            borderColor: t.borderHover,
          },
          // Focus ring uses `outline`, never `boxShadow`: an outline survives
          // forced-colors mode (Windows High Contrast), where box-shadow is
          // dropped entirely. The style-rules gate enforces this.
          '&:focus-visible': {
            outlineWidth: vars.misc.focusRingWidth,
            outlineStyle: 'solid',
            outlineColor: t.focusRing,
            outlineOffset: vars.misc.focusRingOffset,
          },
          // `data-invalid` is Base UI's own state attribute (see
          // internals/field-constants/constants.mjs) — set by Field when the
          // control fails validation or the root is marked invalid. We never
          // invent an attribute of our own for this.
          '&[data-invalid]': {
            borderColor: t.borderInvalid,
          },
          '&[data-disabled]': {
            cursor: 'default',
            opacity: 0.6,
          },
        },
      },
    },
  },
  variants: {
    size: {
      sm: {
        '@layer': {
          [componentsLayer]: {
            paddingInline: vars.space['3'],
            paddingBlock: vars.space['1'],
            fontSize: vars.text.sm.size,
            lineHeight: vars.text.sm.lineHeight,
          },
        },
      },
      md: {
        '@layer': {
          [componentsLayer]: {
            paddingInline: vars.space['4'],
            paddingBlock: vars.space['2'],
            fontSize: vars.text.md.size,
            lineHeight: vars.text.md.lineHeight,
          },
        },
      },
      lg: {
        '@layer': {
          [componentsLayer]: {
            paddingInline: vars.space['5'],
            paddingBlock: vars.space['3'],
            fontSize: vars.text.lg.size,
            lineHeight: vars.text.lg.lineHeight,
          },
        },
      },
    },
  },
  defaultVariants: { size: 'md' },
})
```

- [ ] **Step 5: Write the failing unit tests**

Create `packages/react/src/components/Input/Input.test.tsx`:

```tsx
// @vitest-environment jsdom
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Input } from './Input.js'
import { inputRecipe } from './Input.css.js'

describe('Input', () => {
  it('renders a real <input>', () => {
    render(<Input aria-label="Email" />)
    const el = screen.getByRole('textbox', { name: 'Email' })
    expect(el.tagName).toBe('INPUT')
  })

  // Tied to the recipe's own output for the default size rather than a bare
  // "className is non-empty" check: a non-empty check passes for a class from
  // the wrong variant, so it could not catch a default being changed.
  it('applies the recipe class for the default size', () => {
    render(<Input aria-label="Email" />)
    expect(screen.getByRole('textbox').className).toBe(inputRecipe({ size: 'md' }))
  })

  it('merges className rather than replacing it', () => {
    render(<Input aria-label="Email" className="mine" />)
    const cls = screen.getByRole('textbox').className
    expect(cls).toContain('mine')
    expect(cls.trim().split(/\s+/).length).toBeGreaterThan(1)
  })

  it('gives different sizes different classes', () => {
    const { rerender } = render(<Input aria-label="Email" size="sm" />)
    const sm = screen.getByRole('textbox').className
    rerender(<Input aria-label="Email" size="lg" />)
    expect(screen.getByRole('textbox').className).not.toBe(sm)
  })

  // `size` on our API is a recipe variant, not the legacy HTML width-in-
  // characters attribute. Assert the attribute is NOT emitted: leaking
  // size="sm" onto the element would be invalid HTML and would silently
  // change the field's intrinsic width.
  it('does not leak the size variant onto the DOM as an attribute', () => {
    render(<Input aria-label="Email" size="lg" />)
    expect(screen.getByRole('textbox').hasAttribute('size')).toBe(false)
  })

  it('forwards a ref to the input element', () => {
    const ref = createRef<HTMLInputElement>()
    render(<Input aria-label="Email" ref={ref} />)
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe('INPUT')
  })

  it('spreads id, data-* and aria-* through to the element', () => {
    render(<Input aria-label="Email" id="email" data-testid="email-input" aria-describedby="hint" />)
    const el = screen.getByTestId('email-input')
    expect(el.id).toBe('email')
    expect(el.getAttribute('aria-describedby')).toBe('hint')
  })

  // The uncontrolled path is the one ADR-0011 §4 exists for: the value must
  // live in the DOM, so a native form submit carries it with no React state.
  it('submits its value from a native form with no React state (uncontrolled)', async () => {
    const user = userEvent.setup()
    const seen = vi.fn()
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          seen(new FormData(e.currentTarget).get('email'))
        }}
      >
        <Input aria-label="Email" name="email" defaultValue="a@b.c" />
        <button type="submit">Go</button>
      </form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(seen).toHaveBeenCalledWith('a@b.c')
  })

  it('reports changes through onValueChange when controlled', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Input aria-label="Email" value="" onValueChange={onValueChange} />)
    await user.type(screen.getByRole('textbox'), 'x')
    expect(onValueChange).toHaveBeenCalled()
    expect(onValueChange.mock.calls[0]?.[0]).toBe('x')
  })
})
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run packages/react/src/components/Input/Input.test.tsx`
Expected: FAIL — `Failed to resolve import "./Input.js"`.

- [ ] **Step 7: Write the component**

Create `packages/react/src/components/Input/Input.tsx`:

```tsx
'use client'

import { forwardRef, type Ref } from 'react'
import { Input as BaseInput } from '@base-ui/react/input'
import type { InputProps as BaseInputProps } from '@base-ui/react/input'
import { inputRecipe } from './Input.css.js'

export { INPUT_TOKENS } from './Input.tokens.js'

/**
 * `size` is omitted from Base UI's props and redeclared as a recipe variant.
 *
 * `<input>` has a legacy `size` attribute — an integer width in characters,
 * which is a physical-units sizing mechanism the type scale replaces. Keeping
 * both spellings would mean `size="sm"` and `size={20}` on one prop with
 * different meanings and different types. The variant wins the name because it
 * is the one a consumer of this library reaches for; a product that genuinely
 * wants the HTML attribute can still set it through `render`.
 */
export interface InputProps extends Omit<BaseInputProps, 'className' | 'size'> {
  /** Size. Defaults to `md`. */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', className, ...rest },
  ref,
) {
  return (
    <BaseInput
      {...rest}
      // Base UI types this ref as `Ref<HTMLElement>` even though the component
      // renders a real `<input>` — `Ref<HTMLInputElement>` is not assignable to
      // it, because a mutable ref is invariant in its element type. The cast is
      // in this one place so that consumers get the accurate `HTMLInputElement`
      // (they need `.value`, `.select()`, `.setSelectionRange()`), rather than
      // every call site having to widen or cast. The ref-forwarding test
      // asserts the runtime tagName is genuinely INPUT.
      ref={ref as Ref<HTMLElement>}
      className={[inputRecipe({ size }), className].filter(Boolean).join(' ')}
    />
  )
})
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run packages/react/src/components/Input/Input.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 9: Write the SSR assertion**

Create `packages/react/src/components/Input/Input.ssr.test.tsx`:

```tsx
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Input } from './Input.js'

describe('Input renders on the server', () => {
  it('runs with no browser globals present', () => {
    // Asserted first: without it the rest of this file could be silently
    // passing under jsdom and proving nothing about SSR.
    expect(typeof window).toBe('undefined')
    const html = renderToString(<Input name="email" defaultValue="a@b.c" aria-label="Email" />)
    expect(html).toContain('<input')
    expect(html).toContain('name="email"')
    // The value is in the markup, which is what makes a pre-hydration native
    // submit carry it (ADR-0011 §4).
    expect(html).toContain('value="a@b.c"')
  })

  it('does not emit the size variant as an HTML attribute on the server either', () => {
    const html = renderToString(<Input size="lg" aria-label="Email" />)
    expect(html).not.toContain('size="lg"')
  })
})
```

- [ ] **Step 10: Write the barrel and export from the package index**

Create `packages/react/src/components/Input/index.ts`:

```ts
export { Input, INPUT_TOKENS } from './Input.js'
export type { InputProps } from './Input.js'
```

Add to `packages/react/src/index.ts`, immediately after the two `Button` export lines:

```ts
export { Input, INPUT_TOKENS } from './components/Input/index.js'
export type { InputProps } from './components/Input/index.js'
```

- [ ] **Step 11: Run the full suite, the gates and typecheck**

Run: `npm test && npm run test:guards && npm run typecheck`
Expected: all PASS.

- [ ] **Step 12: Commit**

```bash
git add packages/react/src/components/Input packages/react/src/index.ts packages/react/src/gates/use-client.gate.test.ts
git commit -m "feat(react): Input with size variants and uncontrolled-first semantics"
```

---

### Task 2: `Field` compound parts

**Files:**
- Create: `packages/react/src/components/Field/Field.tokens.ts`
- Create: `packages/react/src/components/Field/Field.css.ts`
- Create: `packages/react/src/components/Field/FieldParts.tsx`
- Test: `packages/react/src/components/Field/FieldParts.test.tsx`
- Modify: `packages/react/src/gates/use-client.gate.test.ts` (add the `Field.tokens.ts` exemption)

**Interfaces:**
- Consumes: `tier3`, `vars`, `componentsLayer`; `Icon` from `../../icons/Icon.js`; `Input` from Task 1 (used in tests only).
- Produces, all from `./FieldParts.js`:
  - `FieldRoot` — `forwardRef<HTMLDivElement, FieldRootProps>`, `FieldRootProps = Omit<BaseFieldRootProps, 'className'> & { className?: string }`
  - `FieldLabel` — `forwardRef<HTMLLabelElement, FieldLabelProps>`
  - `FieldControl` — `forwardRef<HTMLInputElement, FieldControlProps>`
  - `FieldDescription` — `forwardRef<HTMLParagraphElement, FieldDescriptionProps>`
  - `FieldError` — `forwardRef<HTMLDivElement, FieldErrorProps>`, where `FieldErrorProps = Omit<BaseFieldErrorProps, 'className' | 'render'> & { className?: string }`
  - `FIELD_TOKENS` (re-exported from `./Field.tokens.js`)

**Note for the reviewer:** these parts are deliberately **not** exported from `packages/react/src/index.ts` in this task. Task 3 assembles them into the public `Field` namespace and exports that, so the package never ships two spellings of the same part.

- [ ] **Step 1: Write the Tier 3 token module**

Create `packages/react/src/components/Field/Field.tokens.ts`:

```ts
import { tier3 } from '../../theme/tier3.js'
import { vars } from '../../theme/contract.css.js'

/**
 * Tier 3 tokens for the Field parts. Each falls back to a Tier 2 semantic
 * value (ADR-0007).
 *
 * The error text uses `dangerText` (ramp step 11) rather than `dangerBg`
 * (step 9): step 11 is the ramp's TEXT role, gated at 4.5:1 against the
 * surfaces. Step 9 is a solid fill and is not a text colour.
 */
export const FIELD_TOKENS = {
  gap: tier3('field-gap', vars.space['2']),

  labelText: tier3('field-label-text', vars.color.textPrimary),
  labelSize: tier3('field-label-size', vars.text.sm.size),
  labelLineHeight: tier3('field-label-line-height', vars.text.sm.lineHeight),

  descriptionText: tier3('field-description-text', vars.color.textSecondary),
  descriptionSize: tier3('field-description-size', vars.text.xs.size),
  descriptionLineHeight: tier3('field-description-line-height', vars.text.xs.lineHeight),

  errorText: tier3('field-error-text', vars.color.dangerText),
  errorSize: tier3('field-error-size', vars.text.xs.size),
  errorLineHeight: tier3('field-error-line-height', vars.text.xs.lineHeight),
  errorGap: tier3('field-error-gap', vars.space['1']),
} as const
```

- [ ] **Step 2: Register the new `.tokens.ts` with the use-client gate**

Add to `TS_EXEMPTIONS` in `packages/react/src/gates/use-client.gate.test.ts`, after the `Input.tokens.ts` entry added in Task 1:

```ts
  {
    path: join(SRC, 'components', 'Field', 'Field.tokens.ts'),
    why: 'a frozen object of Tier 3 token strings, built with tier3() — pure data like Input.tokens.ts',
  },
```

- [ ] **Step 3: Run the guards to confirm the exemption is wired**

Run: `npm run test:guards`
Expected: PASS.

- [ ] **Step 4: Write the styles**

Create `packages/react/src/components/Field/Field.css.ts`:

```ts
import { style } from '@vanilla-extract/css'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { FIELD_TOKENS as t } from './Field.tokens.js'

export const fieldRootClass = style({
  '@layer': {
    [componentsLayer]: {
      display: 'flex',
      flexDirection: 'column',
      gap: t.gap,
      fontFamily: vars.font.body,
    },
  },
})

export const fieldLabelClass = style({
  '@layer': {
    [componentsLayer]: {
      color: t.labelText,
      fontSize: t.labelSize,
      lineHeight: t.labelLineHeight,
      fontWeight: 500,
    },
  },
})

export const fieldDescriptionClass = style({
  '@layer': {
    [componentsLayer]: {
      margin: 0,
      color: t.descriptionText,
      fontSize: t.descriptionSize,
      lineHeight: t.descriptionLineHeight,
    },
  },
})

export const fieldErrorClass = style({
  '@layer': {
    [componentsLayer]: {
      display: 'flex',
      // flex-start, not center: a two-line error message should keep its icon
      // beside the FIRST line, not floating in the middle of the block.
      alignItems: 'flex-start',
      gap: t.errorGap,
      color: t.errorText,
      fontSize: t.errorSize,
      lineHeight: t.errorLineHeight,
    },
  },
})

export const fieldErrorIconClass = style({
  '@layer': {
    [componentsLayer]: {
      flexShrink: 0,
      // The icon is 1em, so it matches the cap height of the text beside it but
      // sits fractionally high against a taller line box. A logical nudge (not
      // marginTop, which the style-rules gate rejects as physical) lands it on
      // the text baseline.
      marginBlockStart: '0.15em',
    },
  },
})
```

- [ ] **Step 5: Write the failing tests**

Create `packages/react/src/components/Field/FieldParts.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Input } from '../Input/Input.js'
import {
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
} from './FieldParts.js'

describe('Field parts', () => {
  // ADR-0011 §4: "Nobody passes an id by hand, and the ARIA wiring cannot be
  // forgotten." Every assertion in this block is about wiring that appears
  // WITHOUT any id being written in the markup above it.
  it('associates the label with the control with no id passed by hand', () => {
    render(
      <FieldRoot>
        <FieldLabel>Email</FieldLabel>
        <Input name="email" />
      </FieldRoot>,
    )
    const control = screen.getByLabelText('Email')
    expect(control.tagName).toBe('INPUT')
    expect(control.id).not.toBe('')
  })

  it('points aria-describedby at the description, with real resolvable ids', () => {
    render(
      <FieldRoot>
        <FieldLabel>Email</FieldLabel>
        <Input name="email" />
        <FieldDescription>We never share this.</FieldDescription>
      </FieldRoot>,
    )
    const control = screen.getByLabelText('Email')
    const described = control.getAttribute('aria-describedby')
    expect(described).not.toBeNull()
    // Resolve every id to a real element: an aria-describedby naming an id
    // that does not exist reads as no description at all, and a bare
    // "attribute is present" check cannot tell the two apart.
    const ids = described!.split(' ').filter(Boolean)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      expect(document.getElementById(id), `no element with id ${id}`).not.toBeNull()
    }
    expect(ids.map((id) => document.getElementById(id)!.textContent)).toContain(
      'We never share this.',
    )
  })

  it('describes the control by BOTH the description and the error when invalid', () => {
    render(
      <FieldRoot invalid>
        <FieldLabel>Email</FieldLabel>
        <Input name="email" />
        <FieldDescription>We never share this.</FieldDescription>
        <FieldError match>That address is already in use.</FieldError>
      </FieldRoot>,
    )
    const control = screen.getByLabelText('Email')
    const ids = control.getAttribute('aria-describedby')!.split(' ').filter(Boolean)
    const texts = ids.map((id) => document.getElementById(id)!.textContent)
    expect(texts).toContain('We never share this.')
    expect(texts.some((t) => t?.includes('That address is already in use.'))).toBe(true)
  })

  it('marks the control aria-invalid when the root is invalid', () => {
    render(
      <FieldRoot invalid>
        <FieldLabel>Email</FieldLabel>
        <Input name="email" />
      </FieldRoot>,
    )
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true')
  })

  it('renders no error element when the field is valid', () => {
    render(
      <FieldRoot>
        <FieldLabel>Email</FieldLabel>
        <Input name="email" />
        <FieldError>Bad address.</FieldError>
      </FieldRoot>,
    )
    expect(screen.queryByText('Bad address.')).toBeNull()
  })

  // ADR-0011 §5 / WCAG 1.4.1: the error state must not be carried by colour
  // alone. The icon is structural, not decoration a consumer can forget.
  it('renders an icon alongside the error text, and hides it from assistive tech', () => {
    render(
      <FieldRoot invalid>
        <FieldLabel>Email</FieldLabel>
        <Input name="email" />
        <FieldError match>Bad address.</FieldError>
      </FieldRoot>,
    )
    // Reached FROM the message, not from a document-wide `querySelector('svg')`:
    // a document-wide search would pass on any icon anywhere on the page, which
    // is precisely the assertion that cannot fail.
    const errorRow = screen.getByText('Bad address.').closest('div')
    expect(errorRow, 'the error message is not inside an error row').not.toBeNull()
    const svg = errorRow!.querySelector('svg')
    expect(svg, 'no icon rendered beside the error text').not.toBeNull()
    // Decorative: the adjacent text already says what it means, so a second
    // announcement would be noise.
    expect(svg!.getAttribute('aria-hidden')).toBe('true')
  })

  // Omitting children must still surface the browser's own validity message —
  // that is the free half of Base UI's error behaviour and it is easy to break
  // by always passing children through.
  it('falls back to the native validity message when given no children', () => {
    render(
      <FieldRoot>
        <FieldLabel>Email</FieldLabel>
        <Input name="email" required />
        <FieldError match />
      </FieldRoot>,
    )
    // jsdom reports an empty string for validationMessage, so assert the
    // element exists and carries the icon rather than asserting message text.
    const svg = document.querySelector('svg')
    expect(svg, 'the error element did not render its icon').not.toBeNull()
  })

  it('merges className on every part rather than replacing it', () => {
    const { container } = render(
      <FieldRoot invalid className="root-mine">
        <FieldLabel className="label-mine">Email</FieldLabel>
        <Input name="email" />
        <FieldDescription className="desc-mine">Hint</FieldDescription>
        <FieldError match className="error-mine">
          Bad
        </FieldError>
      </FieldRoot>,
    )
    for (const own of ['root-mine', 'label-mine', 'desc-mine', 'error-mine']) {
      const el = container.querySelector(`.${own}`)
      expect(el, `no element carried ${own}`).not.toBeNull()
      expect(el!.className.trim().split(/\s+/).length).toBeGreaterThan(1)
    }
  })

  it('still wires up a bare FieldControl, for a field with no Input', () => {
    render(
      <FieldRoot>
        <FieldLabel>Nickname</FieldLabel>
        <FieldControl name="nickname" />
      </FieldRoot>,
    )
    expect(screen.getByLabelText('Nickname').tagName).toBe('INPUT')
  })
})
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run packages/react/src/components/Field/FieldParts.test.tsx`
Expected: FAIL — `Failed to resolve import "./FieldParts.js"`.

- [ ] **Step 7: Write the parts**

Create `packages/react/src/components/Field/FieldParts.tsx`:

```tsx
'use client'

import { forwardRef, type Ref } from 'react'
import { Field as BaseField } from '@base-ui/react/field'
import type {
  FieldControlProps as BaseFieldControlProps,
  FieldDescriptionProps as BaseFieldDescriptionProps,
  FieldErrorProps as BaseFieldErrorProps,
  FieldLabelProps as BaseFieldLabelProps,
  FieldRootProps as BaseFieldRootProps,
} from '@base-ui/react/field'
import { Icon } from '../../icons/Icon.js'
import {
  fieldDescriptionClass,
  fieldErrorClass,
  fieldErrorIconClass,
  fieldLabelClass,
  fieldRootClass,
} from './Field.css.js'

export { FIELD_TOKENS } from './Field.tokens.js'

/**
 * These wrappers add styling and nothing else. In particular they never
 * compute, read or pass `id`, `aria-describedby` or `aria-invalid`: Base UI's
 * `LabelableProvider` owns all three, the description and error register their
 * own ids into it from a layout effect, and the control merges them. Passing
 * any of those by hand here would produce a SECOND, conflicting wiring that
 * looks correct in one test and silently wins over the real one elsewhere.
 *
 * One consequence worth knowing: because the ids register from an effect,
 * `aria-describedby` is absent from server-rendered HTML and appears after
 * hydration. Both render passes agree, so this is not a hydration mismatch —
 * but never assert the attribute against server markup.
 */

function merge(recipeClass: string, className: string | undefined): string {
  return [recipeClass, className].filter(Boolean).join(' ')
}

export interface FieldRootProps extends Omit<BaseFieldRootProps, 'className'> {
  className?: string
}

export const FieldRoot = forwardRef<HTMLDivElement, FieldRootProps>(function FieldRoot(
  { className, ...rest },
  ref,
) {
  return <BaseField.Root {...rest} ref={ref} className={merge(fieldRootClass, className)} />
})

export interface FieldLabelProps extends Omit<BaseFieldLabelProps, 'className'> {
  className?: string
}

export const FieldLabel = forwardRef<HTMLLabelElement, FieldLabelProps>(function FieldLabel(
  { className, ...rest },
  ref,
) {
  return (
    <BaseField.Label
      {...rest}
      // Base UI types this ref as `Ref<HTMLElement>` while rendering a real
      // `<label>`; a mutable ref is invariant in its element type, so the
      // narrower ref is not assignable without a cast. Same reasoning as
      // Input.tsx — the cast lives here so consumers get the accurate type.
      ref={ref as Ref<HTMLElement>}
      className={merge(fieldLabelClass, className)}
    />
  )
})

/**
 * The unstyled control slot. `Input` is the styled one and is what a product
 * normally uses; `Field.Control` stays available for a control this library
 * does not ship yet.
 */
export interface FieldControlProps extends Omit<BaseFieldControlProps, 'className'> {
  className?: string
}

export const FieldControl = forwardRef<HTMLInputElement, FieldControlProps>(function FieldControl(
  { className, ...rest },
  ref,
) {
  return (
    <BaseField.Control
      {...rest}
      // See the ref note on FieldLabel above — Base UI types it as HTMLElement.
      ref={ref as Ref<HTMLElement>}
      {...(className !== undefined ? { className } : {})}
    />
  )
})

export interface FieldDescriptionProps extends Omit<BaseFieldDescriptionProps, 'className'> {
  className?: string
}

export const FieldDescription = forwardRef<HTMLParagraphElement, FieldDescriptionProps>(
  function FieldDescription({ className, ...rest }, ref) {
    return (
      <BaseField.Description
        {...rest}
        ref={ref}
        className={merge(fieldDescriptionClass, className)}
      />
    )
  },
)

/**
 * `render` is deliberately NOT part of this component's props.
 *
 * ADR-0011 §5 makes "an error is an icon and text, never colour alone" a
 * structural guarantee rather than a review note, and this part keeps that
 * guarantee by owning its own `render` function. Exposing `render` here would
 * hand a consumer the one prop that can remove the icon — which is exactly the
 * WCAG 1.4.1 failure the rule exists to prevent.
 *
 * The render function receives the fully merged element props, so whichever
 * message won — the consumer's `children` or Base UI's native validity
 * message, in that precedence — is what gets wrapped.
 */
export interface FieldErrorProps extends Omit<BaseFieldErrorProps, 'className' | 'render'> {
  className?: string
}

export const FieldError = forwardRef<HTMLDivElement, FieldErrorProps>(function FieldError(
  { className, ...rest },
  ref,
) {
  return (
    <BaseField.Error
      {...rest}
      ref={ref}
      className={merge(fieldErrorClass, className)}
      render={(props) => {
        const { children, ...elementProps } = props
        return (
          <div {...elementProps}>
            <Icon name="alert-circle" className={fieldErrorIconClass} />
            <span>{children}</span>
          </div>
        )
      }}
    />
  )
})
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run packages/react/src/components/Field/FieldParts.test.tsx`
Expected: PASS (9 tests).

If the `render`-function branch type-errors on `props.children`, widen the destructure with an explicit annotation rather than casting the whole callback:

```tsx
render={(props: Record<string, unknown> & { children?: React.ReactNode }) => { … }}
```

- [ ] **Step 9: Run the full suite, the gates and typecheck**

Run: `npm test && npm run test:guards && npm run typecheck`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/react/src/components/Field packages/react/src/gates/use-client.gate.test.ts
git commit -m "feat(react): Field compound parts with derived ARIA and a structural error icon"
```

---

### Task 3: The `Field` convenience component and the equivalence proof

**Files:**
- Create: `packages/react/src/components/Field/Field.tsx`
- Create: `packages/react/src/components/Field/index.ts`
- Test: `packages/react/src/components/Field/Field.test.tsx`
- Test: `packages/react/src/components/Field/Field.ssr.test.tsx`
- Modify: `packages/react/src/index.ts`

**Interfaces:**
- Consumes: `FieldRoot`, `FieldLabel`, `FieldControl`, `FieldDescription`, `FieldError`, `FIELD_TOKENS` from `./FieldParts.js` (Task 2); `Input` from `../Input/index.js` (Task 1, tests only).
- Produces:
  - `interface FieldProps extends Omit<FieldRootProps, 'children'> { label: string; hint?: string; error?: string; children: ReactNode }`
  - `Field` — the convenience component, carrying the compound parts as properties: `Field.Root`, `Field.Label`, `Field.Control`, `Field.Description`, `Field.Error`.
  - Re-exported types `FieldRootProps`, `FieldLabelProps`, `FieldControlProps`, `FieldDescriptionProps`, `FieldErrorProps`.

- [ ] **Step 1: Write the failing tests**

Create `packages/react/src/components/Field/Field.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Field } from './Field.js'
import { Input } from '../Input/Input.js'

/**
 * Generated ids differ between two renders of the same tree, so they are
 * normalised away before comparison. Everything else — tag names, class
 * names, attribute presence, text, ordering — is compared verbatim.
 */
function normaliseIds(html: string): string {
  return html
    .replace(/\bid="[^"]*"/g, 'id="ID"')
    .replace(/\bfor="[^"]*"/g, 'for="ID"')
    .replace(/\baria-describedby="[^"]*"/g, 'aria-describedby="ID"')
    .replace(/\baria-labelledby="[^"]*"/g, 'aria-labelledby="ID"')
}

describe('Field (convenience)', () => {
  it('labels the control', () => {
    render(
      <Field label="Email">
        <Input name="email" />
      </Field>,
    )
    expect(screen.getByLabelText('Email').tagName).toBe('INPUT')
  })

  it('renders the hint as the field description', () => {
    render(
      <Field label="Email" hint="We never share this.">
        <Input name="email" />
      </Field>,
    )
    const ids = screen
      .getByLabelText('Email')
      .getAttribute('aria-describedby')!
      .split(' ')
      .filter(Boolean)
    expect(ids.map((id) => document.getElementById(id)!.textContent)).toContain(
      'We never share this.',
    )
  })

  it('shows an externally supplied error and marks the control invalid', () => {
    render(
      <Field label="Email" error="That address is already in use.">
        <Input name="email" />
      </Field>,
    )
    const control = screen.getByLabelText('Email')
    expect(control.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('That address is already in use.')).not.toBeNull()
  })

  it('renders no error element when no error is given', () => {
    render(
      <Field label="Email" hint="Hint">
        <Input name="email" />
      </Field>,
    )
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).not.toBe('true')
    expect(document.querySelector('svg')).toBeNull()
  })

  /**
   * ADR-0011 §2: "a convenience component must be implementable purely through
   * the public compound API. If it cannot be, the compound API is incomplete —
   * and that is the bug to fix, not to work around internally."
   *
   * This is that rule as a test. It is the reason the two APIs cannot drift
   * into a fast path and a real path with different behaviour: any structure,
   * class, attribute or ordering the convenience component produces that the
   * compound assembly below cannot produce fails right here.
   */
  it('produces exactly the DOM its own compound parts produce', () => {
    const convenience = render(
      <Field label="Email" hint="We never share this." error="Already in use.">
        <Input name="email" defaultValue="a@b.c" />
      </Field>,
    ).container.innerHTML

    const compound = render(
      <Field.Root invalid>
        <Field.Label>Email</Field.Label>
        <Input name="email" defaultValue="a@b.c" />
        <Field.Description>We never share this.</Field.Description>
        <Field.Error match>Already in use.</Field.Error>
      </Field.Root>,
    ).container.innerHTML

    expect(normaliseIds(convenience)).toBe(normaliseIds(compound))
  })

  it('exposes every compound part on the namespace', () => {
    for (const part of ['Root', 'Label', 'Control', 'Description', 'Error'] as const) {
      expect(Field[part], `Field.${part} is missing`).toBeTypeOf('object')
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run packages/react/src/components/Field/Field.test.tsx`
Expected: FAIL — `Failed to resolve import "./Field.js"`.

- [ ] **Step 3: Write the convenience component and the namespace**

Create `packages/react/src/components/Field/Field.tsx`:

```tsx
'use client'

import { forwardRef, type ReactNode } from 'react'
import {
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  type FieldRootProps,
} from './FieldParts.js'

export { FIELD_TOKENS } from './Field.tokens.js'
export type {
  FieldControlProps,
  FieldDescriptionProps,
  FieldErrorProps,
  FieldLabelProps,
  FieldRootProps,
} from './FieldParts.js'

export interface FieldProps extends Omit<FieldRootProps, 'children'> {
  /** The control's visible label. Required — an unlabelled field is a defect. */
  label: string
  /**
   * Supporting copy shown under the control. Named `hint` on this component
   * (ADR-0011 §2's own example) and rendered as `Field.Description`, which is
   * the part name Base UI and our compound API use.
   */
  hint?: string
  /**
   * An error message from outside the browser's own validation — a server
   * action's response, most often. Supplying one marks the field invalid and
   * shows the message unconditionally; omitting it leaves native validation
   * in charge, which still renders through `Field.Error`.
   */
  error?: string
  /** The control. Normally `<Input />`. */
  children: ReactNode
}

/**
 * The convenience assembly of the compound parts, for the common case:
 *
 * ```tsx
 * <Field label="Email" hint="We never share this." error={errors.email}>
 *   <Input name="email" type="email" />
 * </Field>
 * ```
 *
 * Everything below this comment uses only the public compound API — no import
 * from Base UI, no context read, no internal helper. `Field.test.tsx` asserts
 * the two produce identical DOM, which is ADR-0011 §2's rule made mechanical:
 * if this component ever needs something the compound parts cannot express,
 * the compound API is what gets fixed.
 */
const FieldBase = forwardRef<HTMLDivElement, FieldProps>(function Field(
  { label, hint, error, children, ...rest },
  ref,
) {
  // An empty string is not an error. A server action that returns `''` for a
  // field that passed would otherwise flip the whole field to invalid and
  // render an error row with no message in it.
  const hasError = error !== undefined && error !== ''
  return (
    <FieldRoot {...rest} {...(hasError ? { invalid: true } : {})} ref={ref}>
      <FieldLabel>{label}</FieldLabel>
      {children}
      {hint !== undefined ? <FieldDescription>{hint}</FieldDescription> : null}
      {hasError ? <FieldError match>{error}</FieldError> : null}
    </FieldRoot>
  )
})

/**
 * `Field` is both the convenience component and the namespace holding its
 * parts, exactly as ADR-0011 writes it: `<Field label="Email">` for the common
 * case, `<Field.Root>` + parts when the layout needs controlling.
 */
export const Field = Object.assign(FieldBase, {
  Root: FieldRoot,
  Label: FieldLabel,
  Control: FieldControl,
  Description: FieldDescription,
  Error: FieldError,
})
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/react/src/components/Field/Field.test.tsx`
Expected: PASS (6 tests).

**If the equivalence test fails**, the difference is the finding — read the diff before changing either side. A mismatch in `invalid` handling or in the ordering of children means the convenience component is doing something the compound API cannot; fix the compound API or the convenience assembly, never the assertion.

- [ ] **Step 5: Write the SSR assertion**

Create `packages/react/src/components/Field/Field.ssr.test.tsx`:

```tsx
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Field } from './Field.js'
import { Input } from '../Input/Input.js'

describe('Field renders on the server', () => {
  it('runs with no browser globals present', () => {
    expect(typeof window).toBe('undefined')
    const html = renderToString(
      <Field label="Email" hint="We never share this.">
        <Input name="email" defaultValue="a@b.c" />
      </Field>,
    )
    expect(html).toContain('<label')
    expect(html).toContain('Email')
    expect(html).toContain('<input')
    expect(html).toContain('name="email"')
    expect(html).toContain('We never share this.')
  })

  // The label-to-control association is computed during render, so unlike
  // aria-describedby it IS present in server markup — a keyboard or screen
  // reader user gets a working label before any JavaScript runs.
  it("wires the label's for to the control's id in the server markup", () => {
    const html = renderToString(
      <Field label="Email">
        <Input name="email" />
      </Field>,
    )
    const labelFor = /<label[^>]*\sfor="([^"]+)"/.exec(html)?.[1]
    const inputId = /<input[^>]*\sid="([^"]+)"/.exec(html)?.[1]
    expect(labelFor, 'no for attribute on the server-rendered label').toBeDefined()
    expect(inputId).toBe(labelFor)
  })

  it('renders an externally supplied error server-side, with its icon', () => {
    const html = renderToString(
      <Field label="Email" error="Already in use.">
        <Input name="email" />
      </Field>,
    )
    expect(html).toContain('Already in use.')
    expect(html).toContain('<svg')
  })
})
```

- [ ] **Step 6: Write the barrel and export from the package index**

Create `packages/react/src/components/Field/index.ts`:

```ts
export { Field, FIELD_TOKENS } from './Field.js'
export type {
  FieldProps,
  FieldRootProps,
  FieldLabelProps,
  FieldControlProps,
  FieldDescriptionProps,
  FieldErrorProps,
} from './Field.js'
```

Add to `packages/react/src/index.ts`, immediately after the `Input` export lines:

```ts
export { Field, FIELD_TOKENS } from './components/Field/index.js'
export type {
  FieldProps,
  FieldRootProps,
  FieldLabelProps,
  FieldControlProps,
  FieldDescriptionProps,
  FieldErrorProps,
} from './components/Field/index.js'
```

- [ ] **Step 7: Run the full suite, the gates and typecheck**

Run: `npm test && npm run test:gates && npm run typecheck`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/react/src/components/Field packages/react/src/index.ts
git commit -m "feat(react): Field convenience component, proven identical to its compound parts"
```

---

### Task 4: Prove the pre-hydration submit in a real browser

Spec §8 check 9. ADR-0011 §4 claims an RR8 `<Form method="post">` submits and the action runs **before hydration completes**, because the browser is submitting a real form. That claim has never been executed. This task executes it the only way that cannot cheat: by **blocking every client JavaScript bundle**, so hydration provably never happens, and then submitting.

**Files:**
- Create: `fixtures/ssr-app/app/routes/form.tsx`
- Create: `fixtures/ssr-app/e2e/progressive-enhancement.spec.ts`
- Modify: `fixtures/ssr-app/app/routes.ts`
- Modify: `packages/react/src/gates/ssr-render.gate.test.ts`

**Interfaces:**
- Consumes: `Field`, `Input`, `Button` from `@ap/react` (Tasks 1 and 3, plus Phase 4b).
- Produces: route `/form` with an `action`; e2e spec proving submission with JS disabled and with JS enabled.

- [ ] **Step 1: Write the failing e2e spec**

Create `fixtures/ssr-app/e2e/progressive-enhancement.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test'

/**
 * ADR-0011 §4: uncontrolled-first exists so that "an RR8 `<Form method="post">`
 * submits and the action runs BEFORE hydration completes, because the browser
 * is submitting a real form".
 *
 * Proving that with a race — click fast enough and hope hydration hasn't
 * finished — is a flaky test that passes for the wrong reason on a fast
 * machine. So this blocks every client JavaScript bundle instead: hydration
 * cannot complete because the code to do it never arrives. If the submitted
 * value still reaches the server action, the form worked as HTML, which is
 * strictly stronger than "worked before hydration finished".
 */
async function blockClientJavaScript(page: Page): Promise<void> {
  await page.route('**/*.js', (route) => route.abort())
}

test('the form submits and the action runs with client JavaScript blocked', async ({ page }) => {
  await blockClientJavaScript(page)
  await page.goto('/form')

  // Guard the guard: if hydration DID happen, this test would be proving
  // nothing, so assert the marker root.tsx sets from its effect is absent.
  await expect(page.locator('#email-input')).toBeVisible()
  const hydrated = await page.evaluate(() => document.documentElement.dataset['apHydrated'])
  expect(hydrated, 'client JS was not actually blocked — this test proves nothing').toBeUndefined()

  await page.fill('#email-input', 'a@b.c')
  await page.locator('button[type="submit"]').click()

  await expect(page.locator('#submitted')).toHaveText('received: a@b.c')
})

test('the label is associated with the control before any JavaScript runs', async ({ page }) => {
  await blockClientJavaScript(page)
  await page.goto('/form')
  // getByLabel resolves through the for/id association in the served HTML.
  await expect(page.getByLabel('Email')).toBeVisible()
})

test('a server-side validation error renders with an icon, not colour alone', async ({ page }) => {
  await blockClientJavaScript(page)
  await page.goto('/form')
  await page.fill('#email-input', 'not-an-email')
  await page.locator('button[type="submit"]').click()

  const errorText = page.getByText('That is not an email address.')
  await expect(errorText).toBeVisible()
  // ADR-0011 §5 / WCAG 1.4.1 — the error must carry a non-colour cue. Located
  // FROM the message as its immediate preceding sibling, never as a page-wide
  // `locator('svg')` count: that would pass on any icon anywhere on the page.
  await expect(errorText.locator('xpath=preceding-sibling::svg')).toHaveCount(1)
})

test('the same form still works after hydration, with no console noise', async ({ page }) => {
  const messages: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') messages.push(m.text())
  })
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`))

  await page.goto('/form')
  await page.waitForFunction(
    () => document.documentElement.dataset['apHydrated'] === 'true',
    undefined,
    { timeout: 10_000 },
  )
  await page.fill('#email-input', 'x@y.z')
  await page.locator('button[type="submit"]').click()
  await expect(page.locator('#submitted')).toHaveText('received: x@y.z')

  const noise = messages.filter((m) => !/Download the React DevTools|favicon/i.test(m))
  expect(noise, `unexpected console output:\n${noise.join('\n')}`).toEqual([])
})
```

- [ ] **Step 2: Run the e2e suite to verify the new spec fails**

Run: `npm run test:hydration`
Expected: the four new tests FAIL — `/form` does not route, so `#email-input` never appears. The existing `hydration.spec.ts` tests still PASS.

- [ ] **Step 3: Write the route**

Create `fixtures/ssr-app/app/routes/form.tsx`:

```tsx
import { Form } from 'react-router'
import { Button, Field, Input } from '@ap/react'

export async function action({ request }: { request: Request }) {
  const data = await request.formData()
  const email = String(data.get('email') ?? '')
  // Echoed straight back so the test can prove the value reached the server.
  // A deliberate "invalid" case gives the error path something real to render.
  return email.includes('@')
    ? { submitted: email, error: null }
    : { submitted: null, error: 'That is not an email address.' }
}

export default function FormRoute({
  actionData,
}: {
  actionData?: { submitted: string | null; error: string | null }
}) {
  return (
    <main>
      <h1>form</h1>
      <Form method="post">
        <Field
          label="Email"
          hint="We never share this."
          {...(actionData?.error ? { error: actionData.error } : {})}
        >
          <Input name="email" type="email" id="email-input" />
        </Field>
        <Button type="submit">Save</Button>
      </Form>
      {actionData?.submitted ? <p id="submitted">received: {actionData.submitted}</p> : null}
    </main>
  )
}
```

Note the conditional spread on `error`: the fixture's tsconfig has `strict`, and `Field`'s `error` prop is optional, so passing an explicit `undefined` is what the spread avoids. Types are inline for the same reason `streamed.tsx` types its loader data inline — this fixture's tsconfig declares no `rootDirs` for `react-router typegen`'s generated `./+types/*` modules.

- [ ] **Step 4: Register the route, excluded from the SPA build**

In `fixtures/ssr-app/app/routes.ts`, extend the existing SPA exclusion — a route module exporting an `action` is rejected by RR8's SPA build for the same reason `loader` is:

```ts
export default [
  index('routes/home.tsx'),
  ...(isSpa ? [] : [route('streamed', 'routes/streamed.tsx'), route('form', 'routes/form.tsx')]),
] satisfies RouteConfig
```

Update the comment above `isSpa` so it names both reasons:

```ts
// RR8's SPA-mode build statically rejects any route module that exports a
// `loader` or an `action` (there is no server to run either against) —
// `streamed.tsx` exports a loader and `form.tsx` an action, both deliberately,
// to prove gate 6's SSR streaming and ADR-0011 §4's pre-hydration submit.
// Gate 7 never requests either path, so the SPA build simply doesn't route to
// them, keeping this one app buildable in both modes without a second fixture.
```

- [ ] **Step 5: Run the e2e suite to verify it passes**

Run: `npm run test:hydration`
Expected: PASS, all specs.

- [ ] **Step 6: Extend the SSR gate with server-markup assertions for the new route**

In `packages/react/src/gates/ssr-render.gate.test.ts`, add a test inside the existing top-level `describe`, alongside the other route assertions:

```ts
  it('serves the form route with a real form, a labelled control and its value in the markup', async () => {
    const res = await fetchAsBrowser(`${base}/form`)
    expect(res.status).toBe(200)
    const html = await res.text()

    // A real form the browser can submit without any JavaScript — this is the
    // markup ADR-0011 §4's progressive-enhancement claim rests on.
    expect(html).toContain('method="post"')
    expect(html).toContain('name="email"')

    // The label-to-control wiring is derived during render, so it survives to
    // the server response. `aria-describedby` deliberately is NOT asserted:
    // Base UI's description/error ids register from a layout effect, so the
    // attribute legitimately appears only after hydration.
    const labelFor = /<label[^>]*\sfor="([^"]+)"/.exec(html)?.[1]
    expect(labelFor, 'no for attribute on the server-rendered label').toBeDefined()
    expect(html).toContain(`id="${labelFor}"`)
  })
```

- [ ] **Step 7: Run the SSR gate**

Run: `npm run test:ssr`
Expected: PASS.

- [ ] **Step 8: Run everything**

Run: `npm test && npm run test:gates && npm run typecheck && npm run test:ssr && npm run test:hydration`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add fixtures/ssr-app/app fixtures/ssr-app/e2e packages/react/src/gates/ssr-render.gate.test.ts
git commit -m "test(fixture): prove the uncontrolled form submits with client JS blocked"
```

---

## Verification plan

Ordered, each with the command that is the evidence.

| # | Check | Command | Success signal |
|---|---|---|---|
| 1 | Every new `.tokens.ts` is a declared client-module exemption | `npm run test:guards` | Passes; removing an exemption fails naming the file |
| 2 | Every declaration lands in `@layer ap.components`, no Tier 1 refs, no physical properties, no `boxShadow` focus ring | `npm run test:guards` | Passes; moving one property out of the `'@layer'` wrapper fails with its path |
| 3 | No hardcoded user-facing string in the new components | `npm run test:guards` | Passes |
| 4 | `Input` is uncontrolled-first — a native submit carries its value with no React state | `npx vitest run packages/react/src/components/Input` | The `FormData` assertion passes |
| 5 | Field ARIA wiring is derived, not passed — every `aria-describedby` id resolves to a real element | `npx vitest run packages/react/src/components/Field` | Passes; no `id=` appears in the test markup |
| 6 | An error is an icon and text, never colour alone | `npx vitest run packages/react/src/components/Field` | `svg` present and `aria-hidden` |
| 7 | The convenience component is implementable purely through the compound API | `npx vitest run packages/react/src/components/Field/Field.test.tsx` | Normalised DOM of both assemblies is identical |
| 8 | Both components render server-side with no browser globals | `npm test` | The `.ssr.test.tsx` files pass in the node environment |
| 9 | The label↔control association survives to server markup | `npm run test:ssr` | `for` matches the input's `id` in the HTTP response |
| 10 | **The form submits and the action runs with client JavaScript blocked** | `npm run test:hydration` | `#submitted` shows the value, with `data-ap-hydrated` provably absent |
| 11 | The same form still works after hydration, silently | `npm run test:hydration` | Value round-trips, zero console errors/warnings |
| 12 | Nothing else regressed | `npm test && npm run test:gates && npm run typecheck` | All green |

**Proof artifact:** a clean run of

```
npm test && npm run test:gates && npm run typecheck && npm run test:ssr && npm run test:hydration
```

with check 10 — the pre-hydration submit — passing. That single test is the phase's headline claim; everything else in this plan is what makes it possible.

## Deliberately not in this plan

| Deferred | Why |
|---|---|
| `.stories.tsx` for Input and Field | Spec §7.1 — Storybook is stood up in 4e; gates 4 and 5 land with it |
| `test:spa` (gate 7) | 4e. The `/form` route is already excluded from the SPA build, so it is ready for that gate |
| `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch` | Phase 5 — `Field.Control` and `Field.Root` already accept them with no change here |
| A `required` / `optional` marker on the label | The message registry has both keys, but no spec requirement asks for the marker yet, and a marker has real design questions (asterisk vs word, which one is the default) that belong with the form-patterns work |
| An `examples/forms/` page | The examples directory exists for token references (colour, scales), not component galleries; Storybook is the component gallery, in 4e |
