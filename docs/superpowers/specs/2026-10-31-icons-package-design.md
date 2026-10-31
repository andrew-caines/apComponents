# `@ap/icons`: a standalone duotone icon set — design

**Date:** 2026-10-31
**Status:** Draft for review
**Supersedes, once approved:** the Icons section of [ADR-0012](../../adr/0012-cross-cutting-services.md). It also amends [ADR-0011 §6.3](../../adr/0011-component-api-conventions.md) for icon colour props only.
**Scope:** a new `packages/icons`, the icon surface of `packages/react` (`src/icons/`, every component that renders an icon, `ApProvider`), `packages/vite` (`AP_PACKAGES`), `storybook/docs/Icons.mdx`, `scripts/size.ts`, and two new ADRs.

## 1. Intent

**Goal.** apComponents ships its own icon set, roughly 250 icons, that holds up as a collection in its own right, in the way FontAwesome or Hugeicons do. Every icon has a duotone form. The set is professional and restrained, built for business software. It lives in its own package, `@ap/icons`, with its own version and changelog. Icons can therefore be added without touching a component, and `@ap/react` consumes it like any other dependency.

**Why.** Today the library has seven icons in a string-keyed path map inside `@ap/react` (`packages/react/src/icons/paths.ts`). Products reach past it for Lucide or FontAwesome, and the result is mismatched glyph styles next to our components. A set big enough that a product never needs a second library, drawn to one standard, removes that mismatch. Making duotone a rule of the drawing standard, rather than something added later, gives products a visual register our competitors' outline sets don't have.

### Decisions made in conversation (2026-10-31)

| Question | Answer |
|---|---|
| Is "standalone" about quality or packaging? | **Packaging.** A separate `@ap/icons` package, versioned on its own, which loosens the coupling to `@ap/react`. |
| String names (`name="check"`) or imported values? | **Imported values, so the set tree-shakes.** `import { Check } from …` then `<Icon icon={Check} />`. A component's icon props take the same value (`startIcon={Check}`), so every icon on screen is declared at its call site. |
| Can a product use a foreign icon? | **Yes.** The `icon` prop accepts a foreign component, such as a Lucide icon, as well as our own icon data. |
| What does duotone look like? | **Hugeicons style.** The 2px outline is the primary layer. A filled secondary shape sits behind it. |
| Is duotone on by default? | **No.** A bare `duoTone` prop turns it on. Leaving it out, or passing `duoTone={false}`, renders outline only. |
| Colour props | **`color`** colours a single-colour icon. **`duoTonePrimary`** and **`duoToneSecondary`** apply only while duotone is active, and are ignored otherwise. `duoToneSecondary` defaults to the primary colour at 40%, and when it is set it **replaces** the fill colour completely, used exactly as given. The full resolution rules are in §5.1. |
| What do colour props accept? | **A semantic role or any CSS colour.** |
| Who draws the icons? | **Start from Lucide (ISC licence), then redraw.** The goal is one cohesive, professional style like Lucide, without being a copy of Lucide. Expect several visual iterations. |
| How are the 250 chosen? | **Curated by business-software category.** A **pilot batch of 25** comes first, to settle the visual language. |
| Custom icons | **The same data format as the built-ins, through `defineIcon`.** An icon with a secondary layer gets full duotone. One without it renders outline only, coloured as usual. A converter from SVG files comes later. |
| Global overrides | **`IconProvider` stays, keyed by component slot** (`close`, `chevronDown`, `severity.success`, …) instead of by icon name. |
| Compatibility | **A breaking change is fine.** `<Icon name>` is removed with no deprecation period. |

### Decisions made in spec review (2026-10-31)

| Question | Answer |
|---|---|
| How do apps import icons? | **Through `@ap/react/icons`**, which re-exports `@ap/icons`. Apps keep two dependencies. A product takes icon updates by bumping the submodule like any other change, and that is acceptable. |
| Input adornment `icon` type | **`IconValue \| ReactNode`.** A `string` is already a `ReactNode`, so the union covers a literal `$`. |
| Duotone in component chrome | **Components render slot icons with no `duoTone` prop**, so they are outline-only by default. Activating duotone takes the prop, and v1 gives products no way to pass it into a component. |
| Open glyphs (`x`, `check`, `plus`, `chevron-down`) | **A halo:** a wider stroke of the same outline drawn behind it in the secondary colour, so the glyph reads as having a soft shadow or outline around it (§4, §6.2). |
| Stroke weights | **1.5px** outline (down from 2px) and a **5px** halo. |
| Lucide's role | **Inspiration and a reference, never reshipped.** It sits in `devDependencies` (`lucide-static`) for the comparison sheet and the divergence gate, and is never a runtime dependency. |
| `color` vs `duoTonePrimary` | **Separate props with separate jobs.** `color` is the single-colour prop. `duoTonePrimary` is ignored when duotone is not active. |

