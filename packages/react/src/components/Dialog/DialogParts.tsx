'use client'

import { forwardRef, type Ref } from 'react'
import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import type {
  DialogBackdropProps as BaseBackdropProps,
  DialogCloseProps as BaseCloseProps,
  DialogDescriptionProps as BaseDescriptionProps,
  DialogPopupProps as BasePopupProps,
  DialogPortalProps as BasePortalProps,
  DialogRootProps as BaseRootProps,
  DialogTitleProps as BaseTitleProps,
  DialogTriggerProps as BaseTriggerProps,
  DialogViewportProps as BaseViewportProps,
} from '@base-ui/react/dialog'
import { Icon } from '../../icons/Icon.js'
import { useMessages } from '../../providers/LocaleProvider.js'
import {
  backdropClass,
  bodyClass,
  closeClass,
  descriptionClass,
  footerClass,
  headerClass,
  headingsClass,
  popupRecipe,
  titleClass,
  viewportClass,
} from './Dialog.css.js'

export { DIALOG_TOKENS } from './Dialog.tokens.js'

/**
 * These wrappers add styling and nothing else.
 *
 * In particular none of them touches modality, focus, scroll locking or
 * stacking. Base UI owns all four, and each is a place where a second,
 * well-meaning implementation is strictly worse than none:
 *
 * - **Focus** is trapped and returned by `DialogRoot`. A trap of our own would
 *   compete with it over which element is actually focused. (Spelled without
 *   the property access on purpose: `ssr-safety.gate.test.ts` scans raw text,
 *   comments included, and cannot tell a mention from a call.)
 * - **Nesting** is already tracked (`data-nested`, `data-nested-dialog-open`,
 *   `nestedOpenDialogCount`). A counter of ours would shadow theirs and drift.
 * - **Scroll locking** is ref-counted internally, which is exactly what two
 *   overlapping surfaces need — each restoring on close independently is the
 *   classic way body scroll ends up permanently disabled.
 * - **Stacking** is handled by the `Z` scale plus DOM order: dialogs portal in
 *   open order, so the newest is on top with nothing to compute. Note that
 *   Base UI does NOT use the native top layer — this is a portalled `<div>` —
 *   so the portal target genuinely matters, see `DialogPortal` below.
 */

export type DialogRootProps = BaseRootProps
export const DialogRoot = BaseDialog.Root

export type DialogTriggerProps = BaseTriggerProps

/**
 * Renders whatever it is given via `render`, so the trigger is the consumer's
 * own `Button` rather than a second button style to keep in sync.
 */
export const DialogTrigger = BaseDialog.Trigger

export type DialogPortalProps = BasePortalProps

/**
 * Defaults to appending to `<body>`, and that default is load-bearing rather
 * than a convenience. Base UI's dialog is a portalled `<div>`, not a native
 * `<dialog>` in the top layer, so its `z-index` is only comparable to other
 * elements in the same stacking context. Rendered inside an ancestor with
 * `transform`, `filter`, `contain` or `will-change`, the popup is trapped in
 * that context and NO z-index can lift it above the page. Portalling to `body`
 * is what escapes it.
 *
 * `keepMounted` is deliberately not defaulted on. Base UI holds the popup
 * mounted for as long as its exit animation is running, so exit motion works
 * without it — and with it the popup would render server-side, which ADR-0005
 * forbids and `test:ssr` asserts against.
 */
export const DialogPortal = BaseDialog.Portal

export type DialogBackdropProps = BaseBackdropProps

export const DialogBackdrop = forwardRef(function DialogBackdrop(
  { className, ...rest }: DialogBackdropProps,
  ref: Ref<HTMLDivElement>,
) {
  return (
    <BaseDialog.Backdrop
      {...rest}
      ref={ref}
      className={[backdropClass, className].filter(Boolean).join(' ')}
    />
  )
})

export type DialogViewportProps = BaseViewportProps

export const DialogViewport = forwardRef(function DialogViewport(
  { className, ...rest }: DialogViewportProps,
  ref: Ref<HTMLDivElement>,
) {
  return (
    <BaseDialog.Viewport
      {...rest}
      ref={ref}
      className={[viewportClass, className].filter(Boolean).join(' ')}
    />
  )
})

/** Width cap. See `Dialog.css.ts` for why `fit` is bounded at both ends. */
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'fit'

/** Presentation. `auto` becomes a bottom sheet below `sm` (ADR-0017). */
export type DialogLayout = 'auto' | 'dialog'

export interface DialogPopupProps extends BasePopupProps {
  size?: DialogSize
  layout?: DialogLayout
}

export const DialogPopup = forwardRef(function DialogPopup(
  { size = 'md', layout = 'auto', className, ...rest }: DialogPopupProps,
  ref: Ref<HTMLDivElement>,
) {
  return (
    <BaseDialog.Popup
      {...rest}
      ref={ref}
      className={[popupRecipe({ size, layout }), className].filter(Boolean).join(' ')}
    />
  )
})

export type DialogTitleProps = BaseTitleProps

export const DialogTitle = forwardRef(function DialogTitle(
  { className, ...rest }: DialogTitleProps,
  ref: Ref<HTMLHeadingElement>,
) {
  return (
    <BaseDialog.Title
      {...rest}
      ref={ref}
      className={[titleClass, className].filter(Boolean).join(' ')}
    />
  )
})

export type DialogDescriptionProps = BaseDescriptionProps

export const DialogDescription = forwardRef(function DialogDescription(
  { className, ...rest }: DialogDescriptionProps,
  ref: Ref<HTMLParagraphElement>,
) {
  return (
    <BaseDialog.Description
      {...rest}
      ref={ref}
      className={[descriptionClass, className].filter(Boolean).join(' ')}
    />
  )
})

export type DialogCloseProps = BaseCloseProps

export const DialogClose = BaseDialog.Close

/**
 * The header's dismiss control.
 *
 * Its accessible name comes from the message registry, never a literal: a
 * hardcoded "Close" ships English ARIA to every locale, which is the failure
 * ADR-0012 names and `no-hardcoded-strings.gate.test.ts` enforces. A caller can
 * still override it per-instance with `aria-label`.
 */
export const DialogDismiss = forwardRef(function DialogDismiss(
  { className, ...rest }: DialogCloseProps,
  ref: Ref<HTMLButtonElement>,
) {
  const messages = useMessages()
  return (
    <BaseDialog.Close
      aria-label={messages.close}
      {...rest}
      ref={ref}
      className={[closeClass, className].filter(Boolean).join(' ')}
    >
      <Icon name="close" />
    </BaseDialog.Close>
  )
})

/** Layout slots. Plain elements — they carry no behaviour, only the grid. */
export function DialogHeader({
  className,
  ...rest
}: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...rest} className={[headerClass, className].filter(Boolean).join(' ')} />
}

export function DialogHeadings({
  className,
  ...rest
}: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...rest} className={[headingsClass, className].filter(Boolean).join(' ')} />
}

export function DialogBody({ className, ...rest }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...rest} className={[bodyClass, className].filter(Boolean).join(' ')} />
}

export function DialogFooter({ className, ...rest }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...rest} className={[footerClass, className].filter(Boolean).join(' ')} />
}
