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
| `npm run test:stories` / `npm run test:a11y` | Gate 4/5: every story and its `play` function in headless Chromium, with axe running inside the same run. The two commands are aliases of each other |
| `npm run report:contrast` | Writes `reports/contrast.md` (the WCAG compliance artifact) |
| `npm run gen:scale-demo` | Recaptures `examples/scales/` screenshots and prints the measured size table |
| `npm run gen:colour-demo` | Regenerates `examples/colours/index.html`, verifies it in both schemes, recaptures screenshots |
| `npm run gen:input-demo` | Regenerates `examples/InputFields.html` — renders the real components, compiles their real CSS, reads every code sample out of the AST, then runs six browser checks |
| `npm run showcase` | Builds and serves the showcase app — every component, server-rendered, in both schemes |
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
- Every new `*.tokens.ts` must be added to `TS_EXEMPTIONS` in
  `packages/react/src/gates/use-client.gate.test.ts` — a `.tokens.ts` module is
  pure data with nothing to hydrate, but the gate does not know that unless
  told. The entry must use the `join(SRC, 'components', '<Name>',
  '<Name>.tokens.ts')` form; a bare relative-path string matches nothing,
  because the gate builds a `Set` from `e.path` and filters full paths out of
  `sourceFiles(SRC)`. A further test in the same file asserts every exemption
  path resolves with `existsSync`, so a stale or misspelled entry fails loudly
  rather than silently under-covering.
- There is no jest-dom in this repo. `@testing-library/jest-dom` is not a
  dependency and `vitest.setup.ts` imports no matchers, so `toHaveAttribute`
  and its relatives do not exist — use plain DOM assertions
  (`el.getAttribute('aria-checked')`, `el.disabled`) instead. `Input.test.tsx:139`
  carries a comment saying so, and it is still easy to miss the first time.
- Pseudo-element, pseudo-class and attribute-state rules go inside a
  `selectors: { … }` block with `&`-prefixed keys, the way `Input.css.ts:31`
  does — a bare `':hover'`-style key at the top level of a `@layer` block does
  not typecheck.
- A transition or animation duration is a token — `vars.duration.fast`, never
  a literal — and that is not just style. `theme.css:418-425` redefines every
  `--ap-duration-*` token to `1ms` under `prefers-reduced-motion: reduce`, so a
  token-based duration is suppressed automatically with no media query of its
  own; a hardcoded duration keeps animating for a user who asked the system
  not to. `Switch`'s thumb transition (`Switch.css.ts`) is the worked example.
- Scope an SSR assertion to the specific markup it means to check, not to the
  whole response string. `expect(html).toContain('checked')` can never fail on
  a `Checkbox` or `Switch`, because `aria-checked` renders unconditionally and
  the attribute *name* itself contains the substring `checked`. Extract the
  tag first, assert a full attribute value (`aria-checked="true"`), or assert
  differentially between two renders. This produced a false-positive test
  twice in Phase 5b, in `Checkbox.ssr.test.tsx` and `Switch.ssr.test.tsx`.
- Set `boxSizing: 'border-box'` explicitly in every recipe's base layer, the
  way `Input.css.ts:22`, `Surface.css.ts:10`, `Dialog.css.ts:46` and
  `Button.css.ts:10` all do. There is no global box-sizing reset anywhere in
  `packages/react/src/theme`, so a recipe that omits it inherits the
  browser's `content-box` default. Nothing catches the omission — no gate in
  `packages/react/src/gates/` or `packages/tokens/src/gates/` mentions
  `boxSizing`, and no test fails — it shows up only as an element quietly
  rendering wider than its container once padding or a border is added, so
  copy it from `Input.css.ts` deliberately rather than trusting that you'll
  notice its absence.
- Every form control's Tier 3 tokens follow the shared contract in spec
  §4.1.10 — `border`, `borderHover`, `borderInvalid`, `focusRing` and
  `radius`, each with its own Tier 2 fallback and the rule it serves. A new
  component's plan lists only the roles *beyond* that shared set, not the
  whole set again.
