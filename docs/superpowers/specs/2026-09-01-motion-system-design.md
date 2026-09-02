# Phase 3 — Motion system (`@ap/motion`) design

**Status:** Approved — 2026-09-01
**Implements:** design doc §5 Phase 3; ADR-0010 (motion), ADR-0001 (package boundaries), ADR-0016 (cascade layers)
**Exit criterion (from §5):** a test asserts the CSS and JS emissions are equivalent, and that every motion token has a `prefers-reduced-motion` definition.

## 1. Goal

Motion becomes a first-class part of the theme: a fixed set of named semantic motions, defined once and emitted in two forms, with reduced-motion support that components cannot fail to inherit.

ADR-0010 already decided the substance — the primitives, the twelve named motions, dual-emit, and reduced motion enforced at the token layer. This document resolves what the ADR left open: where the primitives live, what "the two emissions are equivalent" concretely asserts, how much of the Motion runtime belongs in this phase, and how the source record is shaped.

## 2. Decisions taken

Four questions were open going in. Their resolutions bind the rest of this document.

**Primitives live in `@ap/tokens`; named motions live in `@ap/motion`.** ADR-0001's table lists motion tokens under `@ap/tokens` while ADR-0010 presents the primitives as part of the motion system, and Phase 1 shipped neither. The split honours both: durations and easings are scales exactly like space and radius, and belong beside them in the one stylesheet every consumer already imports. Keyframes are bulk that only an animating consumer should pay for, so they live in `@ap/motion`'s own opt-in `motion.css`.

**Equivalence is asserted by parsing the emitted CSS and comparing it to the emitted JS.** Both sides are read as artifacts. Comparing each emitter against its own input instead would pass a bug that affected both emitters identically, and asserting only that names correspond would pass wildly different step values. Phase 2 established the principle the hard way: a gate that reads the generator's in-memory state rather than the artifact proves less than it claims.

**This phase ships no `motion/react` surface.** §5's Phase 3 line is "primitives, named semantic motions, dual-emit, reduced-motion token overrides" and nothing more. ADR-0010's Motion integration guidance — `AnimatePresence`, `keepMounted`, `initial={false}`, `actionsRef` — cannot be exercised or tested until Dialog exists in Phase 4, and the optional-peer import guard has nothing to guard until a Motion-using export exists.

**All twelve named motions ship now.** They are declarative data the ADR already specifies rather than speculative features; each is a few lines; each adds real coverage of the same emit-and-compare machinery. Building three now would reopen the record, the generator, the snapshot and the equivalence gate in each of Phases 4 and 5.

## 3. Architecture

```
packages/
├── tokens/                              (existing)
│   └── src/scales/motion.ts             NEW — DURATION and EASE scales
├── motion/                              NEW — @ap/motion
│   ├── package.json                     deps: @ap/tokens (file:)
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                     public surface
│       ├── motions.ts                   MOTIONS — the source record
│       ├── types.ts                     MotionSpec, Step, MotionName
│       ├── emitCss.ts                   toMotionCss(MOTIONS)
│       ├── emitVariants.ts              toMotionVariants(MOTIONS)
│       ├── motion.css                   GENERATED, committed
│       └── gates/
│           ├── equivalence.gate.test.ts
│           ├── reduced-motion.gate.test.ts
│           └── freshness.gate.test.ts
└── react/                               (existing — unchanged this phase)
scripts/
└── gen-motion-css.ts                    NEW
```

`@ap/motion` depends on `@ap/tokens` and nothing else. It has no React dependency, no DOM dependency and no bundler dependency — the same constraint ADR-0001 places on `@ap/tokens`, and worth enforcing with the existing react-free gate pattern.

`@ap/react` does **not** gain a `@ap/motion` dependency in this phase. Nothing in it consumes motion until Phase 4, and the duration and easing values reach component code through the token contract.

## 4. Primitives in `@ap/tokens`

`scales/motion.ts` carries ADR-0010's values verbatim:

| Token | Value | | Token | Value |
|---|---|---|---|---|
| `duration-instant` | `0ms` | | `ease-out` | `cubic-bezier(0.16, 1, 0.30, 1)` |
| `duration-fast` | `120ms` | | `ease-in` | `cubic-bezier(0.70, 0, 0.84, 0)` |
| `duration-base` | `200ms` | | `ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` |
| `duration-slow` | `320ms` | | `ease-linear` | `linear` |
| `duration-slower` | `480ms` | | | |

Entrances decelerate with `ease-out` and take longer; exits accelerate with `ease-in` and are shorter. Users wait for entrances but not for exits, so a slow exit reads as lag.

**`ease-linear` is a fourth easing, added beyond ADR-0010's three.** The two infinite motions require it: a spinner that eases in and out on every rotation visibly stutters at the loop boundary, and a shimmer that decelerates mid-sweep reads as a stall. Every eased curve produces that artefact when looped, so this is not a preference — a continuous loop has no start or end to shape. Recorded here as a deliberate addition to the ADR's set.

