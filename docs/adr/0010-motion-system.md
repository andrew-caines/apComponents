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
| `enter.slide-up` / `exit.slide-down` | bottom-sheet presentation below `sm` ([ADR-0017](0017-responsive-adaptive.md)) | Travels 100% of its own height, not a fixed step — an 8px hop on a full-height surface reads as a twitch |
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

#### "Or to nothing" has one exception: an indeterminate loop

`reduced: 'none'` is the right default because most motion is emphasis — remove it and the interface still says everything it said before, just less theatrically. An indeterminate progress indicator is the inverse: the movement *is* the message. Degrade `spinner.rotate` to nothing and a reduced-motion user is left looking at a static glyph, with no way to tell a request in flight from one that died. The guarantee we enforce for their vestibular system would have quietly cost them the state.

So `spinner.rotate` is `reduced: 'opacity'`. Rotation is a vestibular trigger; a slow opacity fade is not — the state stays perceivable without the property that does harm.

This has a consequence for how such a motion is authored. A reduced variant is emitted as the **opacity subset of the same keyframes** (`emitCss.ts`), so a motion with no opacity track has nothing to degrade *to*, and `reduced: 'opacity'` silently produces an empty animation — a spinner that stops meaning anything for exactly the users this clause exists to protect. `motions.test.ts` therefore rejects `reduced: 'opacity'` on any motion whose steps declare no `opacity`, which is what forces `spinner.rotate`'s opacity track to exist at all. At full motion it reads as a gentle breath beneath the rotation; under `reduce` the breath is all that remains, and it is enough to say "still working".

The rule is not "infinite motions must degrade to something" — the system's other infinite motion, `skeleton.shimmer`, is correctly `reduced: 'none'`. The test is whether the indicator still reads as *active* once it stops moving. A skeleton does: it is a content-shaped placeholder, and its static form is the whole message, with the shimmer only sweetening it. A spinner does not: a static arc is indistinguishable from an ordinary icon.

So: **when motion is the only thing distinguishing an indicator from decoration, it degrades to a perceivable non-transform change rather than to nothing.** Everything else takes `reduced: 'none'`.

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