## 2. Delivery: four sub-phases

This is one initiative with four parts that can be verified on their own. It gets one design spec (this file) and one plan per sub-phase, as Phase 5 did. Each part keeps its id for the life of the initiative.

| Id | Delivers | Depends on |
|---|---|---|
| `icons-core` | The `packages/icons` skeleton: the data format, `defineIcon`, the standalone `Icon` renderer, the gates, and the `@ap/vite` registration. Ships the 7 existing icons, ported as-is, to prove the pipeline. | — |
| `icons-react` | `@ap/react` moves onto `@ap/icons`: a themed `Icon` (roles, size steps), the slot-keyed `IconProvider`, component icon props taking icon values, docs, and removal of `<Icon name>`. | `icons-core` |
| `icons-pilot` | 25 icons redrawn to the house style, iterated with the user until approved. Freezes **Icon Standard v1** (§6). | `icons-core` |
| `icons-catalogue` | The approved category list (~250 names), drawn in category batches to Standard v1, each batch reviewed. | `icons-pilot` |

Build order: `icons-core` first, then `icons-react` and `icons-pilot` in parallel, then `icons-catalogue`.

**Sequencing against current work.** This starts after `feat/single-react` merges. That branch changes `packages/vite`'s package lists, which `icons-core` also edits. It also comes after the three queued Tabs review items, unless the user reorders.

## 3. Package shape

```
packages/icons/
  package.json          "@ap/icons", own version, sideEffects: false
  LICENSE               ours, plus the Lucide ISC notice (§9)
  CHANGELOG.md          one entry per icon batch or API change
  STANDARD.md           the Icon Standard (§6), versioned
  src/
    index.ts            framework-free: every icon, defineIcon, types
    define.ts           defineIcon, isIconDefinition, validation
    types.ts            IconDefinition and friends
    icons/
      bell.ts           one module per icon, each exporting one definition
      …
    react/
      index.ts          the standalone React renderer (Icon, IconValue)
      Icon.tsx
  svg/                  GENERATED: one .svg per icon per variant, for designers and Figma
```

Exports follow the house rule: source TypeScript, compiled by the consumer through `apComponents()` ([ADR-0002](../../adr/0002-distribution-git-submodule.md)).

```jsonc
"exports": {
  ".": "./src/index.ts",            // data + defineIcon: no React import anywhere under it
  "./react": "./src/react/index.ts" // Icon renderer: react is a peer dependency
}
```

The root entry point is framework-free on purpose. Icon data is plain objects, so a later web-component, sprite or SVG converter build (all out of scope, §11) reads the same source. A gate enforces that nothing under `src/` outside `src/react/` imports React.

**TypeScript is the source of truth for icon data, and SVG files are generated from it.** `npm run gen:icons` writes `svg/<name>.svg` (outline) and `svg/<name>.duotone.svg`. A gate fails if the generated files are stale. It works the same way as `examples-freshness`.

## 4. The data format

```ts
// packages/icons/src/types.ts
export interface IconDefinition {
  /** kebab-case, unique within a set. Built-ins: subject, then modifier, then container, e.g. `alert-circle`, `file-plus`. */
  readonly name: string
  /** Stroked paths: the outline, which must read as a complete icon on its own (§6.2). */
  readonly primary: readonly string[]
  /**
   * The duotone layer. Optional for custom icons, required for built-ins.
   * - paths: filled shapes behind the outline (an enclosed region: a bell's body, a document's face);
   * - 'halo': no paths of its own; the renderer redraws `primary` behind itself with a wider stroke
   *   (`HALO_STROKE`), giving open glyphs such as `x` or `check` a soft outline around their shape.
   */
  readonly secondary?: readonly string[] | 'halo'
  /** Defaults to '0 0 24 24'. Built-ins must use the default. */
  readonly viewBox?: string
}
```

Every layer is made of SVG path `d` strings and nothing else. When a Lucide icon is ported, its `<circle>`, `<rect>` and `<line>` elements are converted to paths, so the renderer draws only one element type.

