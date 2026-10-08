'use client'

import { useCallback, useRef, useState } from 'react'
import { Toast as BaseToast } from '@base-ui/react/toast'
import { Icon } from '../../icons/Icon.js'
import type { IconName } from '../../icons/paths.js'
import type { NotificationSeverity } from '../../notifications/types.js'
import { Spinner } from '../Spinner/Spinner.js'
import { toastIconRecipe } from './Toast.css.js'
import {
  swipeDirectionsFor,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastRoot,
  ToastTitle,
  type ToastPlacement,
} from './ToastParts.js'

const SEVERITY_ICON: Record<NotificationSeverity, IconName> = {
  info: 'info',
  success: 'check-circle',
  warning: 'alert-triangle',
  error: 'alert-circle',
}

function isSeverity(type: string | undefined): type is NotificationSeverity {
  return type !== undefined && Object.prototype.hasOwnProperty.call(SEVERITY_ICON, type)
}

/**
 * Internal, not exported from the package. Renders every queued toast inside
 * the Base UI provider as a Root with its severity icon, title, optional
 * description and action, and a close button.
 *
 * The severity icon is OWNED here, as `AccordionTrigger` owns its chevron. It
 * is decorative (`Icon` and `Spinner` both hide an unlabelled glyph), because
 * the title carries the meaning. A `type: 'loading'` toast shows a spinner.
 *
 * Swipe directions depend on the page direction, which only the DOM knows. The
 * first Root to mount reads it once from its parent, the viewport, with the
 * bare `getComputedStyle` global. Until then it is left-to-right, which is also
 * what server and first client render agree on.
 */
export function ToastList({ placement }: { placement: ToastPlacement }) {
  const { toasts } = BaseToast.useToastManager()
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr')
  const read = useRef(false)

  const readDirection = useCallback((node: HTMLDivElement | null) => {
    if (node === null || read.current) return
    read.current = true
    const host = node.parentElement ?? node
    if (getComputedStyle(host).direction === 'rtl') setDirection('rtl')
  }, [])

  return (
    <>
      {toasts.map((toast) => {
        const kind = toast.type
        return (
          <ToastRoot
            key={toast.id}
            toast={toast}
            ref={readDirection}
            placement={placement}
            swipeDirection={swipeDirectionsFor(placement, direction)}
          >
            <span
              className={toastIconRecipe({
                severity: kind === 'loading' ? 'loading' : isSeverity(kind) ? kind : 'info',
              })}
            >
              {kind === 'loading' ? (
                <Spinner />
              ) : (
                <Icon name={SEVERITY_ICON[isSeverity(kind) ? kind : 'info']} />
              )}
            </span>
            <ToastTitle />
            {toast.description ? <ToastDescription /> : null}
            {toast.actionProps ? <ToastAction /> : null}
            <ToastClose />
          </ToastRoot>
        )
      })}
    </>
  )
}
