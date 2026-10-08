'use client'

import { forwardRef } from 'react'
import { Toast as BaseToast } from '@base-ui/react/toast'
import { Icon } from '../../icons/Icon.js'
import { deriveNativeButton } from '../../internal/deriveNativeButton.js'
import { useMessages } from '../../providers/LocaleProvider.js'
import {
  toastActionClass,
  toastCloseClass,
  toastDescriptionClass,
  toastRootClass,
  toastTitleClass,
  toastViewportRecipe,
} from './Toast.css.js'

export { TOAST_TOKENS } from './Toast.tokens.js'

/**
 * These wrappers add styling and nothing else. The queue, timers, pause on
 * hover and focus, swipe and the live region are Base UI's.
 */

function merge(recipeClass: string, className: string | undefined): string {
  return [recipeClass, className].filter(Boolean).join(' ')
}

export type ToastPlacement =
  | 'top-start'
  | 'top-center'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-center'
  | 'bottom-end'

type SwipeDirection = 'up' | 'down' | 'left' | 'right'

/**
 * The directions that dismiss a toast docked at `placement`: the nearest inline
 * edge plus the nearest block edge. A `*-center` toast has no inline edge. In a
 * right-to-left page the inline direction flips.
 */
export function swipeDirectionsFor(
  placement: ToastPlacement,
  direction: 'ltr' | 'rtl' = 'ltr',
): SwipeDirection[] {
  const block: SwipeDirection = placement.startsWith('top') ? 'up' : 'down'
  if (placement.endsWith('center')) return [block]
  const physicalEnd: SwipeDirection = direction === 'rtl' ? 'left' : 'right'
  const physicalStart: SwipeDirection = direction === 'rtl' ? 'right' : 'left'
  return [placement.endsWith('end') ? physicalEnd : physicalStart, block]
}

export interface ToastViewportProps extends Omit<BaseToast.Viewport.Props, 'className'> {
  /** Where the stack docks. Defaults to `bottom-end`. */
  placement?: ToastPlacement
  className?: string
}

/**
 * Base UI's viewport with the placement recipe. Adds `aria-label` from the
 * `notifications` message, before `rest` so a caller can still override it
 * (`DialogDismiss` is the precedent). Base UI's own default is the English
 * `'Notifications'` (`toast/viewport/ToastViewport.js:189`).
 */
export const ToastViewport = forwardRef<HTMLDivElement, ToastViewportProps>(function ToastViewport(
  { placement = 'bottom-end', className, ...rest },
  ref,
) {
  const messages = useMessages()
  return (
    <BaseToast.Viewport
      aria-label={messages.notifications}
      {...rest}
      ref={ref}
      className={merge(toastViewportRecipe({ placement }), className)}
    />
  )
})

export interface ToastRootProps extends Omit<BaseToast.Root.Props, 'className'> {
  /**
   * Which edge the toast is docked to. Written to `data-placement`, which the
   * motion rules key on, and the default for `swipeDirection`. Defaults to
   * `bottom-end`.
   */
  placement?: ToastPlacement
  className?: string
}

/**
 * Base UI's root with the toast recipe. Adds `data-placement`, and defaults
 * `swipeDirection` to the placement's own edges (Base UI's default is
 * `['down', 'right']`, `toast/root/ToastRoot.js:50`, which is wrong for a
 * toast docked anywhere else).
 */
export const ToastRoot = forwardRef<HTMLDivElement, ToastRootProps>(function ToastRoot(
  { placement = 'bottom-end', swipeDirection, className, ...rest },
  ref,
) {
  return (
    <BaseToast.Root
      {...rest}
      ref={ref}
      data-placement={placement}
      swipeDirection={swipeDirection ?? swipeDirectionsFor(placement)}
      className={merge(toastRootClass, className)}
    />
  )
})

export interface ToastTitleProps extends Omit<BaseToast.Title.Props, 'className'> {
  className?: string
}

/** Base UI's title, which renders the toast's own `title` unless given children. */
export const ToastTitle = forwardRef<HTMLHeadingElement, ToastTitleProps>(function ToastTitle(
  { className, ...rest },
  ref,
) {
  return <BaseToast.Title {...rest} ref={ref} className={merge(toastTitleClass, className)} />
})

export interface ToastDescriptionProps extends Omit<BaseToast.Description.Props, 'className'> {
  className?: string
}

/** Base UI's description, which renders the toast's own `description` unless given children. */
export const ToastDescription = forwardRef<HTMLParagraphElement, ToastDescriptionProps>(
  function ToastDescription({ className, ...rest }, ref) {
    return (
      <BaseToast.Description {...rest} ref={ref} className={merge(toastDescriptionClass, className)} />
    )
  },
)

export interface ToastActionProps extends Omit<BaseToast.Action.Props, 'className'> {
  className?: string
}

/**
 * Base UI's action button, which renders the toast's own `actionProps`. Derives
 * `nativeButton` from `render` (§4.1.1), as `PopoverTrigger` does. An explicit
 * value wins.
 */
export const ToastAction = forwardRef<HTMLButtonElement, ToastActionProps>(function ToastAction(
  { render, nativeButton, className, ...rest },
  ref,
) {
  return (
    <BaseToast.Action
      {...rest}
      ref={ref}
      {...(render !== undefined ? { render } : {})}
      nativeButton={nativeButton ?? deriveNativeButton(render)}
      className={merge(toastActionClass, className)}
    />
  )
})

export interface ToastCloseProps extends Omit<BaseToast.Close.Props, 'className'> {
  className?: string
}

/**
 * Base UI's close button with the close icon, which it owns. Derives
 * `nativeButton` from `render`, and takes its accessible name from the
 * `dismiss` message, before `rest` so a caller can still override it.
 */
export const ToastClose = forwardRef<HTMLButtonElement, ToastCloseProps>(function ToastClose(
  { render, nativeButton, className, ...rest },
  ref,
) {
  const messages = useMessages()
  return (
    <BaseToast.Close
      aria-label={messages.dismiss}
      {...rest}
      ref={ref}
      {...(render !== undefined ? { render } : {})}
      nativeButton={nativeButton ?? deriveNativeButton(render)}
      className={merge(toastCloseClass, className)}
    >
      <Icon name="close" />
    </BaseToast.Close>
  )
})
