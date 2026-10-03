'use client'

import { cloneElement, forwardRef, isValidElement, useId, type ReactNode } from 'react'
import {
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  type FieldRootProps,
} from './FieldParts.js'
import { usesNonNativeLabel } from './nonNativeLabel.js'

export { FIELD_TOKENS } from './Field.tokens.js'
export type {
  FieldControlProps,
  FieldDescriptionProps,
  FieldErrorProps,
  FieldLabelProps,
  FieldRootProps,
} from './FieldParts.js'

/**
 * `invalid` is deliberately omitted from this component's props.
 *
 * `Field.Root`'s `invalid` marks the control invalid without supplying
 * anything to read, and on this component that would paint the invalid border
 * and set `aria-invalid` with no message beside them — ADR-0011 §5's
 * colour-alone failure, reachable through the recommended API. `error` is
 * therefore the one external-invalidity channel here: it marks the field
 * invalid AND supplies the text. `validate`, `validationMode` and
 * `validationDebounceTime` are kept, because each of them produces a real
 * message that the always-present `Field.Error` slot renders. A product that
 * genuinely wants bare `invalid` uses the compound API (`<Field.Root invalid>`)
 * and takes responsibility for rendering its own `<Field.Error>`.
 */
export interface FieldProps extends Omit<FieldRootProps, 'children' | 'invalid'> {
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
   * shows the message unconditionally.
   *
   * Omitting it does NOT mean "no error can be shown": the `Field.Error` slot
   * is always in the tree, so whatever message the browser's native
   * validation or a `validate` function produces renders there, with the
   * icon, exactly as a supplied `error` would. The slot renders nothing while
   * the field is valid.
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
 * from Base UI, no context read. `Field.test.tsx` asserts the two produce
 * identical DOM, which is ADR-0011 §2's rule made mechanical: if this
 * component ever needs something the compound parts cannot express, the
 * compound API is what gets fixed. The one exception is `nonNativeLabel.js`,
 * this component's own internal helper (not Base UI, not context) — see the
 * protocol note below.
 *
 * **The non-native-label protocol.** Select's trigger (Task 5 of Phase 5c)
 * is a `<button role="combobox">`. A `<button>` is labelable, and Base UI
 * wires a native `<label for>` to it correctly, so association is not the
 * problem. The problem is what a native label does to the element it labels
 * (spec §4.3): a click on the label is forwarded to the button, which opens
 * the popup, and hovering the label puts the button in `:hover`. A label
 * should do neither to a Select's trigger. Such a control opts in by carrying
 * `[NON_NATIVE_LABEL]: true` as a static property (`nonNativeLabel.ts`,
 * `usesNonNativeLabel`), and when `Field` detects that marker on `children`'s
 * `type`, it does three things instead of its ordinary single `<label>`:
 *
 *  1. Renders `<Field.Label nativeLabel={false} render={<div />} id={labelId}>`
 *     — a `<div>`, not a `<label>`, so no native label forwards its click
 *     and hover to the trigger. Both props, always together: with
 *     `nativeLabel={false}` alone Base UI still renders a `<label>`.
 *  2. Clones the child with `aria-labelledby={labelId}`, unless it already
 *     carries its own `aria-labelledby` (a caller's explicit override wins).
 *  3. Generates `labelId` with `useId()` here, in `Field`, rather than
 *     leaving it to be registered later.
 *
 * That third point is R16 (5b plan, "Deviations", corrected): Base UI
 * registers the LABEL's id from a layout effect (`useRegisteredLabelId`),
 * and the trigger reads its `aria-labelledby` from that registration, so
 * without an explicit id both are missing from server-rendered HTML. With a
 * `<div>` label there is no native `for` to name the trigger instead.
 * Confirmed by a direct `renderToString` probe against Base UI 1.7.0 before
 * this task was planned. Generating the id here and passing it to both ends
 * closes that gap. Be precise about what it buys, because the broader claim is
 * wrong: **this makes the control NAMED in streamed and pre-hydration markup
 * for assistive technology. It does not make the control OPERABLE with
 * JavaScript off** — Select's popup still needs hydration to open at all.
 */
const FieldBase = forwardRef<HTMLDivElement, FieldProps>(function Field(
  { label, hint, error, children, ...rest },
  ref,
) {
  // An empty string is not an error. A server action that returns `''` for a
  // field that passed would otherwise flip the whole field to invalid and
  // render an error row with no message in it.
  const hasError = error !== undefined && error !== ''
  // Always called, unconditionally, per the rules of hooks — but only ever
  // READ (below) when `nonNative` is true. Reading it unconditionally would
  // be harmless too, but passing it as `id`/`aria-labelledby` outside that
  // branch would be exactly the `prop={undefined}` mistake the global
  // constraints forbid: Base UI's `for...in` prop merge lets an explicit
  // `undefined` win over whatever it would otherwise compute.
  const labelId = useId()
  const nonNative = usesNonNativeLabel(children)
  const labelledChild =
    nonNative && isValidElement<{ 'aria-labelledby'?: string }>(children)
      ? children.props['aria-labelledby'] === undefined
        ? cloneElement(children, { 'aria-labelledby': labelId })
        : children
      : children
  return (
    <FieldRoot {...rest} {...(hasError ? { invalid: true } : {})} ref={ref}>
      <FieldLabel {...(nonNative ? { nativeLabel: false, render: <div />, id: labelId } : {})}>
        {label}
      </FieldLabel>
      {labelledChild}
      {hint !== undefined ? <FieldDescription>{hint}</FieldDescription> : null}
      {/*
        The error slot is UNCONDITIONAL, and that is the whole point of it.
        Rendering it only when `error` is supplied leaves a field that failed
        the browser's own validation carrying `aria-invalid` and the invalid
        border with nothing at all to read — colour alone, the failure
        ADR-0011 §5 exists to prevent, reached through the recommended API.
        Base UI's `FieldError` returns null when it has no `match` and the
        field is valid, so nothing mounts in the ordinary case.

        `match` and `children` are both conditionally SPREAD rather than passed
        as `undefined`. Base UI merges element props with `for...in`
        (`merge-props/mergeProps.mjs`), which visits a key whose value is
        `undefined` and lets it win — so a literal `children={undefined}` would
        overwrite the native validity message with nothing, silently
        reintroducing the exact defect this slot fixes.
      */}
      <FieldError {...(hasError ? { match: true, children: error } : {})} />
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
