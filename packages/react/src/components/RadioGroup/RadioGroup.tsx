'use client'

import { forwardRef } from 'react'
import { RadioGroupItem, RadioGroupRoot, type RadioGroupRootProps } from './RadioGroupParts.js'

export { RADIO_GROUP_TOKENS } from './RadioGroup.tokens.js'
export type { RadioGroupItemProps, RadioGroupRootProps } from './RadioGroupParts.js'

/** One selectable option. `hint` is copy for that option alone. */
export interface RadioGroupOption {
  value: string
  label: string
  hint?: string
}

export interface RadioGroupProps extends Omit<RadioGroupRootProps, 'children' | 'name'> {
  /**
   * Identifies the group when a form is submitted. Required, unlike Base UI's
   * optional `name`: a radio group with no name posts nothing at all, which is
   * a silent failure rather than a visible one.
   */
  name: string
  /**
   * The options, in the order they should read. Each `value` must be unique
   * within the group — it is what the form posts, and what `defaultValue`
   * selects against.
   */
  options: ReadonlyArray<RadioGroupOption>
  /** Size of every option's control. Defaults to `md`. */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Marks every option invalid — `radioRecipe`'s `&[data-invalid]` border and
   * `aria-invalid` on the group. See `RadioGroupRootProps.invalid` (this
   * type's own source) for why the prop has to live here rather than being
   * reachable through an outer `Field.Root`.
   *
   * Redeclared here (rather than left as a bare inherited property) because
   * this is a COLOUR-AND-BORDER CUE ONLY: ADR-0011 §5 requires that semantic
   * state is never colour alone, so setting `invalid` with nothing else
   * changes is an accessibility defect, not a complete error state. `Field`'s
   * own `error` prop enforces the pairing structurally — supplying it marks
   * the field invalid AND renders the message, because `Field.Error` is
   * unconditionally in the tree — but `RadioGroup` has no such slot: `invalid`
   * alone renders no message. A caller setting `invalid` must pair it with
   * their own visible copy explaining what is wrong, placed near the group —
   * `RadioGroup.stories.tsx`'s `Invalid` story does this with a plain `<p>`,
   * the same pairing `Field`'s `error` prop automates for `Field.Error`.
   */
  invalid?: boolean
}

/**
 * The convenience assembly of the compound parts, for the common case:
 *
 * ```tsx
 * <RadioGroup
 *   label="How should we reach you?"
 *   name="contact"
 *   defaultValue="email"
 *   options={[
 *     { value: 'email', label: t('email') },
 *     { value: 'sms', label: t('sms'), hint: t('smsRates') },
 *   ]}
 * />
 * ```
 *
 * Everything below this comment uses only the two exported parts — no import
 * from Base UI, no context read, no internal helper. That is ADR-0011 §2's
 * rule made mechanical: if this component ever needs something the compound
 * parts cannot express, the compound API is what gets fixed.
 *
 * `size` is applied per option rather than held on the root, because Base UI's
 * radio group publishes no context of ours for a part to read it from and
 * inventing one would put a second source of truth beside the recipe variant.
 * A caller using the compound API directly passes `size` to each
 * `RadioGroup.Item`; this component does that mapping for them.
 */
const RadioGroupBase = forwardRef<HTMLFieldSetElement, RadioGroupProps>(function RadioGroup(
  { options, size = 'md', ...rest },
  ref,
) {
  return (
    <RadioGroupRoot {...rest} ref={ref}>
      {options.map((option) => (
        <RadioGroupItem
          key={option.value}
          value={option.value}
          label={option.label}
          size={size}
          // Conditionally SPREAD, never passed as `hint={option.hint}`. Base
          // UI merges element props with `for...in`
          // (`merge-props/mergeProps.mjs`), which visits a key whose value is
          // `undefined` and lets it win — and under
          // `exactOptionalPropertyTypes` an explicit `undefined` is not the
          // same as an omitted prop either.
          {...(option.hint !== undefined ? { hint: option.hint } : {})}
        />
      ))}
    </RadioGroupRoot>
  )
})

/**
 * `RadioGroup` is both the convenience component and the namespace holding its
 * parts, exactly as `Field` is: `<RadioGroup label … options />` for the common
 * case, `<RadioGroup.Root>` + `<RadioGroup.Item>` when an option needs markup
 * this component does not render.
 */
export const RadioGroup = Object.assign(RadioGroupBase, {
  Root: RadioGroupRoot,
  Item: RadioGroupItem,
})
