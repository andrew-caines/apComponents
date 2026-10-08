'use client'

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { Toast as BaseToast } from '@base-ui/react/toast'
import { ToastList } from '../components/Toast/ToastList.js'
import { ToastViewport, type ToastPlacement } from '../components/Toast/ToastParts.js'
import { useIsomorphicLayoutEffect } from '../hooks/index.js'
import { subscribe } from './channel.js'
import { DialogHost, useDialogQueue } from './DialogHost.js'
import { LiveRegions, useAnnouncer, type Announcer } from './LiveRegions.js'
import { toBaseToast } from './severity.js'
import type { DialogRequest } from './types.js'

export interface NotificationProviderProps {
  /** Where toasts dock. Defaults to `bottom-end`. */
  placement?: ToastPlacement
  children: ReactNode
}

/** Private. True inside a NotificationProvider, so a nested one can step aside. */
const NotificationContext = createContext(false)

/**
 * Relays the module-level channel into Base UI's toast store. It subscribes in a
 * layout effect, which React runs before every passive effect, so a toast
 * raised from a page's own mount `useEffect` is not dropped (Base UI's own
 * provider subscribes in a passive effect that runs after its children's).
 */
function Relay({
  announce,
  enqueue,
}: {
  announce: Announcer['announce']
  enqueue: (request: DialogRequest) => void
}) {
  const { add, close, promise } = BaseToast.useToastManager()

  useIsomorphicLayoutEffect(
    () =>
      subscribe((event) => {
        switch (event.kind) {
          case 'toast':
            add(toBaseToast(event.options))
            break
          case 'toast-close':
            close(event.id)
            break
          case 'toast-promise':
            void promise(event.promise, event.options).catch(() => {})
            break
          case 'announce':
            announce(event.message, event.politeness)
            break
          case 'dialog':
            enqueue(event.request)
            break
          // Task 5 wires these in: the banner context.
          case 'banner':
          case 'banner-close':
            break
        }
      }),
    [add, close, promise, announce, enqueue],
  )

  return null
}

/**
 * Hosts the notification surfaces: the toast stack and the live regions that
 * `announce()` writes to. Mount one near the root (`ApProvider` does). A
 * provider nested inside another renders only its children, with a development
 * warning, because two subscribers would show every toast twice.
 */
export function NotificationProvider({ placement = 'bottom-end', children }: NotificationProviderProps) {
  const nested = useContext(NotificationContext)
  const warned = useRef(false)
  const { polite, assertive, announce } = useAnnouncer()
  const { head, enqueue, shift } = useDialogQueue()

  useEffect(() => {
    if (!nested || warned.current) return
    warned.current = true
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'A NotificationProvider is nested inside another one. The inner one renders only its children; ' +
          'the outer one handles every notification.',
      )
    }
  }, [nested])

  if (nested) return <>{children}</>

  return (
    <NotificationContext.Provider value>
      <BaseToast.Provider>
        <Relay announce={announce} enqueue={enqueue} />
        {children}
        <BaseToast.Portal>
          <ToastViewport placement={placement}>
            <ToastList placement={placement} />
          </ToastViewport>
        </BaseToast.Portal>
        <DialogHost request={head} onClosed={shift} />
        <LiveRegions polite={polite} assertive={assertive} />
      </BaseToast.Provider>
    </NotificationContext.Provider>
  )
}
