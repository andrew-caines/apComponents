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

export interface FieldProps extends Omit<FieldRootProps, 'children'> {
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
   * shows the message unconditionally; omitting it leaves native validation
   * in charge, which still renders through `Field.Error`.
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
      {hasError ? <FieldError match>{error}</FieldError> : null}
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