- A control that a native `<label>` must not label (Select's trigger — a
  `<button role="combobox">`, into which a native label would forward its
  click and hover — is the one that exists today) opts into `Field`'s label protocol instead of a native
  `<label for>`: carry `[NON_NATIVE_LABEL]: true` as a static property on the
  component (`Field/nonNativeLabel.ts`), and add a story that shows the
  hand-assembled parts wiring the id itself (`Select.stories.tsx`'s
  `HandAssembled`). See "The non-native-label protocol" below.
- A component generic over a type parameter needs its story's `meta.component`
  set to an **instantiation expression** (`Select<string>`), not the bare
  generic component — `satisfies` only validates and never narrows a
  property's own recorded type, so a bare `component: Select` leaves
  `StoryObj`'s inferred `Args` carrying unresolved type parameters. `Select`
  is the first generic component with stories; `Select.stories.tsx`'s `meta`
  is the worked example.

- **A story file**, `<Name>.stories.tsx`, beside the component. Controls for
  every union prop, one story per meaningful state, and a grid story rather
  than one story per cross-product combination. `play` functions assert the
  contract the component was built for, not merely that it rendered. This is
  where the component gets looked at and reviewed — Storybook is the gallery
  now, not the showcase.

- **A showcase section** — renders only, no prose. It exists to prove the
  component server-renders in a real browser, not to be browsed or reviewed;
  that job now belongs to the story file above. It is one entry in
  `showcase/app/sections.ts` and one route file — see "The showcase" below.
  The smoke test walks that list, so the new page is covered the moment it is
  added. Prose belongs in a Storybook MDX docs page.

Import the shared `componentsLayer` from `packages/react/src/theme/layers.css.ts` and
wrap every style object (base, each variant, each compound variant) in
`{ '@layer': { [componentsLayer]: { ... } } }`, the way `Surface.css.ts` does. Do not
declare a new layer per component — every component must emit into the same
`ap.components` layer that `theme.css`'s `@layer ap.tokens, ap.components;` order
statement names, or the cascade guarantee silently breaks.

## The showcase

The showcase is an SSR smoke harness, not a gallery. It server-renders each
component through a real React Router 8 pipeline and Playwright checks the
response, hydration and console. Storybook is the gallery: stories, controls,
interaction tests, axe, and the MDX docs pages.

    npm run showcase:install     # once
    npm run showcase             # build + serve (no HMR — re-run after an edit)
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

### Gate 5 no longer lives here

`npm run test:a11y` does not touch the showcase. Phase 4e put gate 5 here
temporarily because Storybook did not exist yet, running axe-core over every
section plus two states a page load cannot reach on its own — an **open**
dialog and a field showing an error. Phase 5a closed that deviation: axe now
runs inside the story run (see "Gate 5 runs inside the story run" below), and
the open-dialog and error-field states are covered by dedicated stories
(`Dialog`'s `OpenForA11yScan`, `Field`'s `WithError`) instead of showcase
routes. `npm run test:a11y` is now an alias for `npm run test:stories`.

That is only the half of the move that gained coverage. Five showcase routes
lost it: `foundations`, `typography`, `colour`, `theming` and `icons` are now
Storybook MDX documentation pages, and MDX docs pages are never
accessibility-scanned — axe runs over stories, not docs. Those five pages
are gone from `test:a11y`'s reach and nothing replaces that scan. This is an
accepted trade, not an oversight: gate 2 (`test:contrast`) independently
checks every Tier 2 semantic pairing in both light and dark, which is the
largest single thing those pages were demonstrating, and the components
whose stories those pages merely narrated (`Icon`, the type scale, the
colour scale) are still exercised through their own component stories where
they exist. What is genuinely lost is any machine check on the prose pages
themselves — heading structure, link text, and the rest of what axe would
have caught incidentally by scanning a page that happened to contain them.

