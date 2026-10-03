'use client'

import { forwardRef, type Ref } from 'react'
import { Popover as BasePopover } from '@base-ui/react/popover'
import type {
  PopoverCloseProps as BaseCloseProps,
  PopoverDescriptionProps as BaseDescriptionProps,
  PopoverPopupProps as BasePopupProps,
  PopoverPositionerProps,
  PopoverRootProps as BaseRootProps,
  PopoverTitleProps as BaseTitleProps,
  PopoverTriggerProps as BaseTriggerProps,
} from '@base-ui/react/popover'
import { Icon } from '../../icons/Icon.js'
import { deriveNativeButton } from '../../internal/deriveNativeButton.js'
import { POSITIONER_SIDE_OFFSET } from '../../internal/positioner.js'
import { useMessages } from '../../providers/LocaleProvider.js'
import {
  popoverDescriptionClass,
  popoverDismissClass,
  popoverPopupClass,
  popoverPositionerClass,
  popoverTitleClass,
} from './Popover.css.js'

export { POPOVER_TOKENS } from './Popover.tokens.js'

/**
 * These wrappers add styling and nothing else. Modality, focus and dismissal
 * are Base UI's: `modal` defaults to false, so a Popover never traps focus
 * (`popover/root/PopoverRoot.js:26`), and Tab out of it closes it.
 */

function merge(recipeClass: string, className: string | undefined): string {
  return [recipeClass, className].filter(Boolean).join(' ')
}

export type PopoverRootProps = BaseRootProps

/** Base UI's root, unchanged. It renders no element, and `modal` stays available. */
export const PopoverRoot = BasePopover.Root

export type PopoverTriggerProps = BaseTriggerProps

/** Derives `nativeButton` from `render` (§4.1.1), as `SelectTrigger` does. An explicit value wins. */
export const PopoverTrigger = forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  function PopoverTrigger({ render, nativeButton, ...rest }, ref) {
    return (
      <BasePopover.Trigger
        {...rest}
        ref={ref}
        {...(render !== undefined ? { render } : {})}
        nativeButton={nativeButton ?? deriveNativeButton(render)}
      />
    )
  },
)

/** The placement a consumer may change, plus the positioner's `ref`. Everything else is fixed. */
export type PopoverPositionerOptions = Pick<
  PopoverPositionerProps,
  'side' | 'align' | 'sideOffset' | 'alignOffset' | 'collisionPadding'
> & {
  ref?: Ref<HTMLDivElement>
}

export interface PopoverPopupProps extends Omit<BasePopupProps, 'className'> {
  /** Overrides for the positioner's placement. `className` and `ref` address the popup. */
  positioner?: PopoverPositionerOptions
  className?: string
}

/**
 * Composes `Popover.Portal > Popover.Positioner > Popover.Popup`. Adds
 * `side="bottom"` and the token-derived `sideOffset` (§4.1.7), passed
 * explicitly though `side` matches Base UI's default, so neither is ever
 * inherited by accident.
 *
 * A closed popover is absent from server HTML (§4.1.9): the portal renders
 * only when `mounted || keepMounted`, and `keepMounted` is never set here
 * (`popover/portal/PopoverPortal.js:23-28`).
 */
export const PopoverPopup = forwardRef<HTMLDivElement, PopoverPopupProps>(function PopoverPopup(
  { positioner, className, ...rest },
  ref,
) {
  // Only defined overrides are spread: Base UI's merge lets an explicit
  // `undefined` win, which would silently drop a default above.
  const overrides = Object.fromEntries(
    Object.entries(positioner ?? {}).filter(([, value]) => value !== undefined),
  ) as PopoverPositionerOptions
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner
        side="bottom"
        sideOffset={POSITIONER_SIDE_OFFSET}
        {...overrides}
        className={popoverPositionerClass}
      >
        <BasePopover.Popup {...rest} ref={ref} className={merge(popoverPopupClass, className)} />
      </BasePopover.Positioner>
    </BasePopover.Portal>
  )
})

export interface PopoverTitleProps extends Omit<BaseTitleProps, 'className'> {
  className?: string
}

export const PopoverTitle = forwardRef<HTMLHeadingElement, PopoverTitleProps>(
  function PopoverTitle({ className, ...rest }, ref) {
    return (
      <BasePopover.Title {...rest} ref={ref} className={merge(popoverTitleClass, className)} />
    )
  },
)

export interface PopoverDescriptionProps extends Omit<BaseDescriptionProps, 'className'> {
  className?: string
}

export const PopoverDescription = forwardRef<HTMLParagraphElement, PopoverDescriptionProps>(
  function PopoverDescription({ className, ...rest }, ref) {
    return (
      <BasePopover.Description
        {...rest}
        ref={ref}
        className={merge(popoverDescriptionClass, className)}
      />
    )
  },
)

export type PopoverCloseProps = BaseCloseProps

/** Base UI's close part, with the `nativeButton` derivation. */
export const PopoverClose = forwardRef<HTMLButtonElement, PopoverCloseProps>(
  function PopoverClose({ render, nativeButton, ...rest }, ref) {
    return (
      <BasePopover.Close
        {...rest}
        ref={ref}
        {...(render !== undefined ? { render } : {})}
        nativeButton={nativeButton ?? deriveNativeButton(render)}
      />
    )
  },
)

export interface PopoverDismissProps extends Omit<BaseCloseProps, 'className'> {
  className?: string
}

/**
 * The icon dismiss. Its name comes from the message registry, never a
 * literal (ADR-0012), like `DialogDismiss`. A caller can still override it
 * with `aria-label`.
 */
export const PopoverDismiss = forwardRef<HTMLButtonElement, PopoverDismissProps>(
  function PopoverDismiss({ className, ...rest }, ref) {
    const messages = useMessages()
    return (
      <BasePopover.Close
        aria-label={messages.close}
        {...rest}
        ref={ref}
        className={merge(popoverDismissClass, className)}
      >
        <Icon name="close" />
      </BasePopover.Close>
    )
  },
)
