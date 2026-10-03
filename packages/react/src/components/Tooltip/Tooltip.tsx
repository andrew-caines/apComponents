'use client'

import type { ReactElement, ReactNode } from 'react'
import {
  TooltipPopup,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  type TooltipPopupProps,
  type TooltipPositionerOptions,
  type TooltipProviderProps,
  type TooltipRootProps,
  type TooltipTriggerProps,
} from './TooltipParts.js'

export { TOOLTIP_TOKENS } from './TooltipParts.js'
export type {
  TooltipPopupProps,
  TooltipPositionerOptions,
  TooltipProviderProps,
  TooltipRootProps,
  TooltipTriggerProps,
}

export interface TooltipProps extends Omit<TooltipRootProps, 'children'> {
  /**
   * The tooltip text or markup. Any node is accepted, but never interactive
   * content: a tooltip closes when the pointer or focus leaves its trigger,
   * so a link or button inside it is unreachable by keyboard. Use `Popover`
   * for that. It describes the trigger and is never the only copy of its
   * name: an icon-only trigger still needs its own `aria-label`.
   */
  content: ReactNode
  /**
   * The trigger. One element, rendered THROUGH `Tooltip.Trigger` so it stays
   * one button. A disabled `Button` cannot open a tooltip: a disabled control
   * receives no pointer or focus events. Wrap it in a focusable, non-disabled
   * element (for example a `span` with `tabIndex={0}`) or keep the control
   * enabled and use `aria-disabled`.
   */
  children: ReactElement
  /** Which side of the trigger the tooltip prefers. Defaults to `top`. */
  side?: TooltipPositionerOptions['side']
  /** Milliseconds before opening on hover. A trigger prop in Base UI. Default 600. */
  delay?: number
  /** Milliseconds before closing after the pointer leaves. A trigger prop in Base UI. */
  closeDelay?: number
}

function TooltipBase({ content, children, side, delay, closeDelay, ...rest }: TooltipProps) {
  return (
    <TooltipRoot {...rest}>
      <TooltipTrigger
        render={children}
        {...(delay !== undefined ? { delay } : {})}
        {...(closeDelay !== undefined ? { closeDelay } : {})}
      />
      <TooltipPopup {...(side !== undefined ? { positioner: { side } } : {})}>
        {content}
      </TooltipPopup>
    </TooltipRoot>
  )
}

/**
 * `Tooltip` is both the convenience component and the namespace holding its
 * parts, as `Select` is.
 */
export const Tooltip = Object.assign(TooltipBase, {
  Provider: TooltipProvider,
  Root: TooltipRoot,
  Trigger: TooltipTrigger,
  Popup: TooltipPopup,
})
