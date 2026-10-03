'use client'

import type { ReactElement, ReactNode } from 'react'
import {
  PopoverClose,
  PopoverDescription,
  PopoverDismiss,
  PopoverPopup,
  PopoverRoot,
  PopoverTitle,
  PopoverTrigger,
  type PopoverCloseProps,
  type PopoverDescriptionProps,
  type PopoverDismissProps,
  type PopoverPopupProps,
  type PopoverPositionerOptions,
  type PopoverRootProps,
  type PopoverTitleProps,
  type PopoverTriggerProps,
} from './PopoverParts.js'
import { popoverHeaderClass } from './Popover.css.js'

export { POPOVER_TOKENS } from './PopoverParts.js'
export type {
  PopoverCloseProps,
  PopoverDescriptionProps,
  PopoverDismissProps,
  PopoverPopupProps,
  PopoverPositionerOptions,
  PopoverRootProps,
  PopoverTitleProps,
  PopoverTriggerProps,
}

/**
 * A popover must have a name: either a visible `title` or an `aria-label`,
 * never both and never neither. A popup announced only as "dialog" gives a
 * screen-reader user no way to know what opened, for the same reason `Dialog`
 * requires a title.
 */
export type PopoverName =
  { title: string; 'aria-label'?: never } | { 'aria-label': string; title?: never }

export type PopoverProps = Omit<PopoverRootProps, 'children' | 'modal'> &
  PopoverName & {
    /**
     * What opens it. One element, rendered THROUGH `Popover.Trigger` so it
     * stays one button, as `Dialog` renders its trigger.
     */
    trigger: ReactElement
    /** Supporting copy, wired as the popover's description. */
    description?: string
    /**
     * Render an icon dismiss button in the header. Default false: Escape and
     * an outside press still close it.
     */
    dismissible?: boolean
    /**
     * Open on hover as well as on click. Hover-open does NOT move focus into
     * the popup, so keyboard users open it with Enter or Space, which does.
     */
    openOnHover?: boolean
    /** Milliseconds before opening on hover. A trigger prop in Base UI. Default 300. */
    delay?: number
    /** Milliseconds before closing after the pointer leaves. A trigger prop in Base UI. */
    closeDelay?: number
    /** Which side of the trigger the popover prefers. Defaults to `bottom`. */
    side?: PopoverPositionerOptions['side']
    children: ReactNode
  }

function PopoverBase({
  title,
  'aria-label': ariaLabel,
  trigger,
  description,
  dismissible = false,
  openOnHover,
  delay,
  closeDelay,
  side,
  children,
  ...root
}: PopoverProps) {
  return (
    <PopoverRoot {...root}>
      <PopoverTrigger
        render={trigger}
        {...(openOnHover !== undefined ? { openOnHover } : {})}
        {...(delay !== undefined ? { delay } : {})}
        {...(closeDelay !== undefined ? { closeDelay } : {})}
      />
      <PopoverPopup
        {...(ariaLabel !== undefined ? { 'aria-label': ariaLabel } : {})}
        {...(side !== undefined ? { positioner: { side } } : {})}
      >
        {(title !== undefined || dismissible) && (
          <div className={popoverHeaderClass}>
            {title !== undefined && <PopoverTitle>{title}</PopoverTitle>}
            {dismissible && <PopoverDismiss />}
          </div>
        )}
        {description !== undefined && <PopoverDescription>{description}</PopoverDescription>}
        {children}
      </PopoverPopup>
    </PopoverRoot>
  )
}

/**
 * `Popover` is both the convenience component and the namespace holding its
 * parts, as `Tooltip` and `Select` are.
 */
export const Popover = Object.assign(PopoverBase, {
  Root: PopoverRoot,
  Trigger: PopoverTrigger,
  Popup: PopoverPopup,
  Title: PopoverTitle,
  Description: PopoverDescription,
  Close: PopoverClose,
  Dismiss: PopoverDismiss,
})