**Read the result narrowly, wherever it runs.** It proves zero
MACHINE-DETECTABLE violations — roughly 30–40% of WCAG issue types. It cannot
tell you whether a label is meaningful, whether focus order makes sense, or
whether an error message is comprehensible. The manual screen-reader pass per
component is still owed. A green gate named "accessibility" is the most
inviting thing in this repository to over-read.

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

## The read-only trap: `Checkbox`/`Switch` cannot refuse an edit before hydration

**Base UI does not put `readOnly` on the hidden `<input>` of `Checkbox` or
`Switch`.** `CheckboxRoot.js:189-203` builds `inputProps` with no `readOnly`
key at all, and `SwitchRoot.js`'s equivalent object (`:149-161`) is the same.
Read-only is enforced only inside handlers — `CheckboxRoot.js`'s `onChange`
guard at `:209-212` and its `onClick` guard at `:328`, `SwitchRoot.js` at
`:167` and `:138` respectively — each an `if (readOnly) { event.preventDefault(); return }`.
`aria-readonly` lands on the visible `<span role="checkbox">`/`<span
role="switch">`, not on the input (`CheckboxRoot.js:269`, `SwitchRoot.js:118`).

Read as "enforced client-side only," that much is correct, but it understates
who can actually reach the input. The hidden input is `tabIndex: -1`,
`aria-hidden: true`, and styled with `visuallyHiddenInput`
(`@base-ui/utils/visuallyHidden.js` — `position: absolute`, a 1px square,
`clipPath: inset(50%)`), so nothing about the input itself is reachable by
tab or click before hydration, and the visible `<span>` does nothing without
JavaScript either. "A read-only checkbox is fully toggleable pre-hydration"
overstates it — through the input or the span, nothing is operable yet.

The mutation path that genuinely is open is the **wrapping `<label>`.**
`Checkbox.tsx` and `Switch.tsx` both wrap the control and its visible text in
a `<label>`, and native label-to-input click forwarding is a browser
behaviour: it needs no JavaScript, and it ignores `aria-hidden` and
`tabIndex: -1` on the input it targets. So before hydration, clicking the
label text toggles the input and posts the new value even when `readOnly` is
set — the handler that would have called `preventDefault` does not exist yet.

**And getting Base UI to render `readOnly` would not close that path, so do
not reach for it as the fix.** Per the HTML Living Standard, the `readonly`
attribute applies only to the text-like input types; on `type="checkbox"` and
`type="radio"` it is **inert**. Base UI's own component set demonstrates this
directly: `RadioRoot.js:170` *does* pass `readOnly` straight into
`inputProps`, and a radio option is still fully mutable by label-click before
hydration. The missing attribute on Checkbox and Switch is a cosmetic
inconsistency between three sibling components, not the cause of anything.

The real conclusion is stronger, and it is what makes the API decision below
inevitable rather than merely cautious: **no HTML attribute can make these
controls read-only before hydration.** The only attribute that stops a
pre-hydration edit is `disabled`, and a disabled control is dropped from form
submission entirely — which is exactly the trade
[ADR-0011 §6.5](adr/0011-component-api-conventions.md) refuses. There is no
third option to find.

So ADR-0011 §6.5's guarantee — a pending control stays submittable and
refuses edits — **does not hold for `Checkbox` and `Switch` pre-hydration**,
and cannot be made to. That is why neither has a `loading` prop.
`Switch.tsx` carries a short doc-comment version of this above the component;
the mechanism above is the full version, and the line numbers are what to
re-check the next time Base UI is upgraded.

It is worth naming the tension this creates with what gate 6 actually proves
for these two controls: gate 6's guarantee is that their *default* value
posts without JavaScript, not that a no-JS user can operate them — the
operable element is the `<span>`, and it does nothing pre-hydration. The
label-forwarding path above is the one exception to that: it is the one way a
no-JS user can change the value at all, and there is no attribute that can
stop them without also dropping the field from the post.

