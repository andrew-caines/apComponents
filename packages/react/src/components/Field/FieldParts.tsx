'use client'

import { forwardRef, type Ref } from 'react'
import { Field as BaseField } from '@base-ui/react/field'
import type {
  FieldControlProps as BaseFieldControlProps,
  FieldDescriptionProps as BaseFieldDescriptionProps,
  FieldErrorProps as BaseFieldErrorProps,
  FieldLabelProps as BaseFieldLabelProps,
  FieldRootProps as BaseFieldRootProps,
} from '@base-ui/react/field'
import { Icon } from '../../icons/Icon.js'
import {
  fieldDescriptionClass,
  fieldErrorClass,
  fieldErrorIconClass,
  fieldLabelClass,
  fieldRootClass,
} from './Field.css.js'

export { FIELD_TOKENS } from './Field.tokens.js'

/**
 * These wrappers add styling and nothing else. In particular they never
 * compute, read or pass `id`, `aria-describedby` or `aria-invalid`: Base UI's
 * `LabelableProvider` owns all three, the description and error register their
 * own ids into it from a layout effect, and the control merges them. Passing
 * any of those by hand here would produce a SECOND, conflicting wiring that
 * looks correct in one test and silently wins over the real one elsewhere.
 *
 * One consequence worth knowing: because the ids register from an effect,
 * `aria-describedby` is absent from server-rendered HTML and appears after
 * hydration. Both render passes agree, so this is not a hydration mismatch —
 * but never assert the attribute against server markup.
 */

function merge(recipeClass: string, className: string | undefined): string {
  return [recipeClass, className].filter(Boolean).join(' ')
}

export interface FieldRootProps extends Omit<BaseFieldRootProps, 'className'> {
  className?: string
}

export const FieldRoot = forwardRef<HTMLDivElement, FieldRootProps>(function FieldRoot(
  { className, ...rest },
  ref,
) {
  return <BaseField.Root {...rest} ref={ref} className={merge(fieldRootClass, className)} />
})

export interface FieldLabelProps extends Omit<BaseFieldLabelProps, 'className'> {
  className?: string
}

export const FieldLabel = forwardRef<HTMLLabelElement, FieldLabelProps>(function FieldLabel(
  { className, ...rest },
  ref,
) {
  return (
    <BaseField.Label
      {...rest}
      // Base UI types this ref as `Ref<HTMLElement>` while rendering a real
      // `<label>`; a mutable ref is invariant in its element type, so the
      // narrower ref is not assignable without a cast. Same reasoning as
      // Input.tsx — the cast lives here so consumers get the accurate type.
      ref={ref as Ref<HTMLElement>}
      className={merge(fieldLabelClass, className)}
    />
  )
})

/**
 * The unstyled control slot. `Input` is the styled one and is what a product
 * normally uses; `Field.Control` stays available for a control this library
 * does not ship yet.
 *
 * Note that `size` here is Base UI's passthrough of the HTML `size` attribute
 * — the legacy integer width in characters — because this part is unstyled and
 * has no type scale to name. `Input` renders the same `<input>` element but
 * redeclares `size` as the `'sm' | 'md' | 'lg'` recipe variant (see
 * `Input.tsx`). Same prop name, same rendered element, two different meanings:
 * check which component you are on before reading a `size` on a field control.
 */
export interface FieldControlProps extends Omit<BaseFieldControlProps, 'className'> {
  className?: string
}

export const FieldControl = forwardRef<HTMLInputElement, FieldControlProps>(function FieldControl(
  { className, ...rest },
  ref,
) {
  return (
    <BaseField.Control
      {...rest}
      // See the ref note on FieldLabel above — Base UI types it as HTMLElement.
      ref={ref as Ref<HTMLElement>}
      // A conditional spread, not `merge()`, because this part is deliberately
      // unstyled: there is no recipe class to merge the consumer's className
      // with, and under exactOptionalPropertyTypes passing `className:
      // undefined` is not the same as omitting it.
      {...(className !== undefined ? { className } : {})}
    />
  )
})

export interface FieldDescriptionProps extends Omit<BaseFieldDescriptionProps, 'className'> {
  className?: string
}

export const FieldDescription = forwardRef<HTMLParagraphElement, FieldDescriptionProps>(
  function FieldDescription({ className, ...rest }, ref) {
    return (
      <BaseField.Description
        {...rest}
        ref={ref}
        className={merge(fieldDescriptionClass, className)}
      />
    )
  },
)

/**
 * `render` is deliberately NOT part of this component's props.
 *
 * ADR-0011 §5 makes "an error is an icon and text, never colour alone" a
 * structural guarantee rather than a review note, and this part keeps that
 * guarantee by owning its own `render` function. Exposing `render` here would
 * hand a consumer the one prop that can remove the icon — which is exactly the
 * WCAG 1.4.1 failure the rule exists to prevent.
 *
 * The render function receives the fully merged element props, so whichever
 * message won — the consumer's `children` or Base UI's native validity
 * message, in that precedence — is what gets wrapped.
 */
export interface FieldErrorProps extends Omit<BaseFieldErrorProps, 'className' | 'render'> {
  className?: string
}

export const FieldError = forwardRef<HTMLDivElement, FieldErrorProps>(function FieldError(
  { className, ...rest },
  ref,
) {
  return (
    <BaseField.Error
      {...rest}
      ref={ref}
      className={merge(fieldErrorClass, className)}
      render={(props) => {
        const { children, ...elementProps } = props
        return (
          <div {...elementProps}>
            <Icon name="alert-circle" className={fieldErrorIconClass} />
            {/*
              A `<div>`, not a `<span>`: when a control fails more than one
              constraint at once, Base UI's FieldError passes a `<ul><li>…`
              element as `children` (see `field/error/FieldError.mjs`), and
              `<ul>` inside `<span>` violates the HTML content model. The
              layout is unchanged — this element is a flex item of the error
              row either way, and a flex item is blockified regardless of the
              tag it was written with.
            */}
            <div>{children}</div>
          </div>
        )
      }}
    />
  )
})
