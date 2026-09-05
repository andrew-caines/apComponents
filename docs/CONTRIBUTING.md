# Contributing

## Requirements

Node 22.22.0 or later (React Router 8's floor). npm 10+.

## Setup

    npm install
    npm --prefix fixtures/ssr-app install
    npm --prefix fixtures/consumer install
    npm run showcase:install
    npx --prefix fixtures/ssr-app playwright install chromium

## Everyday commands

| Command | What it does |
|---|---|
| `npm test` / `npm run test:unit` | Full Vitest suite (gate 4) |
| `npm run typecheck` | `tsc -b` across all packages |
| `npm run test:gates` | Token, contrast, gamut, sweep, freshness, guard, contract and motion gates |
| `npm run test:motion` | `@ap/motion`'s own suite: unit tests plus its equivalence, reduced-motion, freshness and isolation gates |
| `npm run gen:motion-css` | Regenerates `packages/motion/src/motion.css` from `motions.ts` |
| `npm run test:ssr` | Builds and serves the RR8 fixture, asserts SSR markup and streaming |
| `npm run test:hydration` | Playwright: zero hydration warnings, tokens resolve, no third-party requests, and the pre-hydration submit proof — `/form` submits and its action runs with every client bundle blocked |
| `npm run test:consumer` | Builds the `file:`-protocol consumer fixture |
| `npm run test:spa` | Gate 7 only: the same fixture built with `ssr: false` boots, and component CSS is still wired through the build |
| `npm run test:a11y` | Gate 5: axe over every showcase section, plus an OPEN dialog and a field in its error state |
| `npm run report:contrast` | Writes `reports/contrast.md` (the WCAG compliance artifact) |
| `npm run gen:scale-demo` | Recaptures `examples/scales/` screenshots and prints the measured size table |
| `npm run gen:colour-demo` | Regenerates `examples/colours/index.html`, verifies it in both schemes, recaptures screenshots |
| `npm run gen:input-demo` | Regenerates `examples/InputFields.html` — renders the real components, compiles their real CSS, reads every code sample out of the AST, then runs six browser checks |
| `npm run showcase` | Dev server for the showcase app — every component, live, in both schemes |
| `npm run showcase:test` | Smoke-tests every showcase section: 200, server-rendered heading, nav state, zero console output |

`npm run test:watch` only watches in an interactive terminal. Vitest 4 defaults
`watch` to off when stdin is not a TTY or when it detects an agent, so in CI or
an agent shell the same command runs once and exits.

## Generated files

These are generated and **committed**. Never edit them by hand.

How well CI catches a stale one varies, so the third column says what actually
guards each — "CI fails if they drift" is only true of the two that are compared
byte for byte against their generator.

| File | Regenerate with | What catches staleness |
|---|---|---|
| `packages/tokens/src/typography/metrics.generated.ts` | `npm run gen:font-metrics` | `test:fonts` — metrics are asserted against `@capsizecss/metrics` |
| `packages/react/src/theme/contract.css.ts` | `npm run gen:theme-contract` | `test:contract` — every semantic token is present, none extra, no Tier 1 leak. **Not** a byte comparison |
| `packages/react/src/theme/theme.css` | `npm run gen:theme-css` | `test:freshness` — **byte-compared** against the generator |
| `packages/react/src/theme/fonts.css` + `packages/react/fonts/*.woff2` | `npm run gen:fonts` | `test:fonts` — every referenced font file exists and the fallback metrics are present. **Not** a byte comparison |
| `packages/motion/src/motion.css` | `npm run gen:motion-css` | `test:motion` — **byte-compared** against the generator |
| `examples/colours/index.html` | `npm run gen:colour-demo` | **Nothing.** The generator verifies the page in a browser when you run it; no gate re-checks the committed copy |
| `examples/InputFields.html` | `npm run gen:input-demo` | `test:guards` checks the Tier 3 token table against `INPUT_TOKENS`/`FIELD_TOKENS`. The rendered markup and its stylesheet are verified only when you run the generator |

Regenerating an examples page needs a browser, which is too heavy for the unit
suite — so those two are the weak rows. Regenerate them in the same commit as
any change to what they show.

## Rules the gates enforce

- Every component module starts with `'use client'`.
- No browser globals, `useLayoutEffect`, `Date.now()`, `Math.random()` or `react-router`
  imports (including subpath and dynamic imports) in `@ap/react` runtime source, and no
  `react-router*` dependency in `packages/react/package.json` (ADR-0001/0011).
- Component styles reference Tier 2/3 tokens only — never a Tier 1 ramp step.
- **`-on-solid` and `-text` are different roles, and the difference is easy to
  invert.** `color-<ramp>-on-solid` is text drawn **on** that ramp's solid
  background; `color-<ramp>-text` is that ramp's colour used **as** text on a
  neutral surface. Brand originally used `-text` for the on-solid role, so the
  same suffix meant opposite things depending on which ramp you were reading —
  renamed in Phase 4b, while no component consumed it yet and the change was
  still cheap. If you add a colour role, add its pairing to `PAIRINGS` in
  `packages/tokens/src/emit/contrastReport.ts` in the same commit: a role with
  no pairing is ungated, free to drift to any value, and nothing will notice.
- Logical properties only (`marginInlineStart`, not `marginLeft`; `insetInlineStart`, not `left`).
- No literal `zIndex`; use `vars.z.*`.
- Never `outline: 'none'` — style `:focus-visible` instead.
- Every component style must emit into the shared `ap.components` cascade layer
  (ADR-0016) — never unlayered. Layered CSS always loses to unlayered CSS, so a
  component style that isn't in the layer breaks the "consumer overrides always win"
  guarantee the whole layering strategy exists to provide.
- Motion is defined once, in `packages/motion/src/motions.ts` (ADR-0010), and emitted
  twice — to `motion.css` and to Motion-shaped variant objects — from that single
  record; never hand-edit `motion.css`. The equivalence gate reads the CSS side back
  out of the committed `motion.css` artifact — never `toMotionCss()`'s in-memory
  output, so a stale or hand-edited file is caught — and compares it against
  `toMotionVariants()`'s output directly, which is the JS emission itself and has no
  artifact to read. They must agree on names, offsets, per-step values, duration,
  easing, iteration counts, and which keyframes each composite property drives.
- Every step of a motion must declare the same set of animatable properties. Sparse
  steps (a property present at some steps but not others) are outlawed rather than
  reconciled: `emitCss.ts` lets native CSS keyframe interpolation ramp across whatever
  properties a step declares, while `emitVariants.ts` reads each step's value directly
  with no interpolation semantics of its own. Neither emitter implements carry-forward,
  so a sparse step would make the two emitters render visibly different animations from
  the same record — exactly the drift this package exists to prevent.
- Every motion has a `prefers-reduced-motion` definition, and only `skeleton.shimmer`
  and `spinner.rotate` may loop — perpetual motion is a vestibular hazard (ADR-0010).
  A motion that degrades to `'none'` still gets a present-but-empty keyframe block
  (`0%, 100% { }`), not a deleted one: the animation still runs and still fires
  `animationend`, so a component that unmounts or advances state on that event behaves
  identically for a reduced-motion user. The reduced-motion gate checks this at the
  value level, not just by property name — a stray hardcoded opacity across every
  reduced stop still declares only `opacity`, so a set-only check can't see it; the
  gate compares each reduced step's offset and value against what `motions.ts` actually
  declares.
- `@ap/motion` imports nothing but `@ap/tokens` (ADR-0001) — no React, no Motion, no
  Node built-ins, no DOM access. Its output is consumed by build tooling and the
  browser, never by Node at runtime, and nothing in Phase 3 imports the package itself;
  its gates are its only consumers.
- **`ICON`'s named steps are multipliers, not sizes.** `ICON` is in `em`, so a step
  scales against the font size of its own context — which is what makes an icon inside a
  small button shrink with the button's text, with no per-call-site coordination. The
  cost is that `icon-{step}` and `text-{step}` are *not* interchangeable: an `lg` icon
  inside `lg` text renders at 1.25 × 20px = 25px, because both scale. **To pair an icon
  with a label, use `md`** — `1em` equals the surrounding text at every step. Reach for
  another step only when the icon should deliberately differ from the text beside it.
  The numbers are `TEXT` read at the 16px base (`0.75em` is `text-xs`'s 12px, `1.25em`
  is `text-lg`'s 20px), so the two scales stay proportional — but they are literals,
  related by convention rather than by code, and nothing catches them drifting apart.
  If you change `TEXT`'s sizes, or add a scale that names its steps `xs`…`2xl`, update
  `ICON` (or the new scale) in the same commit.

  `TEXT`'s `fine-print` (11px) is deliberately **outside** that series, and that is the
  point of the name: a step called `xxs` would pull an `ICON` counterpart along with it
  and put the two scales back in lockstep. An icon set beside fine print uses `md`
  (`1em`) and tracks it with no coordination at all.

## Adding a component

There are two shapes, and which one you want depends on whether the component has
parts a product may need to lay out itself.

**A single element** — copy `packages/react/src/components/Surface/`: a `.tsx` module
with `'use client'`, a `.css.ts` recipe, a `.tokens.ts` file declaring the Tier 3
override surface, a test, and an `index.ts`. Nothing else in the tree needs to change.

**A component with parts** — copy `packages/react/src/components/Field/`. It is the
same file set plus one split, and the split is the point:

- `FieldParts.tsx` holds the compound parts (`FieldRoot`, `FieldLabel`,
  `FieldControl`, `FieldDescription`, `FieldError`) — each a thin styled wrapper over
  its Base UI part, each exported with its own props interface. These are the
  complete API; everything else is built out of them.
- `Field.tsx` holds the convenience component, the one-element common case
  (`<Field label="Email" hint="…" error={…}>`). It imports only from `FieldParts.js`
  — no Base UI import, no context read, no internal helper.
- The two are joined with `Object.assign` at the bottom of `Field.tsx`, so
  `Field` is both the convenience component and the namespace: `<Field label="…">`
  or `<Field.Root>` + parts, from one import.
- `Field.test.tsx` asserts the two produce **identical DOM**. That test is
  [ADR-0011](adr/0011-component-api-conventions.md) §2 made mechanical: if the
  convenience component ever needs something the compound parts cannot express, the
  compound API is what gets fixed. Do not loosen it; add the missing part instead.
- The convenience component's props deliberately `Omit` the parts' props it cannot
  honour. `FieldProps` omits `invalid`, because `Field.Root`'s `invalid` marks a
  control invalid without supplying anything to read, and the convenience component
  has no way for a caller to supply that text other than `error`. Whenever a
  convenience component inherits a prop whose effect it cannot render, omit it and
  say why in the doc comment.
- A slot that renders a message must be in the tree **unconditionally**, not gated
  on a prop. `Field` always renders `<Field.Error>`, even with no `error` supplied,
  because Base UI needs somewhere to put the browser's own validity message; gating
  it on `error` produced a field with `aria-invalid` and a red border and nothing to
  read — [ADR-0011](adr/0011-component-api-conventions.md) §5's colour-alone failure,
  reached through the recommended API. Base UI's part returns `null` while the field
  is valid, so an unconditional slot costs no markup.
- A prop that positions something is named for the **inline axis** — `startIcon`,
  `endIcon` — never `left`/`right`, and it is placed with `inset-inline-start`/`-end`.
  See [ADR-0011](adr/0011-component-api-conventions.md) §6.1: a physical name would be
  the only one in the API, and it becomes wrong under RTL.
- A prop that makes something clickable carries its accessible name in the **type**,
  not in a doc comment. `InputAdornment` is a union whose `onClick` branch requires
  `label`, so a clickable icon with no name will not compile (§6.2). When you add an
  interactive slot to a component, prefer making the unusable state unrepresentable
  over documenting it.
- A colour prop takes a **curated list of semantic roles**, never `keyof vars.color`
  and never a raw value — the full keyset makes `color="bgCanvas"` (an invisible icon)
  type-legal. Apply the choice by setting the component's Tier 3 custom property
  inline rather than generating a class per role
  ([ADR-0011](adr/0011-component-api-conventions.md) §6.3).
- A hit area and the surface you paint may differ, and sometimes must: at `sm` a
  26px-tall field cannot hold a 24px target with visible clearance on both sides.
  Keep the focus ring on the focusable element and inset it with a negative
  `outline-offset` — the style gate forbids suppressing an outline with no
  exemption, and a text scan cannot tell a relocated ring from a deleted one (§6.4).
- Writing a forbidden CSS literal **in a comment** fails the gate that forbids it:
  `style-rules.gate.test.ts` scans raw text. Hyphenate it — write `margin-top` and
  `outline-style: none` when you are explaining why not to use them. This has caught
  two honest comments so far; see the known-gaps note below.
- Wrap the control in extra markup only when there is something to put there.
  `Input` renders a bare `<input>` with no adornment and a positioned wrapper with
  one, so adding the feature moved nothing a consumer already styles or queries.
  `Input.test.tsx` asserts both shapes.

- **Add a section to the showcase.** A component nobody can look at is a component
  nobody reviews. It is one entry in `showcase/app/sections.ts` and one route file —
  see "The showcase" below. The smoke test walks that list, so the new page is
  covered the moment it is added.

Import the shared `componentsLayer` from `packages/react/src/theme/layers.css.ts` and
wrap every style object (base, each variant, each compound variant) in
`{ '@layer': { [componentsLayer]: { ... } } }`, the way `Surface.css.ts` does. Do not
declare a new layer per component — every component must emit into the same
`ap.components` layer that `theme.css`'s `@layer ap.tokens, ap.components;` order
statement names, or the cascade guarantee silently breaks.

## The showcase

A small React Router 8 app at `showcase/` that renders every component against the
real generated theme. It is where you look at what you built; it is not a gate.

    npm run showcase:install     # once
    npm run showcase             # dev server
    npm run showcase:test        # the smoke test described below

### Adding a section is one entry and one file

`showcase/app/sections.ts` is the single source of truth. Both the router
(`app/routes.ts`) and the nav bar (`app/root.tsx`) derive from it:

```ts
{ slug: 'dialog', title: 'Dialog', file: 'routes/dialog.tsx',
  blurb: 'Modal surfaces: sizes, the sheet layout, focus handling and motion.' }
```

Add the entry, add `app/routes/<name>.tsx` exporting a default component wrapped in
`<Page slug="…">`, and it appears in the nav, gets a route, and is covered by the
smoke test. Nothing else to wire.

That indirection is the whole design. A showcase whose nav is maintained by hand
drifts from its routes, and once it has lied to you twice nobody trusts it again.
Deriving both from one list makes "the nav advertises a page that does not exist"
and "a page exists that the nav never mentions" unrepresentable.

### Gate 5 lives here too

`npm run test:a11y` runs axe-core over every section, and over two states a page
load cannot reach on its own: an **open** dialog (while closed, the popup is not
in the DOM, so scanning `/dialog` proves nothing about the modal, its focus trap
or the `aria-hidden` treatment behind it) and a field showing an error.

The spec (§7.1) originally put this gate in Storybook. The showcase did not exist
then; it now renders every component and variant in a real browser and is already
walked by a spec, so axe rides along for the cost of one file. The deviation is
recorded in the spec's §9.

**Read the result narrowly.** It proves zero MACHINE-DETECTABLE violations —
roughly 30–40% of WCAG issue types. It cannot tell you whether a label is
meaningful, whether focus order makes sense, or whether an error message is
comprehensible. The manual screen-reader pass per component is still owed. A
green gate named "accessibility" is the most inviting thing in this repository to
over-read.

Each per-page assertion is paired with `expect(results.passes.length)
.toBeGreaterThan(0)`, because a run that checked nothing reports zero violations
exactly like a clean page does.

### What the smoke test does

`showcase/e2e/smoke.spec.ts` walks `SECTIONS` and, for each, asserts the route
returns 200, that the section title is in the **raw server response** (not merely in
the hydrated DOM), that the `<h1>` renders, that the nav marks it current, and that
the page logs no console errors or warnings. Perturbation-proven: making one route
throw fails that route's test and only that one.

It is a smoke test on purpose. What each component *does* belongs in that
component's own tests; this exists so a component that breaks its page fails loudly
instead of rotting unnoticed behind a tab nobody clicked.

### Pages that are generated instead

The colour reference, the size scales and `examples/InputFields.html` are generated
static files, verified by their own browser checks at generation time. Link them
from the showcase rather than reimplementing them — a second copy is a second thing
to keep true.

### `showcase`'s tsconfig pins `react` to one copy of the types

`showcase/tsconfig.json` carries the same `paths` mapping as the two fixtures
(see "Known gaps in Phase 2's gates" for why). `npm --prefix showcase run
typecheck` is a step in the `showcase` CI job.

## Motion

`motion.css` is **no longer optional**, because `Spinner` consumes it — and
through `Spinner`, so does `Input`'s `loading` state. Link it as
`@ap/react/motion.css`, a one-line re-export of `@ap/motion/motion.css` that
exists so an app links the stylesheets of the package it installed:

    import '@ap/react/fonts.css'    // optional — see ADR-0015
    import '@ap/react/theme.css'
    import '@ap/react/motion.css'   // after theme.css

Order matters. `theme.css` carries the `@layer ap.tokens, ap.components;` order
statement that `motion.css`'s own `ap.tokens`-layered custom properties rely on
for cascade position.

Omitting it fails in the worst available way: components declare animation as
`animation: var(--ap-motion-<name>)`, so with no `motion.css` the property
resolves to nothing. There is no error and no console warning — `Input loading`
still renders its spinner, the spinner simply never moves, and the one thing it
exists to communicate is the one thing it stops communicating. Three assertions
in `consumer-build.gate.test.ts` hold that shut: the keyframes reach a real
consumer's bundle, the component stays bound to the `var()` rather than to the
keyframes name, and the `prefers-reduced-motion` override ships with it.

`collapse` and `expand` reference `var(--panel-height)`, which is supplied by
Base UI's primitives in Phase 4. Both motions emit correctly today — the
equivalence and reduced-motion gates cover them like any other motion — but
they cannot be demonstrated end to end until that dependency exists.

## Swapping the icon set for a product's own

`IconProvider` maps our icon names onto a product's own library in one place
(ADR-0012). A product standardised on `react-icons`, Lucide or Phosphor maps
once at the root and never thinks about it again:

```tsx
import { ApProvider } from '@ap/react'
import { FiCheck, FiX, FiChevronDown, FiAlertCircle, FiInfo } from 'react-icons/fi'

<ApProvider icons={{
  check: FiCheck,
  close: FiX,
  'chevron-down': FiChevronDown,
  'alert-circle': FiAlertCircle,
  info: FiInfo,
}}>
  <App />
</ApProvider>
```

Every `<Icon name="check" />` beneath it — including the ones our own
components render internally — now draws the product's icon. The
accessibility contract survives the swap: `Icon` computes `role="img"` +
`aria-label` for a labelled icon and `aria-hidden` + `focusable={false}` for a
decorative one, and passes the same block to an override that it applies to
the built-in. Verified against `react-icons@5.7.0`.

**Sizing needs no adapter, even when the library sizes through its own prop.**
`Icon` never passes `size` as a prop — a named size (`'xs'`…`'2xl'`) resolves
to `var(--ap-icon-<name>)` and a number resolves to `${n}px`, and either way
the result is applied through `style={{ width, height }}`, not a `width`/
`height` attribute. That distinction is what makes the override case work
with zero translation: `<svg width="var(--ap-icon-lg)">` is simply invalid —
an SVG presentation attribute takes a length and never resolves `var()` — so
sizing has to travel as a CSS declaration regardless, and a `style` attribute
always wins the cascade over a presentation attribute set by the same element.

That still holds once the element in question is `react-icons`' own
`<svg>`. Its `IconBase` sets `width`/`height` **attributes** from its own
`size` prop (default `'1em'`), which `Icon` never sends and is silently
ignored — but it also spreads the caller's `style` last into the style object
it builds, so our `style` lands on the rendered `<svg>` either way. Confirmed
by rendering `<Icon name="check" size="lg" />` through an `IconProvider`
mapping `check` to `FiCheck` (`react-icons@5.7.0`) and inspecting the emitted
markup:

```html
<svg ... width="1em" height="1em" style="width: var(--ap-icon-lg); height: var(--ap-icon-lg);" ...>
```

The `width`/`height` attributes are there, inert, and the `style` attribute —
carrying the real token — is what the browser actually uses. No per-library
adapter, no unknown-prop warning (`style` is a real SVG/DOM prop, unlike
`size`), and nothing to write when adding a new icon library: any override
component that accepts `style` sizes correctly by construction.

`IconOverrides`' component type reflects this: it declares `style` (and
`className`, and the aria props), not `width`/`height` — `Icon` never sends
those, so the type doesn't promise them.

**Overriding is not the same as adding.** `IconOverrides` is keyed by
`IconName`, a closed union — a product can replace any icon we ship but cannot
introduce a new name through `IconProvider`. Adding `search` means extending
`ICON_PATHS` in `packages/react/src/icons/paths.ts`, because the names are the
contract our own components call by. Phase 4 ships five on purpose; ADR-0012's
fuller set arrives as components need them, since an icon nothing renders is a
permanent maintenance obligation bought for nothing.

## Known gap: several gates scan raw text, comments included

`style-rules.gate.test.ts` checks its physical-property and focus-removal rules
with substring and regex matches over the whole file, with no comment
stripping. So a `.css.ts` or `.tokens.ts` file **cannot name a forbidden
construct in prose** — a comment reading "use `margin-block-start`, not
`marginTop`" fails the physical-properties rule, and one explaining why a
button does not set `outline: none` fails the focus rule. Both have happened,
in `Field.css.ts` and `Input.css.ts` respectively.

It fails closed, so nothing unsafe ships — but it pushes the reasoning out of
exactly the files that need it, which is the opposite of what this codebase
wants. The workaround is to hyphenate: `margin-top`, `outline-style: none`.

`ssr-safety` has the same shape, and Phase 4d hit it a third time: a doc comment
in `DialogParts.tsx` explaining that a focus trap of our own would compete over
`document.activeElement` failed the `/document\./` rule. The workaround there
is to spell the property access out in prose rather than as code.

The fix is to strip comments before the text scan, or to move these checks onto
the TypeScript AST walk that `collectStyleBlocks` already builds for the `@layer`
rule. Neither has been done yet. Three occurrences across two gates is probably
the point at which it stops being a curiosity and becomes worth doing.

## Known gaps in Phase 2's gates

Phase 2's fixture gates (`test:ssr`, `test:hydration`, `test:consumer`) prove a
real thing: a `file:`-protocol consumer and an RR8 SSR/SPA app build against
our source and ship real compiled component CSS and token custom properties,
not an empty or externalised package.

They do **not** prove the transitive `file:` resolution ADR-0002 relies on —
that an external product vendoring us as a submodule, and declaring only
`@ap/react` as a `file:` dependency, gets `@ap/react`'s own
`"@ap/tokens": "file:../tokens"` dependency installed for it, so it never
has to hand-maintain our dependency list. Both fixtures (`fixtures/ssr-app`,
`fixtures/consumer`) live inside this repository, so npm and Node's module
resolution can and do walk up to the root `node_modules` regardless of what
gets installed under the fixture itself. In this tree,
`fixtures/consumer/node_modules/@ap` contains only `react` and `vite` — no
`@ap/tokens`, and no `@vanilla-extract/*` anywhere in the fixture's
lockfile — yet the build still succeeds, because the root `node_modules`
satisfies everything. A real external consumer, installed outside this
repository tree, would not have that safety net.

This is a known gap, not a defect in the gates: verifying real transitive
resolution would require installing a fixture outside this repository, which
Phase 2 does not do. Until that exists, treat ADR-0002's transitive-resolution
claim as architecturally intended and exercised manually, not as CI-enforced.

### The same nesting put two copies of `@types/react` into every downstream typecheck

Until 2026-09-04, `npm --prefix fixtures/consumer run typecheck` (and the same
command in `showcase` and `fixtures/ssr-app`) reported one error, in
`packages/react/src/components/Field/FieldParts.tsx`, ending in
`Two different types with this name exist, but they are unrelated`. That is the
signature of two copies of `@types/react` in one program: the app's own files
resolve types from its `node_modules/@types/react`, while the `@ap/react`
sources they pull in — and Base UI's declarations — walk up from
`packages/react` and land on the root `node_modules` copy. Same version, both
loaded. TypeScript normally folds identical `name@version` packages into one,
but did not here; `tsc --explainFiles` shows both files in the program, with the
app's copy first registered under a mangled id (`@types/react/ndex.d.ts`, from
`jsx-runtime.d.ts`'s `"./"` import). Whatever the mechanism, `Ref<T>`'s callback
return type is keyed on a `unique symbol`, so the two copies are nominally
distinct and any ref crossing the boundary is refused. `FieldError`'s `render`
function, which spreads Base UI's element props (`ref: Ref<any>`) onto a `<div>`,
was simply the first place they met.

Nothing in `packages/react` is wrong, and a real external consumer never sees
this: the vendored submodule (ADR-0002) has no `node_modules` of its own, so
resolution walks straight into the consumer's single copy.

**Fix, applied to all three downstream tsconfigs:** a `paths` mapping pinning
`react` and `react/jsx-runtime` to the app's own `node_modules/@types/react`.
After it, `--explainFiles` lists no file under the root `@types/react`.

**Perturbation, so the mapping is known not to silence real errors:** with the
mapping in place, a consumer file passing `useRef<SVGSVGElement>` to `Surface`
(which is `forwardRef<HTMLDivElement>`) still fails with the expected
`RefObject<SVGSVGElement | null>` is not assignable to `Ref<HTMLDivElement>`,
and `useRef<HTMLDivElement>` passes. (An `HTMLInputElement` ref also passes —
that is TypeScript's structural typing, not the mapping: an input element has
every member a div element has.)

The typecheck now runs in three places so the gap cannot reopen silently: the
`consumer` CI job's own step, a `typechecks against our source` assertion inside
`test:consumer` (so the local gate checks what CI checks — it did not before, which
is why this was first seen on GitHub), and new `typecheck` steps in the `ssr` and
`showcase` CI jobs.

## Base UI's `render` prop and the `nativeButton`/anchor-role trap

`Button.tsx` wraps `@base-ui/react/button`. Base UI's `useButton` hook
(`node_modules/@base-ui/react/internals/use-button/useButton.mjs:177-181`)
forces `role="button"` onto whatever element it renders whenever
`nativeButton` is false, and `useFocusableWhenDisabled`
(`node_modules/@base-ui/react/utils/useFocusableWhenDisabled.mjs:26-27`)
unconditionally forces `tabIndex={0}` on any non-composite item, native or
not. Neither is configurable through a documented Base UI prop.

That is the correct default for Base UI's model — a `Button` is
semantically a button no matter what tag `render` swaps in, so a `<div>` or
`<span>` standing in for one needs a synthesized role and explicit
focusability. It is the wrong default for a `render` element that is
already a real link (`<a href>`, or a router's `<Link>`): the element
already carries an implicit `role="link"` and is already focusable, so both
forced attributes are redundant at best and actively wrong under WCAG 4.1.2
at worst — assistive tech announces "button" for something that navigates
rather than acting in place, while a sighted user gets ordinary link
behaviour (middle-click, right-click-copy-link, browser history).

**The escape hatch.** Base UI's prop merge
(`node_modules/@base-ui/react/merge-props/mergeProps.mjs:120-149`) resolves
conflicting keys with `Object.assign` semantics — rightmost object wins —
using `for...in`, which visits a key even when its value is `undefined`, so
long as the key is present. `useFocusableWhenDisabled.mjs`'s own comment
("we can't explicitly assign `undefined` to any of these props because it
would otherwise prevent subsequently merged props from setting them")
confirms this is the intended way to win the merge, even though nothing in
Base UI's public API surfaces it as a documented feature. `Button.tsx`
passes `role={undefined}` and `tabIndex={undefined}` alongside
`nativeButton={false}` whenever the `render` element carries a non-empty
`href` or `to` prop — see the prop-based detection note below for why that
is the test rather than the tag — and that lands in `otherExternalProps`, the rightmost
argument to the internal `mergeProps` call, and wins before Base UI's
`useRenderElement` ever merges in the `render` element's own props. The
result: `<Button render={<a href="/x" />}>` now emits a plain `<a href="/x">`
with no `role` and no `tabindex` attribute at all — implicit link semantics,
exactly as if the anchor had been written by hand.

**Detection is prop-based, not tag-based.** A `render` element's tag is not
knowable ahead of time when `render` is a component rather than a host
element — ADR-0011 §3's own canonical example,
`<Button render={<Link to="/employees/42" />}>`, names exactly this case,
since `<Link>` is opaque: its `to` prop says nothing about what tag it will
ultimately render. Executing the component early to peek at its output
would run its hooks outside React's render cycle; inspecting the committed
DOM node after mount would require a ref/effect, and until that runs, an
SSR'd page would still carry the wrong role — which is precisely the class
of failure progressive enhancement (see "Uncontrolled-first forms" in
[ADR-0011](adr/0011-component-api-conventions.md) §4) exists to avoid.

So `Button.tsx` inspects `render.props` instead of `render.type`: a
non-empty `href` or `to` prop marks the element as a navigation target,
whatever component produced it. `href` catches a literal `<a href>` and any
router `Link` that forwards that name straight through; `to` catches React
Router's `Link` by name, since that is the component ADR-0011 uses in its
own example. Both `<Button render={<a href="/employees/42" />}>` and
`<Button render={<Link to="/employees/42" />}>` are now automatic — no
override needed on the consumer's own element for either.

This is a prop-name heuristic, not a dependency on react-router: `@ap/react`
still imports nothing from `react-router`, and the ssr-safety gate
(`packages/react/src/gates/ssr-safety.gate.test.ts`) fails the build if that
ever changes.

**The residual escape hatch.** A router whose link component names its
destination prop something other than `href` or `to` won't be
auto-detected. That consumer adds the same `role`/`tabIndex` override
directly on their own `render` element:

```tsx
<Button render={<Link go="/employees/42" role={undefined} tabIndex={undefined} />}>
  View employee
</Button>
```

This works for the same reason the wrapper's own fix does: an element's own
props are the rightmost argument to the final `mergeProps(props,
render.props)` Base UI runs in `useRenderElement.mjs` right before cloning
it, regardless of whether that element's type is a host tag or a component.
In short: `href`/`to` props are handled automatically; any other
destination-prop name needs this manual override.

**For future components.** Any Base UI part that accepts `render` and has
its own notion of a forced role or tabindex (`Toolbar.Button`,
`Menu.Item`\* rendered through a different tag, etc.) can hit the same
mismatch the moment `render` supplies a real navigational anchor. Check
whether the part's underlying hook forces attributes unconditionally the
way `useButton`/`useFocusableWhenDisabled` do, and if so, apply the same
`{ role: undefined, tabIndex: undefined }` override for the literal-anchor
case rather than assuming Base UI's default is always right.

## Base UI's Field discards a caller-supplied `id` from server markup

**A caller-supplied `id` on a control inside a `Field` is not in the
server-rendered HTML.** The control ships with a generated `base-ui-…` id
instead, and only becomes the id you asked for after hydration. The id
*changes* at hydration.

The mechanism is two hooks that disagree about when the id is known.
`LabelableProvider` (`internals/labelable-provider/LabelableProvider.mjs`)
seeds its `controlId` state from its **own** `useBaseUiId()` on first render:

```js
const defaultId = useBaseUiId();
const initialControlId = props.controlId === undefined ? defaultId : props.controlId;
const [controlId, setControlIdState] = React.useState(initialControlId);
```

The control's own `useLabelableId`
(`internals/labelable-provider/useLabelableId.mjs`) returns
`controlId ?? defaultId` — the provider's value, first — and registers the
caller's explicit `id` only from inside a `useIsoLayoutEffect`, which is a
no-op on the server. So the server renders the provider's generated id; the
first client effect registers the real one; the DOM id then changes.

This is not a hydration mismatch — the client's first render agrees with the
server, and the swap happens afterwards — so nothing warns about it.

**What this means in practice.** Never write a test, a script, or a
server-side integration that locates a `Field`'s control by a caller-supplied
`id` before hydration: the id genuinely is not there. Locate it by its label
(`getByLabelText`, `label=` in Playwright), which is derived during render and
so is present in the server response. `fixtures/ssr-app/e2e/progressive-enhancement.spec.ts`
does exactly this: every pre-hydration interaction goes through the label, and
`#email-input` is used only after the page reports hydration is complete.

The same reasoning applies to `aria-describedby`, for the same reason one hop
further: `Field.Description` and `Field.Error` register their ids from a layout
effect too, so the attribute is absent from the server response and appears
after hydration. `ssr-render.gate.test.ts` asserts the label→control pairing
against server markup and deliberately does not assert `aria-describedby`.

## `@base-ui/react` left external in an SSR build loads a second React

**Symptom:** an SSR build that succeeds, then dies at request time with

```
TypeError: Cannot read properties of null (reading 'useId')
```

thrown from `@base-ui/utils/useId.mjs`. Reading a property of `null` inside a
hook is React's dispatcher being null — the signature of **two physical copies
of React in one process**, where a component renders through one copy while
the renderer is driving the other.

**Cause.** `@base-ui/react` is a dependency of `@ap/react`, a workspace
package, so npm hoists it to the repository **root** `node_modules` and never
installs it under a nested app's own. `@ap/vite` bundles `@ap/react`'s source
into the server build, but that source's `import … from '@base-ui/react/…'` is
left as a plain external import, resolved at *runtime* relative to the built
server file. From a nested app's `build/server/`, that resolution walks up to
the root `node_modules` and finds the root's `react`. Every other external
`react` import in the same built file resolves from the nested app's own
`node_modules`. Two copies load, and Base UI's `useId` — reached through
`Field`, `Input` or `Button` — reads a null dispatcher from whichever one is
not currently rendering.

**Fix:** `ssr: { noExternal: ['@base-ui/react', '@base-ui/utils',
'use-sync-external-store'] }` in the app's own `vite.config.ts`. All three
entries are needed, and each was found the same way — by a component reaching
one hop further into Base UI's dependency chain than the last one did:

| Package | Found by | Symptom |
|---|---|---|
| `@base-ui/react` | Button/Field/Input | `Cannot read properties of null (reading 'useId')` |
| `@base-ui/utils` | the same, one hop down — `useId.mjs` actually lives here | identical |
| `use-sync-external-store` | **Dialog**, the first component with a Base UI *store* | `Cannot read properties of null (reading 'useSyncExternalStore')` |

The third is the instructive one. `/form` kept working the whole time, because
Field and Input reach Base UI through `useId`, which was already bundled;
`/dialog` returned a 500 while every other route returned 200. The built server
file had `import { useSyncExternalStore } from "use-sync-external-store/shim"`
as its own external import, that package `require`s `react` and resolves it from
the ROOT `node_modules`, and the second React reported a null dispatcher.

**The general rule:** every package in Base UI's dependency chain that imports
React must end up in the same bundled chunk. A new Base UI component that pulls
in a new React-importing transitive dependency will need a fourth entry. The
symptom is always a null hook dispatcher, and the diagnosis is always to grep
the built `build/server/index.js` for top-level `import` statements naming a
package that lives only in the root `node_modules`.

**This is a monorepo-nesting artifact, not a consumer problem.** It happens
because `fixtures/ssr-app` is a non-workspace app sitting *inside* the
workspace, so its dependency resolution straddles two `node_modules` trees. A
product that installs `@ap/react` from a registry gets `@base-ui/react` under
its own `node_modules` like any other transitive dependency, with one `react`
in scope, and never sees this. That is why the fix lives in the fixture's
`vite.config.ts` and **not** in `@ap/vite`: putting it in the plugin would
force every consumer to bundle Base UI to work around a problem only this
repository has.

## Known caveats

### Windows drive-letter casing breaks vanilla-extract silently

Both fixtures set a `win32`-only `resolve: { preserveSymlinks: true }` in
their `vite.config.ts`. This works around a drive-letter casing artifact seen
on some Windows checkouts: when the OS-reported real path of a symlink
differs in drive-letter casing from the path other tools use (for example
`D:\DEV` vs `D:\dev`), `@vanilla-extract/vite-plugin` silently loses track of
the `.css.ts` modules it compiled.

The symptom is not a build failure. The build succeeds, hashed vanilla-extract
classnames appear correctly in the JS, but the component CSS behind those
classnames never reaches the stylesheet — the app ships unstyled. Both
fixtures hit this independently on at least one development machine. The
gates in this repo are designed to fail loudly on it (they assert the actual
compiled CSS rules exist in the served/bundled output, not just that a
build produced *some* CSS file), so if you see a fixture gate fail on a rule
like `--ap-surface-bg-canvas` being missing from otherwise-successful output,
suspect this before suspecting the gate.

### `vitest.gates.config.ts`

`npm test` (via `vitest.config.ts`) deliberately excludes
`ssr-render.gate.test.ts` and `consumer-build.gate.test.ts`. Those two gates
build entire fixture applications and, for the SSR gate, boot a real server —
minutes of work each — and CI's `unit` job never installs fixture
dependencies, so those files would fail there for the wrong reason. They run
instead through `vitest.gates.config.ts`, a separate config with no such
exclusion, via `npm run test:ssr` and `npm run test:consumer`. The `consumer`
and `ssr` CI jobs install their fixtures first and then run these scripts
directly. Keep both config files in sync if the gate filenames ever change.

### React Router 8 behaviours the SSR fixture depends on

Three RR8 behaviours shape how `fixtures/ssr-app` and its gate are written, and
each one silently invalidated an assertion before it was understood: Node's
`fetch()` is classified as a bot and so never receives a streamed response; a
fixed gate port lets a leaked server answer for a build you did not make; and an
SPA-mode build renders root's `HydrateFallback` rather than root itself, so its
shell legitimately contains no stylesheet link. See
[`rr8-fixture-notes.md`](./rr8-fixture-notes.md) before changing an assertion in
`ssr-render.gate.test.ts`.

### Gate 5 runs inside the story run

Axe runs as part of `test:stories` via `@storybook/addon-a11y`, configured with
`parameters.a11y.test: 'error'` so a violation fails the run rather than
warning in the UI. The tag set is `wcag2a, wcag2aa, wcag21a, wcag21aa`, the
same set the retired showcase spec used.

This was proven to fail, not assumed: a story rendering `<button type="button" />`
with no accessible name produces `button-name (critical)` and fails the run.
A mechanism that checks nothing reports success exactly like a clean run, so
re-prove it the same way if the wiring is ever touched.

The order inside `setProjectAnnotations` in `vitest.setup.ts` is load-bearing.
`@storybook/addon-a11y/preview` ships its own default parameter,
`a11y.test: 'todo'`, and Storybook's merge takes whichever entry is listed
last when two sources conflict. The addon's annotations must come first and
the project's `preview` must come last, so `'error'` wins. Get that order
backwards and nothing errors, nothing warns, and every story still passes —
the gate silently stops checking anything while looking exactly like a clean
run.
