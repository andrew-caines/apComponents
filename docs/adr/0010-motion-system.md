# 0010 — Motion: CSS-first tokens, Motion opt-in, reduced-motion at the token layer

**Status:** Accepted — 2026-08-29

## Context

Motion is to be a first-class part of the theme, with standard named motions for semantic states — errors shake, warnings pulse, and so on.

There are two ways to deliver that. **CSS** (transitions and keyframes, driven by Base UI's state data attributes) costs no JavaScript, has no hydration surface, works before hydration and with JavaScript disabled, and runs entirely off the main thread. **Motion** (`motion/react`) provides layout animations, gesture tracking, interruptible spring physics and orchestration — a hybrid engine using the Web Animations API and ScrollTimeline natively, with a JavaScript fallback where those APIs cannot express something.

Worth noting: the two motivating examples — error shake and warning pulse — are both pure CSS keyframes. That is representative. The great majority of a component library's motion is state-transition motion, which CSS handles natively.

The accessibility dimension is not optional. Vestibular disorders make unexpected motion genuinely harmful, and `prefers-reduced-motion` must be honoured everywhere, without exception, in a way that cannot be forgotten.

## Decision

### Tokens, dual-emitted from one source

Motion tokens are defined once in `@ap/motion` and emitted in two forms:

- **CSS** — custom properties and `@keyframes`.
- **JavaScript** — variant objects consumable by Motion.

One definition, two outputs. The layers cannot drift.

### Primitives

```css
--ap-duration-instant: 0ms;
--ap-duration-fast:    120ms;
--ap-duration-base:    200ms;
--ap-duration-slow:    320ms;
--ap-duration-slower:  480ms;

--ap-ease-out:    cubic-bezier(0.16, 1, 0.30, 1);   /* entering — decelerate */
--ap-ease-in:     cubic-bezier(0.70, 0, 0.84, 0);   /* exiting  — accelerate */
--ap-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

**Entrances decelerate and are slower; exits accelerate and are faster.** Users wait for entrances but not for exits, so a slow exit reads as lag.

### Named semantic motions

| Token | Behaviour | Note |
|---|---|---|
| `error.shake` | 3 oscillations, ±4px, 320ms | Finite. Fires on the error event, not on every render |
| `warning.pulse` | 2 breath cycles, then stops | **Never infinite** — perpetual motion is a vestibular hazard and an attention sink |
| `success.check` | stroke draw + scale settle, 400ms | |
| `enter.fade-rise` / `exit.fade` | dialogs, popovers, menus | |
| `collapse` / `expand` | height via the primitive's panel-height CSS var | |
| `toast.slide-in` / `toast.slide-out` | edge slide + fade | |
| `skeleton.shimmer`, `spinner.rotate` | infinite | The only legitimate loops — the motion *is* the information |
| `attention.nudge` | single 6px settle | Draws the eye without alarming |

### CSS first; Motion where it earns it

Default component motion is **pure CSS**, driven by Base UI's `[data-open]`, `[data-starting-style]` and `[data-ending-style]` attributes.

`motion` is an **optional peer dependency**, used only for what CSS cannot do: layout animations (`layoutId`), gesture-driven interaction, drag, genuinely interruptible spring physics, and staggered orchestration. Components needing it follow Base UI's documented integration — `AnimatePresence` with `keepMounted` for unmounting trees, `initial={false}` for always-mounted ones, and `actionsRef.current.unmount()` where lifecycle must be controlled manually.

### Reduced motion is enforced at the token layer

Every motion token carries a `prefers-reduced-motion: reduce` definition that collapses movement to an opacity change or to nothing:

```css
@media (prefers-reduced-motion: reduce) {
  --ap-duration-fast: 1ms;
  --ap-duration-base: 1ms;
  /* transform-based keyframes degrade to opacity-only */
}
```

Because components consume the **token** rather than raw keyframes, no component *can* get this wrong. Components do not opt in to reduced-motion support; they cannot opt out of it. Motion-based components additionally sit under `<MotionConfig reducedMotion="user">`.

This is the strongest argument for the CSS-first layering: it moves an accessibility guarantee from something every author must remember into something the system enforces once.

## Consequences

- Most components animate with zero JavaScript, no hydration concern, and no dependency.
- Reduced motion is correct by construction rather than by review.
- Products that never use gesture or layout animation never ship Motion at all.
- **Cost:** two authoring models. The boundary is documented as a rule — if CSS can express it, CSS expresses it.
- **Cost:** dual-emit needs a build step and a test asserting the two outputs stay equivalent.
- Motion being an optional peer means a consumer can import a Motion-using component without installing Motion. Guarded with a clear error at import time rather than an obscure runtime failure.

## Alternatives considered

- **Motion for everything.** One consistent authoring model, spring physics throughout. Rejected: Motion becomes a hard dependency, every animated component becomes stateful, and simple state transitions pay a JavaScript tax for nothing.
- **CSS only, no Motion at all.** Smallest surface. Rejected — it forecloses layout animations and gesture interaction, which are real needs in data-dense UI (reorderable lists, draggable panels).
- **Per-component choice with no rule.** Rejected: without a stated boundary the two models interleave arbitrarily and the reduced-motion guarantee stops being systematic.
