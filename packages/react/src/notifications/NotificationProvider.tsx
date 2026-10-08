'use client'

import { useContext, useEffect, useRef, type ReactNode } from 'react'
import { Toast as BaseToast } from '@base-ui/react/toast'
import { ToastList } from '../components/Toast/ToastList.js'
import { ToastViewport, type ToastPlacement } from '../components/Toast/ToastParts.js'
import { useIsomorphicLayoutEffect } from '../hooks/index.js'
import { BannerContext, useBannerState, type BannerEntry } from './banners.js'
import { subscribe } from './channel.js'
import { NotificationContext } from './context.js'
import { DialogHost, useDialogQueue } from './DialogHost.js'
import { LiveRegions, useAnnouncer, type Announcer } from './LiveRegions.js'
import { toBaseToast } from './severity.js'
import type { DialogRequest } from './types.js'

export interface NotificationProviderProps {
  /** Where toasts dock. Defaults to `bottom-end`. */
  placement?: ToastPlacement
  children: ReactNode
}

/**
 * Base UI's ToastAction runs `actionProps.onClick` and never closes the toast
 * (toast/action/ToastAction.js:46-48). Ours closes it after the caller's handler.
 */
function closingOnAction(
  base: ReturnType<typeof toBaseToast>,
  id: string,
  close: (id: string) => void,
): ReturnType<typeof toBaseToast> {
  const { actionProps } = base
  if (!actionProps) return base
  return {
    ...base,
    actionProps: {
      ...actionProps,
      onClick: (event) => {
        actionProps.onClick?.(event)
        close(id)
      },
    },
  }
}

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
            add(closingOnAction(toBaseToast(event.options), event.options.id, close))
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
            // A banner never auto-dismisses (spec 4.6.1), so its fallback toast
            // is persistent too. The action closes it, like any toast action.
            add(
              closingOnAction(
                {
                  ...toBaseToast({
                    title,
                    id,
                    ...(description !== undefined ? { description } : {}),
                    ...(severity !== undefined ? { severity } : {}),
                    ...(action !== undefined ? { action } : {}),
                  }),
                  timeout: 0,
                },
                id,
                close,
              ),
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
