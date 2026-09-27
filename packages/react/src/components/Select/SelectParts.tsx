'use client'

import { forwardRef, type Ref } from 'react'
import { Select as BaseSelect } from '@base-ui/react/select'
import type {
  SelectGroupLabelProps as BaseGroupLabelProps,
  SelectGroupProps as BaseGroupProps,
  SelectIconProps as BaseIconProps,
  SelectItemProps as BaseItemProps,
  SelectListProps as BaseListProps,
  SelectPopupProps as BasePopupProps,
  SelectPositionerProps,
  SelectRootProps as BaseRootProps,
  SelectSeparatorProps as BaseSeparatorProps,
  SelectTriggerProps as BaseTriggerProps,
  SelectValueProps as BaseValueProps,
} from '@base-ui/react/select'
import { Icon } from '../../icons/Icon.js'
import { deriveNativeButton } from '../../internal/deriveNativeButton.js'
import { POSITIONER_SIDE_OFFSET } from '../../internal/positioner.js'
import {
  selectGroupLabelClass,
  selectIconClass,
  selectItemClass,
  selectItemIndicatorClass,
  selectItemTextClass,
  selectPopupClass,
  selectPositionerClass,
  selectSeparatorClass,
  selectTriggerRecipe,
  selectValueClass,
} from './Select.css.js'

export { SELECT_TOKENS } from './Select.tokens.js'

/**
 * Like `FieldParts.tsx`, these wrappers never compute, read or pass `id`,
 * `aria-describedby` or `aria-invalid`. Base UI's labelable context owns all
 * three and the trigger merges them; a second, hand-passed wiring here would
 * silently win over the real one. The one labelling attribute that does
 * travel by hand — `aria-labelledby` pointing at a server-rendered label id —
 * is written by `Field`'s protocol, never by these parts.
 */

function merge(recipeClass: string, className: string | undefined): string {
  return [recipeClass, className].filter(Boolean).join(' ')
}

export type SelectRootProps<Value, Multiple extends boolean | undefined = false> = BaseRootProps<
  Value,
  Multiple
>

/**
 * Base UI's root, unchanged: it renders no element, so there is nothing to
 * style, and it stays generic over `Value` and `Multiple` exactly as Base UI's
 * is. Adds nothing.
 */
export const SelectRoot = BaseSelect.Root

export interface SelectTriggerProps extends Omit<BaseTriggerProps, 'className'> {
  /** Type scale and padding, matching `Input`'s `size`. Defaults to `md`. */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * Adds the field styling and derives `nativeButton` from `render` (§4.1.1),
 * as `Button` does, so a trigger rendered as an anchor is not told it is a
 * native button. An explicit `nativeButton` still wins.
 */
export const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  function SelectTrigger({ size = 'md', className, render, nativeButton, ...rest }, ref) {
    return (
      <BaseSelect.Trigger
        {...rest}
        ref={ref}
        {...(render !== undefined ? { render } : {})}
        nativeButton={nativeButton ?? deriveNativeButton(render)}
        className={merge(selectTriggerRecipe({ size }), className)}
      />
    )
  },
)

export interface SelectValueProps extends Omit<BaseValueProps, 'className'> {
  className?: string
}

/** Adds single-line truncation. */
export const SelectValue = forwardRef<HTMLSpanElement, SelectValueProps>(function SelectValue(
  { className, ...rest },
  ref,
) {
  return <BaseSelect.Value {...rest} ref={ref} className={merge(selectValueClass, className)} />
})

export interface SelectIconProps extends Omit<BaseIconProps, 'className'> {
  className?: string
}

/**
 * Adds a decorative chevron as the default children. Base UI's icon is
 * already hidden from assistive technology, and so is `Icon` without a label.
 */
export const SelectIcon = forwardRef<HTMLSpanElement, SelectIconProps>(function SelectIcon(
  { className, children, ...rest },
  ref,
) {
  return (
    <BaseSelect.Icon {...rest} ref={ref} className={merge(selectIconClass, className)}>
      {children ?? <Icon name="chevron-down" />}
    </BaseSelect.Icon>
  )
})

/** The placement a consumer may change. Everything else about the positioner is fixed. */
export type SelectPositionerOptions = Pick<
  SelectPositionerProps,
  'side' | 'align' | 'sideOffset' | 'alignOffset' | 'collisionPadding'
>

export interface SelectPopupProps extends Omit<BasePopupProps, 'className'> {
  /** Overrides for the positioner's placement. `className` and `ref` address the popup. */
  positioner?: SelectPositionerOptions
  className?: string
}

