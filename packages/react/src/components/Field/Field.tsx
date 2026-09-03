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
