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
| `npm run test:gates` | Token, contrast, gamut, sweep, freshness, guard, contract and motion gates |
| `npm run test:motion` | `@ap/motion`'s own suite: unit tests plus its equivalence, reduced-motion, freshness and isolation gates |
| `npm run gen:motion-css` | Regenerates `packages/motion/src/motion.css` from `motions.ts` |
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
| `packages/motion/src/motion.css` | `npm run gen:motion-css` |

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

## Adding a component

Copy the shape of `packages/react/src/components/Surface/`: a `.tsx` module with
`'use client'`, a `.css.ts` recipe, a `.tokens.ts` file declaring the Tier 3 override
surface, a test, and an `index.ts`. Nothing else in the tree needs to change.

Import the shared `componentsLayer` from `packages/react/src/theme/layers.css.ts` and
wrap every style object (base, each variant, each compound variant) in
`{ '@layer': { [componentsLayer]: { ... } } }`, the way `Surface.css.ts` does. Do not
declare a new layer per component — every component must emit into the same
`ap.components` layer that `theme.css`'s `@layer ap.tokens, ap.components;` order
statement names, or the cascade guarantee silently breaks.

## Motion

`@ap/motion/motion.css` is opt-in — nothing in `@ap/react` imports it, and no
component in this repo consumes `@ap/motion` yet. A consumer that wants it must
import it **after** `@ap/react/theme.css`, because `theme.css` carries the
`@layer ap.tokens, ap.components;` order statement that `motion.css`'s own
`ap.tokens`-layered custom properties rely on for cascade position.

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

**The `size` trap, if the library sizes through its own prop.** The mapping
above renders, and its ARIA is correct, but `size` is silently ignored — every
icon comes out at `width="1em" height="1em"` regardless of what you pass.
`react-icons`' `IconBase` applies its own `height`/`width` **after** spreading
the caller's props, computed from *its* `size` prop, which `Icon` does not
send. Nothing errors; the icons are just the wrong size.

`Icon` deliberately passes `width`/`height` rather than `size`, because `size`
is not an SVG attribute and would produce an unknown-prop warning for any
override that spreads its props straight onto an `<svg>`. So the translation
belongs in a per-library adapter:

```tsx
import type { IconType } from 'react-icons'
import type { IconOverrides } from '@ap/react'

const ri = (RI: IconType): NonNullable<IconOverrides['check']> =>
  ({ width, ...rest }) => <RI size={width} {...rest} />

<ApProvider icons={{ check: ri(FiCheck), close: ri(FiX) }}>
```

Any library whose sizing prop is not `width`/`height` needs the same
three-line treatment. One whose components already accept SVG attributes
directly needs no adapter at all.

**Overriding is not the same as adding.** `IconOverrides` is keyed by
`IconName`, a closed union — a product can replace any icon we ship but cannot
introduce a new name through `IconProvider`. Adding `search` means extending
`ICON_PATHS` in `packages/react/src/icons/paths.ts`, because the names are the
contract our own components call by. Phase 4 ships five on purpose; ADR-0012's
fuller set arrives as components need them, since an icon nothing renders is a
permanent maintenance obligation bought for nothing.

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