## The `Field.Item` id-collision rule

Without one `Field.Item` per option, every control inside a single
`Field.Root` resolves to the same generated id. The id comes from a
`LabelableProvider`, and `FieldItem.js:48` wraps each item's children in a
**fresh** one — that is what gives each option its own id scope instead of
inheriting the root's single one. Skip the wrapper and every option's hidden
input gets the same `base-ui-…` id: duplicate DOM ids across the whole group.

The wrapper looks redundant — a `<div>` around each option, adding no visible
markup — and it is not. `RadioGroup.test.tsx`'s `'gives every option a
distinct id, which one Field.Item per option is what buys'` is the test that
catches its removal: it asserts `new Set(ids).size` is `3` for three options,
and fails with `expected 1 to be 3` the moment `Field.Item` is swapped for a
plain `<div>` — the perturbation this was actually verified against.

## Nesting a `RadioGroup` inside a consumer's own `Field.Root` is silently shadowed

`RadioGroup` mounts its own internal `Field.Root` — it has to, since
`Field.Item` and `Field.Description` throw "FieldRootContext is missing" with
no ancestor `Field.Root`, and `RadioGroup`'s parts have to work standalone.
`FieldRoot.js:147` provides the field context and `:161` provides a
`LabelableProvider`, both fresh at whichever `Field.Root` is nearest — so an
inner root **shadows** an outer one entirely; it does not merge with it.

Consequence for a consumer who writes `<Field.Root name="contact">
<RadioGroup name="contact" ... /></Field.Root>`: the outer `name` is ignored
(the group posts under its own `name` prop instead), an outer `Field.Label`
does not name the group, and an outer `Field.Error` never sees the group's
validity. Base UI exports no hook to detect an ancestor `Field.Root`, so
there is no clean fix from inside `RadioGroup` — which is exactly why this
needs writing down rather than coded around.

Validity is the one part of this that *is* fixed rather than documented:
`RadioGroupRootProps` takes an `invalid?: boolean` that is forwarded to the
internal root, because the alternative was a styled `[data-invalid]` rule and
an exported `RADIO_GROUP_TOKENS.borderInvalid` that no consumer could reach at
all. `name`, an outer `Field.Label` and an outer `Field.Error` have no such
passthrough, and shadowing is the whole story for those three.

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

## `Select`'s object values render as JSON when the default is rebuilt

**A `defaultValue` (or `value`) that is an object renders in the trigger as its
`JSON.stringify`'d form** — `{"code":"ca","name":"Canada"}` — unless the
consumer supplies `itemToStringLabel`/a lookup of their own, even with `items`
and `itemToStringValue` both supplied. The mechanism is Base UI's own label
resolution, `resolveSelectedLabel`
(`node_modules/@base-ui/react/internals/resolveValueLabel.js`), which
`Select.Value`'s default (no-children-function) rendering calls: it matches an
object value against `items` only by an explicit `label` key on the value
itself, or by finding an item whose `.value` **is** the value's own `.value`
property (`=== `, not deep equality). A plain data object with neither of
those shapes — `{ code: 'ca', name: 'Canada' }` has no `.value` key at all —
falls through to `stringifyAsLabel`, which serialises it. This is a real
regression risk: a `defaultValue` reconstructed from a server response on
every render is a *new* object every time, so identity-only matching paths
are the common case, not an edge case.

**`Select`'s convenience component (`Select.tsx`) never lets Base UI's
resolution run.** It always passes `Select.Value` a children *function*
that looks up the label itself, from the same `options`/`itemToStringValue`
the caller supplied (`findLabel` in `selectItems.ts`, keyed by serialised
value) — so `resolveSelectedLabel` is simply never reached for anything built
through `<Select options={…} />`. This only matters when assembling the parts
by hand: a hand-written `<Select.Value />` with no children function is
exposed to the JSON-rendering behaviour above.

