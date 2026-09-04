# 0011 — Component API: compound parts, `render` passthrough, uncontrolled-first forms

**Status:** Accepted — 2026-08-29

## Context

A component library's API is its most permanent decision. Styling can be replaced, primitives can be swapped, but a public API shape is what every consuming product writes against, and changing it means changing all of them.

Three questions had to be settled together, because they interact: how components are composed, how they integrate with routing, and how they integrate with form state.

## Decision

### 1. Compound components, mirroring Base UI

Every non-trivial component exposes named parts:

```tsx
<Dialog.Root>
  <Dialog.Trigger>Edit</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Backdrop />
    <Dialog.Popup>
      <Dialog.Title>Edit employee</Dialog.Title>
      <Dialog.Description>Changes apply immediately.</Dialog.Description>
      <Dialog.Close>Cancel</Dialog.Close>
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

Consumers control structure, ordering and what goes where. No configuration-object props, no `renderFooter` escape hatches, no boolean explosion.

### 2. Convenience components are built *on* compound ones, never beside them

Where the compound assembly is boilerplate for the common case, a convenience component is provided:

```tsx
<Field label="Email" error={errors.email} hint="We never share this.">
  <Input name="email" type="email" />
</Field>
```

**The rule:** a convenience component must be implementable purely through the public compound API. If it cannot be, the compound API is incomplete — and that is the bug to fix, not to work around internally.

This is what stops the two APIs diverging into a fast path and a real path with different behaviour.

### 3. Routing via `render`, not via a dependency

Base UI's `render` prop replaces the underlying element while preserving all behaviour, ARIA and styling:

```tsx
<Button render={<Link to="/employees/42" />}>View employee</Button>
```

This yields a real `<a href>` with React Router navigation, correct semantics, working middle-click and working right-click-copy-link.

**`@ap/react` takes no dependency on `react-router`** ([ADR-0001](0001-package-architecture.md)). The library works with any router, or none, and survives React Router 9 without a release.

### 4. Uncontrolled-first forms with native semantics

Form components are plain HTML form controls by default — `name`, `defaultValue`, `required` — and controllable when needed via `value` / `onValueChange`.

This matters for more than familiarity. It is what makes progressive enhancement work: a React Router 8 `<Form method="post">` submits and the action runs **before hydration completes**, because the browser is submitting a real form. Controlled-first components cannot do that, since their values live only in React state.

It also means the library composes with react-hook-form, TanStack Form, or plain FormData without adapters — they all build on native semantics.

`Field.Root` provides context so `Label`, `Control`, `Description` and `Error` wire up their own `id`, `aria-describedby` and `aria-invalid` relationships. Nobody passes an id by hand, and the ARIA wiring cannot be forgotten.

### 5. Semantic state is never colour alone

There is no API by which a component renders an error, warning or success state as colour only. `Field.Error` renders an icon and text; `Alert` requires a `title`; status indicators pair colour with a glyph. This satisfies WCAG 1.4.1 structurally rather than by review ([ADR-0008](0008-contrast-policy.md)).

### 6. Shared prop conventions

| Prop | Meaning |
|---|---|
| `className` | merged, never replaced |
| `render` | element passthrough (Base UI) |
| `data-*` | primitive state attributes always preserved |
| `variant`, `size`, `tone` | typed recipe variants |
| `startIcon`, `endIcon` | an adornment placed inside the control on the inline axis |
| `asChild` | **not used** — `render` is the mechanism |

Every component forwards refs and spreads unknown props to its root element.

### 6.1 Direction is always logical, in prop names as well as in CSS

A position-bearing prop is named for the **inline axis**, never for the screen:
`startIcon`/`endIcon`, not `leftIcon`/`rightIcon`. The styling that places them
uses `inset-inline-start`/`-end`, so under RTL a `startIcon` renders on the
right and the name is still true; `leftIcon` would become a lie the first time
a product ships Arabic or Hebrew.

This is the same rule the style gate already enforces one level down — it
rejects `padding-left` in favour of `padding-inline-start` — and Base UI, which
these components wrap, ships a `DirectionProvider` for exactly this reason
([ADR-0004](0004-base-ui-primitives.md)). A physical name in the public API
would be the one place the system stopped agreeing with itself.

### 6.2 An interactive adornment carries its accessible name in the type

Where an adornment can be clicked, the prop takes a union, not a flat object:

```ts
type InputAdornment =
  | { icon: ReactNode; onClick?: never; label?: never }
  | { icon: ReactNode; onClick: () => void; label: string }