```ts
// packages/icons/src/icons/bell.ts
import { defineIcon } from '../define.js'

export const Bell = defineIcon({
  name: 'bell',
  primary: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  secondary: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9Z'],
})
```

`defineIcon` validates and freezes the input, and tags it with a non-enumerable brand symbol. `isIconDefinition(value)` tests for that brand, so the renderer can tell icon data apart from a foreign component. It throws on:
- a name that isn't kebab-case;
- an empty `primary`;
- an empty or non-string path;
- a malformed `viewBox`.

Consumers call the same function for their own icons:

```ts
import { defineIcon } from '@ap/icons'
export const Forklift = defineIcon({ name: 'forklift', primary: ['…'] })                      // outline-only: fine
export const Pallet = defineIcon({ name: 'pallet', primary: ['…'], secondary: 'halo' })       // duotone with no extra paths
export const Crate = defineIcon({ name: 'crate', primary: ['…'], secondary: ['…'] })          // full duotone
```

`'halo'` gives a custom icon duotone support for one word of effort. That makes it the cheap path for a product porting its own outline icons.

Each built-in's export name is the PascalCase form of its name (`alert-circle` becomes `AlertCircle`). Each icon lives in its own module and `index.ts` only re-exports, so with `sideEffects: false` an unused icon never reaches a bundle (§8).

## 5. The renderers

### 5.1 `@ap/icons/react`: standalone

```ts
export type IconValue = IconDefinition | ComponentType<ForeignIconProps>

export interface IconProps {
  icon: IconValue
  /** Same contract as today: decorative unless labelled, never both. */
  label?: string
  /** A number is px; a string is any CSS length. Default '1em'. */
  size?: number | string
  /** Single-colour icon colour, any CSS colour. Default currentColor. */
  color?: string
  /** Presence turns duotone on. Absent or false: outline only. */
  duoTone?: boolean
  /** Outline colour while duotone is active; ignored otherwise. */
  duoTonePrimary?: string
  /** Fill colour while duotone is active, used exactly as given; ignored otherwise. Default: the primary at 40%. */
  duoToneSecondary?: string
  className?: string
}
```

**Colour resolution.** Duotone is **active** only when the `duoTone` prop is truthy **and** the icon is an `IconDefinition` with a `secondary` (paths or `'halo'`).

| State | Outline | Fill |
|---|---|---|
| Not active: no `duoTone`, or `duoTone={false}`, or an icon with no secondary, or a foreign component | `color ?? currentColor` | none. `duoTonePrimary` and `duoToneSecondary` are ignored. |
| Active | `duoTonePrimary ?? color ?? currentColor` | `duoToneSecondary`, used as given, or the outline colour at 40% |

So `<Icon icon={Bell} duoTonePrimary="red" />` renders in `currentColor`, because duotone is off. A single-colour icon is coloured with `color`. `color` also works as the base colour of a duotone icon, so `<Icon icon={Bell} color="red" duoTone />` gives a red outline with a 40% red fill.

How it renders an `IconDefinition`:

```tsx
const outline = active ? (duoTonePrimary ?? color) : color   // undefined → currentColor
<svg viewBox={def.viewBox ?? '0 0 24 24'} className={className}
     style={{ width: dim, height: dim, ...(outline ? { color: outline } : {}) }}
     {...ariaProps}>
  {active && def.secondary === 'halo' && (
    <g fill="none" stroke={duoToneSecondary ?? 'currentColor'}
       strokeOpacity={duoToneSecondary ? undefined : 0.4}
       strokeWidth={HALO_STROKE} strokeLinecap="round" strokeLinejoin="round">
      {def.primary.map((d, i) => <path key={i} d={d} />)}
    </g>
  )}
  {active && Array.isArray(def.secondary) && (
    <g fill={duoToneSecondary ?? 'currentColor'}
       fillOpacity={duoToneSecondary ? undefined : 0.4} stroke="none">
      {def.secondary.map((d, i) => <path key={i} d={d} />)}
    </g>
  )}
  <g fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
    {def.primary.map((d, i) => <path key={i} d={d} />)}
  </g>
</svg>
```

