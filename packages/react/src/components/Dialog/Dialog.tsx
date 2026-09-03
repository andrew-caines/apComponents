'use client'

import type { ReactNode } from 'react'
import {
  DialogBackdrop,
  DialogClose,
  DialogBody,
  DialogDescription,
  DialogDismiss,
  DialogFooter,
  DialogHeader,
  DialogHeadings,
  DialogPopup,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  DialogViewport,
  type DialogLayout,
  type DialogRootProps,
  type DialogSize,
} from './DialogParts.js'

export { DIALOG_TOKENS } from './Dialog.tokens.js'

export interface DialogProps extends Omit<DialogRootProps, 'children'> {
  /**
   * The dialog's accessible name. Required, for the same reason `Field`'s
   * `label` is: a dialog announced only as "dialog" gives a screen-reader user
   * no way to know what just took over their focus.
   */
  title: string
  /** Supporting copy under the title, wired as the dialog's description. */
  description?: string
  /**
   * What opens it — normally a `Button`. Rendered THROUGH `Dialog.Trigger`
   * rather than wrapped by it, so the trigger stays one button: a `<button>`
   * inside a `<button>` is invalid markup and unreachable by keyboard.
   */
  trigger?: ReactNode
  /** Actions. Normally one or two `Button`s; laid out inline-end. */
  footer?: ReactNode
  /** Width cap. `md` by default — see `size` in the docs for why not `fit`. */
  size?: DialogSize
  /** `auto` presents as a bottom sheet below `sm` (ADR-0017). */
  layout?: DialogLayout
  /**
   * Whether to render the header's dismiss control. Defaults to `true`.
   *
   * Setting it `false` removes the BUTTON, not the ability to leave: Escape and
   * an outside click still close the dialog, because a surface that traps focus
   * with no advertised way out is a trap in the literal sense. To make a
   * decision genuinely mandatory, control `open` yourself and use Base UI's
   * dismissal props — this prop is about chrome, not about modality.
   */
  dismissible?: boolean
  /** The body. */
  children: ReactNode
}

/**
 * A modal dialog.
 *
 * Composed from the same parts the compound API exposes; reach for those when
 * the order or the markup between them has to change (a form element wrapping
 * body and footer, most often, so the footer's submit button posts the body's
 * fields).
 */
export function Dialog({
  title,
  description,
  trigger,
  footer,
  size = 'md',
  layout = 'auto',
  dismissible = true,
  children,
  ...root
}: DialogProps) {
  return (
    <DialogRoot {...root}>
      {trigger !== undefined && <DialogTrigger render={trigger as never} />}
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPopup size={size} layout={layout}>
            <DialogHeader>
              <DialogHeadings>
                <DialogTitle>{title}</DialogTitle>
                {description !== undefined && <DialogDescription>{description}</DialogDescription>}
              </DialogHeadings>
              {dismissible && <DialogDismiss />}
            </DialogHeader>
            <DialogBody>{children}</DialogBody>
            {footer !== undefined && <DialogFooter>{footer}</DialogFooter>}
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </DialogRoot>
  )
}

Dialog.Root = DialogRoot
Dialog.Trigger = DialogTrigger
Dialog.Portal = DialogPortal
Dialog.Backdrop = DialogBackdrop
Dialog.Viewport = DialogViewport
Dialog.Popup = DialogPopup
Dialog.Title = DialogTitle
Dialog.Description = DialogDescription
Dialog.Header = DialogHeader
Dialog.Headings = DialogHeadings
Dialog.Body = DialogBody
Dialog.Footer = DialogFooter
Dialog.Close = DialogClose
Dialog.Dismiss = DialogDismiss