```

Supplying `onClick` without `label` is a compile error. This is deliberate and
follows §5's logic: a clickable icon with no accessible name is invisible to
screen-reader and voice-control users while looking perfect on screen, so the
failure is one nobody catches by looking. Making it unrepresentable costs a
union; making it a review item costs it every time somebody forgets.

The same shape carries the other half of the contract. With `onClick`, the
component renders a real `<button type="button">` — focusable, keyboard
operable, sized to the `hit-target` token, disabled when the control is, and
explicitly non-submitting so it cannot post the form it sits in. Without it,
the icon is `aria-hidden` and transparent to pointer events, so clicking it
puts the caret in the field behind it. A consumer never chooses between those
two behaviours; the presence of a handler does.

### 6.3 A colour prop takes a semantic role, never a value or the whole keyset

`InputAdornment`'s `color` accepts `default | primary | action | danger |
warning | success | info` — a curated list of **foreground** roles, not
`keyof vars.color` and certainly not a hex.

Exposing the full token keyset would make `color="bgCanvas"` (an invisible
icon) and `color="borderSubtle"` (a 3:1 role doing a 4.5:1 job) type-legal.
Every option in the curated list is a role the contrast gate already covers as
text, so a product cannot pick an unreadable one — the same reasoning as
[ADR-0007](0007-three-tier-token-contract.md)'s point that a semantic token
carries its guarantee with it.

The chosen role is applied by setting the component's own Tier 3 custom
property inline, not by generating a class per role: that is
[ADR-0003](0003-zero-runtime-styling.md)'s division — static styles stay static,
dynamic values travel as custom properties — and it reuses the same
`--ap-input-icon` hook a product already has for overriding the default.

### 6.4 The hit area and the painted surface are allowed to differ

An interactive adornment's `<button>` spans the full height of the control so
the target is comfortably past WCAG 2.5.8, while the hover background and focus
ring are drawn on a smaller box inside it. Painting the target itself put a
background flush against the input's border at every size, and at `sm` the two
requirements genuinely conflict: a 26px-tall field cannot contain a 24px target
with visible clearance on both sides. Separating them satisfies both.

Where a component does this, the focus ring stays on the focusable element and
is inset with a negative `outline-offset`. Moving the ring to the inner box
would require suppressing the button's own, which the style gate forbids with
no exemption — correctly, since a text scan cannot tell a relocated ring from a
deleted one.

### 6.5 A pending control stays submittable

`loading` on a form control makes it **read-only, not disabled**. A disabled
field drops out of the tab order *and* out of form submission, so a form posted
while one field was still validating would silently lose that field's value —
the user sees a filled-in input and the server sees nothing. Read-only keeps the
value in the payload and the field reachable by keyboard, while still refusing
edits. `aria-busy` carries the pending state.

The spinner **replaces** the trailing adornment rather than joining it: two
glyphs competing in one slot at `sm` is not a layout worth having, and the
adornment a control shows while pending is nearly always the one that acts on a
value it does not have yet. Adornments on the other side stay, but an actionable
one is disabled for the same reason.

The spinner itself is decorative — `aria-hidden`, no label. `aria-busy` already
announces the state; a labelled spinner beside it would announce it twice, and
two announcements for one state is noise rather than redundancy. A spinner
carries its own label only where it is the *sole* indication that something is
happening.

### 6.6 `size` means control height on a control, width cap on a container

`Input`'s `size` steps padding and type; `Dialog`'s caps inline size. Same prop
name, different axis — which is conventional, and is stated here so a reader
does not have to infer it from two component docs that never mention each other.

The rule: for a control, `size` is the ergonomic step (height, padding, type).
For a container, `size` is the **maximum inline size**, never a fixed width, so
the surface stays fluid below its cap and can never exceed its viewport.

Containers additionally take a `fit` step — shrink-to-fit, bounded at both ends
— and it is deliberately not the default. `fit-content` resolves against the
content's *max-content* width, and a percentage-width child contributes nothing
to max-content, so a `fit` container wrapping a form collapses to the width of
its longest label and renders the inputs as slivers. `fit` is for content with
intrinsic width (alerts, confirmations); the floor is what keeps the failure
impossible rather than merely unlikely.

Height is not a prop on a container at all. It grows to content, stops at the
viewport, and scrolls internally with header and footer pinned. A height
override is a way to push a dialog's own close control off-screen.

### 7. Every component ships with

- A `.stories.tsx` (gallery entry, controls, axe run)
- An SSR render assertion
- Documented Tier 3 override tokens ([ADR-0007](0007-three-tier-token-contract.md))

### v1 scope — forms and feedback core (~15)

Button, Input, Textarea, Select, Checkbox, Radio, Switch, Field (Label/Description/Error), Dialog, Toast, Tooltip, Popover, Tabs, Accordion, Spinner.

This is the smallest set that exercises every hard part of the architecture end to end: tokens, motion, compound composition, portals, forms, notifications and SSR. Data-display components (Table, Pagination, Badge, Avatar, Card, EmptyState) follow in v2, with Table treated as its own sub-project.

## Consequences

- The API is predictable: learn the pattern once and every component follows it.
- Consumers who know Base UI already know our components.
- Progressive enhancement works, so RR8 form actions function before hydration.
- **Cost:** compound APIs are more verbose for simple cases. The convenience layer addresses this, at the cost of two documented ways to do the same thing.
- **Cost:** Base UI's compositional shape is now part of our public API. A migration away from Base UI would be a breaking change, not an internal refactor. Accepted knowingly in [ADR-0004](0004-base-ui-primitives.md).
- Uncontrolled-first means less obvious state flow for developers accustomed to controlled inputs. Documented with worked examples for both modes.

## Alternatives considered

- **Controlled-first.** Familiar and explicit. Rejected — it breaks progressive enhancement and makes RR8 action-based forms awkward.
- **A first-class react-hook-form adapter.** Excellent DX if every product uses RHF. Rejected as a dependency and a permanent compatibility burden; native semantics give RHF compatibility for free anyway.
- **Our own form-state layer (`Form.Root` owning validation and submission).** The most cohesive single story, and a large subsystem competing with mature libraries. Rejected as scope we would own forever.
- **Monolithic props (`<Dialog title footer actions />`).** Simplest for trivial cases, unusable past them. Rejected.
