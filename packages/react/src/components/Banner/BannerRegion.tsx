'use client'

import { useContext } from 'react'
import { BannerContext } from '../../notifications/banners.js'
import { SEVERITY_ICON } from '../../notifications/severity.js'
import { useIsomorphicLayoutEffect } from '../../hooks/useIsomorphicLayoutEffect.js'
import { Icon } from '../../icons/Icon.js'
import { useMessages } from '../../providers/LocaleProvider.js'
import { Button } from '../Button/Button.js'
import {
  bannerBodyClass,
  bannerCloseClass,
  bannerDescriptionClass,
  bannerIconRecipe,
  bannerRecipe,
  bannerRegionClass,
  bannerTitleClass,
} from './Banner.css.js'

export interface BannerRegionProps {
  className?: string
}

/**
 * A slot, in normal flow and NOT a portal, that shows the banners raised with
 * `banner()`. Place it where banners belong in the page. The wrapper is always
 * rendered (empty on the server); a banner appears on the client.
 *
 * Info, success and warning are `role="status"` (polite); error is
 * `role="alert"` (assertive). With no region mounted, `banner()` falls back to
 * a toast. The region registers in a layout effect, which runs before any
 * page's passive mount effect, so a `banner()` raised there still finds it.
 */
export function BannerRegion({ className }: BannerRegionProps) {
  const { banners, registerRegion, close } = useContext(BannerContext)
  const messages = useMessages()

  useIsomorphicLayoutEffect(() => registerRegion(), [registerRegion])

  return (
    <div className={className === undefined ? bannerRegionClass : `${bannerRegionClass} ${className}`}>
      {banners.map((entry) => {
        const severity = entry.severity ?? 'info'
        return (
          <div
            key={entry.id}
            role={severity === 'error' ? 'alert' : 'status'}
            className={bannerRecipe({ severity })}
          >
            <span className={bannerIconRecipe({ severity })}>
              <Icon name={SEVERITY_ICON[severity]} />
            </span>
            <div className={bannerBodyClass}>
              <span className={bannerTitleClass}>{entry.title}</span>
              {entry.description !== undefined && (
                <span className={bannerDescriptionClass}>{entry.description}</span>
              )}
            </div>
            {entry.action && (
              <Button variant="outline" size="sm" onClick={entry.action.onClick}>
                {entry.action.label}
              </Button>
            )}
            {entry.dismissible !== false && (
              <button
                type="button"
                className={bannerCloseClass}
                aria-label={messages.dismiss}
                onClick={() => close(entry.id)}
              >
                <Icon name="close" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