These surface as `theme.scales.motion` and are emitted by the existing `toCssText` into `:root` as `--ap-duration-*` and `--ap-ease-*`. The generated `contract.css.ts` gains `vars.duration.*` and `vars.ease.*`, so component code reaches them typed, and Tier 1 remains unreachable.

`toCssText` also gains a `@media (prefers-reduced-motion: reduce)` block, alongside the existing `pointer: coarse` section, collapsing every non-zero duration:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --ap-duration-fast: 1ms;
    --ap-duration-base: 1ms;
    --ap-duration-slow: 1ms;
    --ap-duration-slower: 1ms;
  }
}
```

**1ms, not 0ms, and this matters.** A zero-length animation may never fire `transitionend` or `animationend`, stranding any code that waits on one — a component that unmounts on animation end would hang open forever. 1ms is imperceptible and still fires the event. The emitter carries this reasoning as a comment; it is the kind of decision that looks like a typo to the next reader.

Adding these scales changes `theme.css` and the determinism snapshots. Both are regenerated and re-gated by machinery Phase 2 already built.

## 5. The source record

```ts
export type DurationToken = 'instant' | 'fast' | 'base' | 'slow' | 'slower'
export type EaseToken = 'out' | 'in' | 'in-out' | 'linear'

/** One keyframe stop. `at` is a 0–1 offset. Absent properties are not animated. */
export interface Step {
  at: number
  opacity?: number
  translateX?: string   // e.g. '-4px', '100%'
  translateY?: string
  scale?: number
  rotate?: string       // e.g. '360deg'
  strokeDashoffset?: number
}

export interface MotionSpec {
  duration: DurationToken
  ease: EaseToken
  steps: readonly Step[]
  /** Finite count, or 'infinite' — permitted only where the motion IS the information. */
  iterations: number | 'infinite'
  /** How this motion degrades under prefers-reduced-motion. */
  reduced: 'opacity' | 'none'
}
```

`duration` and `ease` are **token names, not values**. The emitted CSS references `var(--ap-duration-fast)`, so a motion can never drift from the scale, and the JS emitter resolves the same name through the same source.

`reduced: 'opacity'` degrades a transform-bearing motion to its opacity track alone. `reduced: 'none'` suppresses it entirely — correct for motions that are pure movement and carry no information without it.

### The twelve motions

| Name | Duration | Ease | Shape | Iterations | Reduced |
|---|---|---|---|---|---|
| `error.shake` | `slow` | `in-out` | ±4px on X, 3 oscillations | 1 | `none` |
| `warning.pulse` | `slow` | `in-out` | scale 1 → 1.04 → 1 breath | **2** | `none` |
| `success.check` | `slower` | `out` | stroke draw, then scale settle | 1 | `opacity` |
| `enter.fade-rise` | `base` | `out` | opacity 0→1, translateY 8px→0 | 1 | `opacity` |
| `exit.fade` | `fast` | `in` | opacity 1→0 | 1 | `opacity` |
| `collapse` | `fast` | `in` | height `var(--panel-height)`→0 | 1 | `none` |
| `expand` | `base` | `out` | height 0→`var(--panel-height)` | 1 | `none` |
| `toast.slide-in` | `base` | `out` | translateX 100%→0, opacity 0→1 | 1 | `opacity` |
| `toast.slide-out` | `fast` | `in` | translateX 0→100%, opacity 1→0 | 1 | `opacity` |
| `skeleton.shimmer` | `slower` | `linear` | translateX -100%→100% | `infinite` | `none` |
| `spinner.rotate` | `slower` | `linear` | rotate 0→360deg | `infinite` | `none` |
| `attention.nudge` | `fast` | `out` | translateX 0→6px→0, single settle | 1 | `none` |

Two notes on this table.

**`warning.pulse` is finite by construction.** ADR-0010 is emphatic that perpetual motion is a vestibular hazard and an attention sink. Encoding `iterations: 2` as data rather than as guidance means the reduced-motion gate can assert it, and a later change to `infinite` fails a test rather than passing review.

**`success.check` deviates from the ADR's stated 400ms.** The scale has no 400ms step, and inventing one to fit a single motion would undermine the point of a scale. It maps to `slower` (480ms). The alternative — `slow` at 320ms — rushes a stroke-draw-then-settle. This is a deliberate, recorded deviation; if 400ms proves to matter, the honest fix is a new scale step, not a hardcoded duration.

`collapse` and `expand` reference `var(--panel-height)`, which Base UI's primitives supply. Base UI does not arrive until Phase 4, so the variable is unresolved until then. That is fine — an unresolved custom property in a keyframe simply produces no animation — but it means these two motions are the only ones this phase cannot demonstrate end to end.

## 6. Emission

### CSS — generated and committed

`toMotionCss(MOTIONS)` produces `packages/motion/src/motion.css`, generated by `scripts/gen-motion-css.ts`, committed as source, and gated for freshness. This is the fourth application of the pattern Phase 1 and 2 established: generate, commit, gate.

For each motion it emits a `@keyframes` block and a composite custom property:

```css
@keyframes ap-error-shake {
  0%   { translate: 0 }
  16%  { translate: -4px }
  /* … */
  100% { translate: 0 }
}