- **The outline colour travels as `style.color`.** Both layers then derive from `currentColor`, so the default secondary colour is automatically "the primary at 40%", whatever the primary is.
- **The secondary is painted first**, so the outline always sits on top of it.
- **`STROKE` and `HALO_STROKE` are constants of the set**: `1.5` and `5`, both decided in review on 2026-10-31. Neither is a prop. The halo therefore shows 1.75px of surround on each side of the outline.
- **A foreign component** receives `className`, `style` (`width`, `height`, and `color` when `color` is given) and the aria props. That is the same contract the override path has today, already verified against react-icons@5.7.0. Lucide components colour themselves from `currentColor`, so `style.color` reaches them. A foreign component is never duotone, so the `duoTone*` props are ignored, without a throw or a warning.
- **No hooks and no context.** The standalone `Icon` is safe in a server component and needs no `'use client'` directive. A gate renders it with `renderToString` and checks for the directive.

### 5.2 `@ap/react`: themed

`@ap/react` exports its own `Icon`, a thin wrapper over the standalone one. It adds two things:
- **Size steps.** `size?: IconSize | number`, where `IconSize` stays `xs…2xl` and each step resolves to `vars.icon[step]` from the existing `ICON` scale. The default `md` (`1em`) is unchanged.
- **Colour roles.** `color`, `duoTonePrimary` and `duoToneSecondary` take `IconColorRole | (string & {})`. The roles are the curated foreground list ADR-0011 §6.3 already uses for `InputIconColor`: `default | primary | action | danger | warning | success | info`. A role resolves to its `vars.color.*` token, and any other string passes through as a CSS colour. Roles follow the theme and dark mode. Raw colours are the escape hatch, and a raw colour is outside the contrast gate's guarantee. The new ADR records that explicitly (§10).

An app that uses `@ap/react` imports `Icon` from `@ap/react` and the icon values from `@ap/react/icons`. That subpath re-exports `@ap/icons`, including `defineIcon`, so the app's footprint stays at two dependencies, as the single-React spec decided. The package-shape gate gains `./icons`.

### 5.3 Slot-keyed `IconProvider` (in `@ap/react`)

Components no longer render icons by name. Each icon a component draws for itself is a **slot**, with a default from `@ap/icons`:

| Slot | Default | Rendered by |
|---|---|---|
| `close` | `X` | Dialog, Popover, Toast, Banner |
| `chevronDown` | `ChevronDown` | Accordion, Select trigger |
| `check` | `Check` | Checkbox, Select item |
| `fieldError` | `AlertCircle` | Field.Error |
| `severity.info` | `Info` | Toast, Banner |
| `severity.success` | `CheckCircle` | Toast, Banner |
| `severity.warning` | `AlertTriangle` | Toast, Banner |
| `severity.error` | `AlertCircle` | Toast, Banner |

`IconProvider icons={{ close: MyClose, 'severity.success': LucideBadgeCheck }}` maps a slot to any `IconValue`. `useIconSlot(slot)` returns the override or the default. `ApProvider`'s `icons` prop changes type to match. Severity icons now come from slots, so `SEVERITY_ICON` becomes a severity-to-slot map.

A slot overrides **which icon** appears, not how it is drawn. Components render `<Icon icon={useIconSlot('close')} />` with no `duoTone` prop, so chrome icons are outline-only. Activating duotone takes the prop, and v1 has no API to pass it into a component. One can be added later without breaking anything.

### 5.4 Icon props on components

Every component prop that takes an icon takes `IconValue | ReactNode`, never a name. Input's adornment `icon` widens from `ReactNode` to that union.

Each kind of value is told apart at runtime:
- `isIconDefinition` identifies our icon data;
- `isValidElement`, or a primitive, identifies an already-built node, which renders as given with no sizing or colour applied;
- anything else is a component, rendered through `Icon`.

`Select.Icon`'s `children` override is untouched. The names stay `startIcon`/`endIcon` under ADR-0011 §6.1, not `leftIcon`/`rightIcon`.

## 6. The Icon Standard

`packages/icons/STANDARD.md` is the drawing standard, versioned. v0 ships with `icons-core` and states the current geometry. v1 is frozen at the end of `icons-pilot`, and every built-in after that is drawn to it. It is written so a third party could draw an icon that sits in the set unnoticed. Items marked **[gate]** are checked by code. The rest are checked in review.

### 6.1 Geometry
- 24×24 grid, with a 2px padding live area (content within 2–22) **[gate: every coordinate within 1–23]**.
- **One stroke weight across the set: 1.5px at 24px**, a lighter, more professional register than the current 2px. Halo stroke: **5px**. Both were decided in review, and the pilot tunes how the glyphs are drawn, not these two values.
- Round caps and round joins. Corner radius is 2px on rectangular containers.
- At least 2px of clear space between parallel strokes, so a glyph doesn't clog at 16px.
- Keylines: circle Ø20, square 18×18, portrait rectangle 16×20, landscape rectangle 20×16. Optical balance can override them.