**One consequence of that workaround is itself a trap.** `Select.Value` never
falls back to its own `placeholder` prop when `children` is a function
(`select/value/SelectValue.js`) — the function branch is checked first and
always wins, so a children function that returns `undefined`/`null` renders
nothing, not the placeholder. `Select.tsx`'s `renderValue` function returns
the placeholder itself when nothing is selected, for exactly this reason; a
hand-written children function must do the same. A value that matches no
option is a different case: it still posts, so `renderValue` shows it
serialised (`itemToStringValue`) rather than as the placeholder.

## `Field.Label`'s `nativeLabel={false}` still renders a `<label>`

**Setting `nativeLabel={false}` alone does not change the rendered tag.**
`FieldLabel.js` (`node_modules/@base-ui/react/field/label/FieldLabel.js`)
always renders through `useRenderElement('label', componentProps, …)` —
`'label'` is the element's own default tag, unconditionally. `nativeLabel`
only changes two things: the `native` flag passed into Base UI's internal
`useLabel` hook (which governs click-forwarding/association behaviour) and
which half of a development-mode consistency warning fires. Setting
`nativeLabel={false}` with no `render` override therefore renders a real
`<label>` that Base UI now treats as non-native — the exact mismatch its own
dev warning exists to catch. The only way to get a non-`<label>` element is
`render={<div />}` (or another non-label element), and the two props have to
be set together: `nativeLabel={false}` **and** `render={<div />}`.

## The non-native-label protocol

`Select`'s trigger is a `<button role="combobox">`. A `<button>` is
labelable, and Base UI wires a native `<label for>` to it correctly, so
association is not the problem. The problem is what a native label does to
the element it labels (spec §4.3): a click on the label is forwarded to the
button, which opens the popup, and hovering the label puts the button in
`:hover`. A Select's label should do neither. `Field` (`Field.tsx`) and
`Select` (`Select.tsx`) implement a small protocol that labels it with a
`<div>` and `aria-labelledby` instead, in `Field/nonNativeLabel.ts`:

- **The marker.** A control opts in by carrying a static
  `[NON_NATIVE_LABEL]: true` property on its component function —
  `Object.assign(SelectBase, { [NON_NATIVE_LABEL]: true })` is how `Select`
  does it. The symbol itself is `Symbol.for('ap.field.nonNativeLabel')` —
  the global registry, not `Symbol()` — deliberately, so the marker still
  matches if `@ap/react` ever ends up duplicated across two bundled copies
  (the same failure shape as the two-React-copies trap above).
- **What `Field` does when it sees the marker on its direct child**
  (`usesNonNativeLabel`, checked against `children.type`): it renders
  `Field.Label` with `nativeLabel={false}`, `render={<div />}` and an
  explicit `id`, instead of its ordinary single `<label>`, and clones the
  child with `aria-labelledby` set to that same id — unless the child
  already carries its own `aria-labelledby`, which wins. Only a **direct**
  child is detected; a Select wrapped inside a consumer's own component is
  invisible to this check, which is why `Select` also carries a
  development-only fallback: it reads the trigger button's own `.labels`
  (the DOM's built-in list of the `<label>`s that label it, by `for` or by
  wrapping it) and warns if it is non-empty, naming the fix in the message.
  The check is guarded by a bare `process.env.NODE_ENV !== 'production'`
  (`Select.tsx`), spelled as Base UI spells it (`field/label/FieldLabel.mjs`).
  Never add a `typeof process` guard: bundlers replace
  `process.env.NODE_ENV` but leave `typeof process` alone, and in a browser
  `process` is undefined, so that guard silently disables the warning in
  every client bundle. The `NativeLabelWarning` story catches it in a real
  browser; the jsdom unit test cannot.