@layer ap.tokens {
  :root {
    --ap-motion-error-shake: ap-error-shake var(--ap-duration-slow) var(--ap-ease-in-out) 1 both;
  }
}
```

`@keyframes` are emitted **unlayered**: keyframes are not subject to the cascade, so wrapping them in a layer would be noise. The composite properties are cascade-participating and go inside `@layer ap.tokens`.

**Import order is load-bearing.** `theme.css` carries the `@layer ap.tokens, ap.components;` order statement, so it must be imported before `motion.css`. Documented in `CONTRIBUTING.md` and in the generated file's header.

### JS — a pure function, not a generated file

`toMotionVariants(MOTIONS)` returns plain data, shaped for Motion's `keyframes` + `transition` convention:

```ts
{
  'error.shake': {
    keyframes: { translateX: ['0px', '-4px', /* … */ '0px'] },
    transition: { duration: 0.32, ease: [0.65, 0, 0.35, 1], times: [0, 0.16, /* … */ 1], repeat: 0 },
  },
}
```

This is deliberately **not** a generated artifact. JavaScript consumers import a function and call it; only CSS needs materialising ahead of time because a stylesheet cannot be computed at import time. One generated artifact means one freshness gate and one drift channel instead of two.

The returned objects are typed by our own interface and documented as Motion-compatible. Nothing in this phase imports `motion/react`.

## 7. Reduced motion

Enforced in two places, neither of which a component can opt out of.

**Durations** collapse to 1ms in `theme.css` (§4), which covers every transition and every animation that reads a duration token.

**Transform-bearing keyframes** are re-declared in `motion.css` under `@media (prefers-reduced-motion: reduce)`, using the same keyframe name and appearing later in the sheet, so the later declaration wins:

```css
@media (prefers-reduced-motion: reduce) {
  @keyframes ap-enter-fade-rise {   /* 'opacity' — movement dropped, fade kept */
    0%   { opacity: 0 }
    100% { opacity: 1 }
  }
  @keyframes ap-error-shake {       /* 'none' — no visual change */
    0%, 100% { }
  }
}
```

A `'none'` degradation emits a keyframes block that still *exists* but animates nothing, rather than removing the animation altogether. Same reasoning as the 1ms durations: the animation still runs and still fires `animationend`, so a component that unmounts or advances state on that event behaves identically for a reduced-motion user. Deleting the keyframes would strand exactly those components.

Because components consume the named token rather than raw keyframes, no component *can* get this wrong. This is the strongest argument for the CSS-first layering in ADR-0010: an accessibility guarantee moves from something every author must remember into something the system enforces once.

## 8. Verification

Four gates, each of which must be demonstrated failing before it is trusted.

1. **Equivalence** (`equivalence.gate.test.ts`) — the phase's stated exit criterion. Parses the emitted `motion.css`, extracting for each `@keyframes` its step offsets and per-step property values, plus the duration and easing from the composite property; resolves the same names through `toMotionVariants`; asserts the two agree on name set, offsets, values, duration and easing. Reads both sides as artifacts.
2. **Reduced motion** (`reduced-motion.gate.test.ts`) — the phase's other stated criterion. Every named motion has a `prefers-reduced-motion` definition; every `reduced: 'opacity'` degradation animates opacity and nothing else; every `reduced: 'none'` degradation animates nothing; and `iterations: 'infinite'` appears on `skeleton.shimmer` and `spinner.rotate` alone, which catches any future attempt to make `warning.pulse` perpetual.
3. **Freshness** (`freshness.gate.test.ts`) — committed `motion.css` matches its generator, and carries a do-not-edit header naming the regeneration command. Mirrors `theme-freshness.gate.test.ts`.
4. **Determinism** — the same record emits byte-identical CSS across runs, and `@ap/motion` imports nothing from React, the DOM or a bundler.

Scripts: `gen:motion-css` and `test:motion`, with `test:motion` added to the `test:gates` aggregate and `gen:motion-css` added to CI's generated-artifacts-are-fresh job.

## 9. Out of scope

- Any `motion/react` dependency, the optional-peer import guard, and `<MotionConfig>` — Phase 4, alongside the components and providers that need them.
- Component consumption of these tokens. Nothing imports `@ap/motion` at the end of this phase; the gates are its only consumers.
- Scroll-driven and gesture-driven motion, layout animation, spring physics.
- A 400ms duration step (see §5) unless `success.check` proves it necessary.

## 10. Risks

**The equivalence gate needs a CSS parser.** A full parser would be disproportionate; a focused extractor for `@keyframes` blocks and composite properties is a few dozen lines over output we generate ourselves. The risk is that the extractor and the emitter drift into agreeing with each other about something wrong. Mitigated by asserting extracted values against the source record's declared values too, so a wrong shared assumption has to survive three-way agreement.

**`collapse`/`expand` cannot be demonstrated this phase** because `--panel-height` arrives with Base UI in Phase 4. They are emitted and unit-tested, not exercised.

**Adding scales to `@ap/tokens` moves Phase 1 snapshots.** Expected and safe — the determinism and contrast gates re-run — but the diff will look larger than the change.