/**
 * Composes `Select.Portal > Select.Positioner > Select.Popup`, so a consumer
 * never assembles the portal and positioner by hand. Adds three defaults:
 *
 * - **`side="bottom"`** and the token-derived `sideOffset` (§4.1.7).
 * - **`alignItemWithTrigger={false}`.** Base UI defaults it on, which overlays
 *   the selected item on the trigger and ignores `side` and `align`
 *   altogether; a Select here opens below its trigger like every other
 *   anchored popup.
 *
 * A closed Select's popup is absent from server HTML (§4.1.9). No prop
 * guarantees that — `Select.Portal` has no `keepMounted` in Base UI 1.7.0.
 * The portal renders nothing until `mounted || forceMount`
 * (`portal/SelectPortal.mjs`): `mounted` is true only while the popup is
 * open or animating out, and `forceMount` is set only on the client, on
 * trigger focus (`trigger/SelectTrigger.mjs`) or an autofill change of the
 * hidden input. Neither holds while a closed Select renders on the server.
 */
export const SelectPopup = forwardRef<HTMLDivElement, SelectPopupProps>(function SelectPopup(
  { positioner, className, ...rest },
  ref,
) {
  // Only defined overrides are spread: Base UI's merge lets an explicit
  // `undefined` win, which would silently drop a default above.
  const overrides = Object.fromEntries(
    Object.entries(positioner ?? {}).filter(([, value]) => value !== undefined),
  ) as SelectPositionerOptions
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner
        side="bottom"
        sideOffset={POSITIONER_SIDE_OFFSET}
        alignItemWithTrigger={false}
        {...overrides}
        className={selectPositionerClass}
      >
        <BaseSelect.Popup {...rest} ref={ref} className={merge(selectPopupClass, className)} />
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  )
})

export interface SelectListProps extends Omit<BaseListProps, 'className'> {
  className?: string
}

/** Adds nothing but the `className` merge; the listbox's layout lives on its items. */
export const SelectList = forwardRef<HTMLDivElement, SelectListProps>(function SelectList(
  { className, ...rest },
  ref,
) {
  return (
    <BaseSelect.List {...rest} ref={ref} {...(className !== undefined ? { className } : {})} />
  )
})

/**
 * `render` is deliberately NOT part of this component's props.
 *
 * ADR-0011 §5 makes "selection is a glyph, never colour alone" a structural
 * guarantee rather than a review note (§4.1.4), and this part keeps that
 * guarantee by owning its own markup: `Select.ItemIndicator` with the check
 * icon, then `Select.ItemText` with the children. Exposing `render` here would
 * hand a consumer the one prop that can remove the indicator — which is
 * exactly the WCAG 1.4.1 failure the rule exists to prevent. `FieldError` is
 * the precedent.
 */
export interface SelectItemProps extends Omit<BaseItemProps, 'className' | 'render'> {
  className?: string
}

export const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(function SelectItem(
  { className, children, ...rest },
  ref,
) {
  return (
    <BaseSelect.Item
      {...rest}
      // Base UI types this ref as `Ref<HTMLElement>` while rendering a
      // `<div>`; the cast lives here so consumers get the accurate type, as in
      // FieldParts.tsx.
      ref={ref as Ref<HTMLElement>}
      className={merge(selectItemClass, className)}
    >
      <BaseSelect.ItemIndicator className={selectItemIndicatorClass}>
        <Icon name="check" />
      </BaseSelect.ItemIndicator>
      <BaseSelect.ItemText className={selectItemTextClass}>{children}</BaseSelect.ItemText>
    </BaseSelect.Item>
  )
})

export interface SelectGroupProps extends Omit<BaseGroupProps, 'className'> {
  className?: string
}

/** Adds nothing but the `className` merge; the group's label carries the styling. */
export const SelectGroup = forwardRef<HTMLDivElement, SelectGroupProps>(function SelectGroup(
  { className, ...rest },
  ref,
) {
  return (
    <BaseSelect.Group {...rest} ref={ref} {...(className !== undefined ? { className } : {})} />
  )
})

export interface SelectGroupLabelProps extends Omit<BaseGroupLabelProps, 'className'> {
  className?: string
}

/** Adds the group heading's type and colour. */
export const SelectGroupLabel = forwardRef<HTMLDivElement, SelectGroupLabelProps>(
  function SelectGroupLabel({ className, ...rest }, ref) {
    return (
      <BaseSelect.GroupLabel
        {...rest}
        ref={ref}
        className={merge(selectGroupLabelClass, className)}
      />
    )
  },
)

export interface SelectSeparatorProps extends Omit<BaseSeparatorProps, 'className'> {
  className?: string
}

/** Adds the rule's thickness, spacing and colour. */
export const SelectSeparator = forwardRef<HTMLDivElement, SelectSeparatorProps>(
  function SelectSeparator({ className, ...rest }, ref) {
    return (
      <BaseSelect.Separator
        {...rest}
        ref={ref}
        className={merge(selectSeparatorClass, className)}
      />
    )
  },
)