### 6.2 Duotone rules
1. **The outline alone is a complete, recognisable icon.** The secondary layer never carries meaning. That keeps outline-only rendering, forced-colours mode and foreign-icon fallback correct by construction.
2. **An icon with an enclosed region uses filled paths.** The secondary is fill only, sits inside or behind the outline's footprint, and fills **one** coherent region: the body of the bell, the face of the document, the interior of the circle. It never mirrors the whole outline.
3. **An open glyph with no enclosed region uses `'halo'`.** Examples are `x`, `check`, `plus`, `chevron-down` and the arrows. The halo is the outline redrawn behind itself at `HALO_STROKE`, so the shape gets a soft surround, as in the reference `xmark` the user supplied. Choosing between filled and halo is a review item. A filled secondary is preferred wherever a region exists.
4. **Every built-in has a secondary layer [gate].**
5. **A halo fits in the frame.** Its half-width is added to the primary's extent, so a halo icon's primary coordinates stay at least 2.5px (`HALO_STROKE / 2`) inside the 24px edge **[gate]**.
6. The secondary, filled or halo, must remain distinguishable at the default 40% on both light and dark canvases. This is checked on the contact sheet (§7), not computed.

### 6.3 Style and metaphor
- The register is calm, professional and business-software. No playful metaphors, no hand-drawn wobble, no decorative detail that disappears at 16px.
- One metaphor per concept across the set. For example, "settings" is always the gear and "delete" is always the bin. The catalogue records the chosen metaphor next to each name.
- Modifier badges, such as plus, check and x on a file, always sit bottom-right and are the same size every time.

### 6.4 Naming
- kebab-case, ordered subject, then modifier, then container (`file-plus`, `alert-circle`) **[gate: kebab-case, unique, export name = PascalCase(name)]**.
- The seven current names are kept as they are. `close` becomes `x`, because a slot now carries the "close" meaning (§5.3).

### 6.5 Lucide derivation
Lucide is inspiration and a reference, not a set we reship. A ported icon is **redrawn**, not re-tinted. The test is whether it reads as ours next to Lucide's original on the comparison sheet (§7). It must not be byte-identical **[gate: no built-in primary path equals the Lucide source path it was ported from]**. Each definition records its Lucide source name, or `null` for an original, in a `catalogue.ts` manifest that the gate and the sheet read. `lucide-static` is a pinned `devDependency` only. It is never imported from `src/`, which a gate checks.

## 7. The pilot (`icons-pilot`)

**25 icons across the categories, chosen to stress the standard:**

- **The 7 existing:** `check`, `x`, `chevron-down`, `info`, `alert-circle`, `check-circle`, `alert-triangle`. These are needed by the components anyway and include the open glyphs that exercise the halo.
- **18 more:**
  - `search`, `plus`, `pencil`, `trash`
  - `download`, `filter`, `settings`, `lock`
  - `user`, `users`, `bell`, `mail`
  - `calendar`, `clock`, `file-text`, `folder`
  - `chart-bar`, `credit-card`

**The review loop.** Each round produces a **contact sheet**, a Storybook page under `Foundations/Icons/Pilot`. Every icon appears in one row with:
- outline and duotone forms;
- sizes of 16, 20, 24, 32 and 48px;
- light and dark canvases;
- one colour role and one raw colour;
- Lucide's original alongside, for the divergence check.

The user reviews, and I revise the paths and the standard together. A round ends with either "revise X" or an approval. The pilot ends when the user approves the sheet. Standard v1 is frozen at that point, and the sheet's story becomes a visual-regression baseline.

## 8. Bundle and performance

- **Tree-shaking is a gate, not a hope.** A fixture bundle imports `Icon` and `Bell` only. The gate fails if the output contains any other icon's path data, or `defineIcon`'s validation code at more than one copy.
- `scripts/size.ts` gains three budget entries in `packages/react/size-budget.json` style:
  - `icons:renderer`: the standalone `Icon` plus `isIconDefinition`;
  - `icons:one`: one icon with both layers;
  - `icons:all`: the full set, as a ceiling for a product that imports everything.
  The numbers are set from the first measurement, then held.