- **Why the id is generated explicitly, in `Field`, with `useId()`, rather
  than left for Base UI to register.** Base UI registers the label's id
  from a layout effect (`useRegisteredLabelId`), which does not run during
  SSR, and the trigger reads its `aria-labelledby` from that registration.
  So without an explicit id, both are absent from server-rendered HTML, and
  a `<div>` label has no native `for` to name the trigger instead.
  This is R16's move (5b plan, "Deviations", corrected), copied here for the
  same reason: generating the id up front and passing it to both the label
  and the control closes that gap. **Its rationale is narrow, and stated
  that way on purpose: this buys a named control in streamed and
  pre-hydration markup for assistive technology. It does not make the
  control operable with JavaScript off** — `Select`'s popup still needs
  hydration to open at all, regardless of whether its trigger has a name.
- **What a hand assembly must write.** Anyone building a Select from the
  compound parts instead of `<Field label>` reproduces the three steps by
  hand: generate one id, pass it as `id` on a `<Field.Label nativeLabel={false}
  render={<div />}>`, and pass the same id as `aria-labelledby` on
  `<Select.Trigger>`. `Select.stories.tsx`'s `HandAssembled` story is the
  worked example.

## `Select`'s `onFocus`/`onBlur` track focus within the trigger and the popup

`Select` (`Select.tsx`) gives the consumer's `onFocus`/`onBlur` focus-within
semantics over the trigger and the popup's positioner together: `onFocus`
fires when focus enters either from outside, `onBlur` when it leaves both —
from the trigger, or from inside the open popup (Tab out of the list, a press
on another control). Moves between the two, as on open and close, fire
neither. Base UI's own trigger blur fires as opening moves focus into the
listbox, and Base UI merges a consumer handler after its own
(`trigger/SelectTrigger.mjs`), so an unfiltered `onBlur` would mark a form
field touched the moment it opened, and would never see an exit made from
inside the popup. The containment element is the **positioner**, not the
popup: Base UI's focus guards sit inside the positioner beside the popup, and
Tab out of the list passes through them. `Select.Popup`'s `positioner` option
takes the positioner's `ref`, `onFocus` and `onBlur` for this.

Two Chromium facts shape it (the `FocusWithin` story, which jsdom cannot
replace): a focus guard moves focus on from inside its own focus handler, so
its blur arrives before its focus has bubbled, and a focus whose
`relatedTarget` is inside the control is never an entry; and a press on
non-focusable space outside the open popup blurs the item with a `null`
`relatedTarget` before Base UI returns focus to the trigger, so a `null` blur
from inside the popup is not an exit (a `null` blur from the trigger is). A
hand assembly passing `onBlur` to `Select.Trigger` gets Base UI's unfiltered
event.

**`Select`'s `id` goes to the trigger, not the root.** Given to `Select.Root`
inside a `Field`, the caller's id never lands at all, not even after
hydration: the trigger registers the provider's generated id with the
labelable provider before the root registers the caller's, and
`LabelableProvider` keeps the id it already has. `Select.Trigger` renders an
`id` it is given directly, so it is in the server HTML too — the exception
to the section on `Field` discarding a caller-supplied id above.

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

The `storybook` project in `vitest.config.ts` deliberately has no `setupFiles`.
Since Storybook 10.3 `@storybook/addon-vitest` composes the preview annotations
itself — `preview.tsx` plus every addon's own preview, addon-first — and that
order is load-bearing: `@storybook/addon-a11y/preview` ships a default
`a11y.test: 'todo'`, and Storybook's merge takes the last conflicting entry, so
`preview.tsx`'s `'error'` only wins by coming after it. The addon gets that
right; a hand-written `setProjectAnnotations` call in a setup file does not
have to. Worse, the plugin *skips* its own provisioning entirely the moment it
finds a setup file at `configDir` containing the string
`setProjectAnnotations` (`requiresProjectAnnotations`, in the plugin's
`vitest-plugin/index.js`), so a hand-rolled file silently owns the whole wiring.
Do not add one. Whatever the wiring, a gate that checks nothing reports success
exactly like a clean run — re-prove it with the nameless button above.
