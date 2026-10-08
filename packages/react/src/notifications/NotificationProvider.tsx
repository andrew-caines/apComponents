'use client'

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { Toast as BaseToast } from '@base-ui/react/toast'
import { ToastList } from '../components/Toast/ToastList.js'
import { ToastViewport, type ToastPlacement } from '../components/Toast/ToastParts.js'
import { useIsomorphicLayoutEffect } from '../hooks/index.js'
import { BannerContext, useBannerState, type BannerEntry } from './banners.js'
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
  showBanner,
  closeBanner,
  hasRegion,
}: {
  announce: Announcer['announce']
  enqueue: (request: DialogRequest) => void
  showBanner: (entry: BannerEntry) => void
  closeBanner: (id: string) => void
  hasRegion: () => boolean
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
          case 'banner': {
            // The region count is a ref set in a layout effect, so this is
            // right even for a banner raised by a page's mount effect.
            if (hasRegion()) {
              showBanner(event.options)
              break
            }
            if (process.env.NODE_ENV !== 'production') {
              console.warn(
                'banner() was called with no BannerRegion mounted, so it is shown as a toast. ' +
                  'Render <BannerRegion /> where banners belong.',
              )
            }
            const { title, description, severity, action, id } = event.options
            add(
              toBaseToast({
                title,
                id,
                ...(description !== undefined ? { description } : {}),
                ...(severity !== undefined ? { severity } : {}),
                ...(action !== undefined ? { action } : {}),
              }),
            )
            break
          }
          case 'banner-close':
            closeBanner(event.id)
            // A banner that fell back to a toast shares its id.
            close(event.id)
            break
        }
      }),
    [add, close, promise, announce, enqueue, showBanner, closeBanner, hasRegion],
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
  const banners = useBannerState()

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
        <Relay
          announce={announce}
          enqueue={enqueue}
          showBanner={banners.show}
          closeBanner={banners.close}
          hasRegion={banners.hasRegion}
        />
        <BannerContext.Provider value={banners.value}>{children}</BannerContext.Provider>
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