- `@ap/react`'s `index` budget **drops**, because the seven inlined paths leave the main bundle and each slot default is a single icon module.

## 9. Licence

Lucide is ISC-licensed, and its own licence also covers its Feather-derived icons (MIT). `packages/icons/LICENSE` carries the full Lucide copyright and permission notice next to ours. `STANDARD.md` and the Storybook Icons page credit Lucide as the starting point. A gate fails if `LICENSE` loses the notice.

## 10. Docs and ADRs

- **A new ADR, "`@ap/icons`: standalone duotone icon set".** It records the package split, imported values over names, the data format, the duotone rules and the Lucide derivation. It supersedes ADR-0012's Icons section, which gets a pointer to it.
- **A new ADR, or an amendment to ADR-0011 §6.3:** icon colour props accept roles *or* raw CSS colours, and a raw colour sits outside the contrast guarantee. The rule stays roles-only for every other colour prop.
- `storybook/docs/Icons.mdx` is rewritten. It covers the full set (searchable once the catalogue lands), duotone on and off, colour props, `defineIcon` for custom icons, foreign icons, slots and `IconProvider`.
- Getting started gains the `@ap/react/icons` import. `CHANGELOG.md` in `packages/icons` begins with the pilot.
- Migration note for the breaking change: replace `<Icon name="x" />` with `<Icon icon={X} />`, and change `IconProvider`'s keys from icon names to slots.

## 11. Non-goals for v1

- An SVG-file-to-`defineIcon` converter. It comes later, and the layer-naming convention is decided then.
- Framework-free builds: web components, an SVG sprite, an icon font.
- Publishing `@ap/icons` to a registry. Distribution stays the git submodule. Apps take icon updates by bumping it, along with everything else in `@ap/react`.
- An API for turning on duotone in component chrome (§5.3).
- Variable stroke weights or a "solid" style as a third variant.
- Animated icons.
- Icons beyond the approved catalogue. New ones are added later, one at a time, through the same standard.

## 12. Verification plan

Each check runs in order, and each has a concrete success signal. The final proof is the artifact at the end.

| # | Check | Success signal |
|---|---|---|
| 1 | `npm run typecheck` (with `packages/icons` added to the `tsc -b` list) | Exit 0. |
| 2 | `npm test`: unit tests for `defineIcon` (each validation throw; `'halo'` accepted), the renderer (outline by default; `duoTone` adds the filled or halo group; default opacity 0.4; an explicit `duoToneSecondary` at full opacity; `duoTonePrimary` ignored when not active; `color` used when not active and as the base when active; a foreign component receives `style.color` from `color`; the aria contract in both branches), the themed wrapper (role resolves to a var, raw colour passes through, size steps), slot resolution, and the `IconValue \| ReactNode` dispatch | All green. Every row of the §5.1 resolution table has a test. |
| 3 | `npm run test:icons`, a new gate group: format validity of every built-in, the §6 [gate] rules, no React import outside `src/react/`, SVG freshness, the LICENSE notice, and Lucide divergence | All green. |
| 4 | The tree-shake gate and `npm run size` | One-icon bundle contains exactly one icon's paths. All budgets pass, and `index` is lower than today's 92 400. |
| 5 | `npm run test:gates` and `npm run test:guards` (the `@ap/vite` `index.test.ts` enumerates `packages/`, so it fails until `@ap/icons` is in `AP_PACKAGES`) | All green. |
| 6 | `npm run test:stories` (a11y) and `npm run test:visual` | No a11y violations. Visual baselines updated only for the icons that changed, each change reviewed. |
| 7 | `npm run test:ssr`, `npm run test:hydration`, `npm run test:external` (layouts A and B) | Green. An out-of-repo app imports `@ap/react/icons` with no extra dependency or config. |
| 8 | **Pilot sign-off:** the user approves the contact sheet | An explicit approval, recorded in the plan's retrospective with the sheet's commit SHA. |

**Final proof artifact:** the published Storybook Icons page on GitHub Pages, showing the full catalogue in outline and duotone, light and dark, together with a green CI run on the merging PR that includes the tree-shake gate's output.

## 13. Open questions

None. All seven first-draft questions, plus the stroke weight (**1.5px**) and the halo width (**5px**), were resolved in review on 2026-10-31. The pilot's job is the drawing itself. If the contact sheet shows the halo's default 40% reading as a smudge at 16px, that comes back to the user as a pilot finding, not a silent change.
