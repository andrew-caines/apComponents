'use client'

import { forwardRef, type Ref } from 'react'
import { Accordion as BaseAccordion } from '@base-ui/react/accordion'
import type {
  AccordionHeaderProps as BaseHeaderProps,
  AccordionItemProps as BaseItemProps,
  AccordionPanelProps as BasePanelProps,
  AccordionRootProps as BaseRootProps,
  AccordionTriggerProps as BaseTriggerProps,
} from '@base-ui/react/accordion'
import { Icon } from '../../icons/Icon.js'
import { deriveNativeButton } from '../../internal/deriveNativeButton.js'
import {
  accordionChevronClass,
  accordionHeaderClass,
  accordionItemClass,
  accordionPanelClass,
  accordionPanelContentClass,
  accordionTriggerClass,
} from './Accordion.css.js'

export { ACCORDION_TOKENS } from './Accordion.tokens.js'

/**
 * These wrappers add styling and nothing else. `aria-expanded`,
 * `aria-controls`, the panel's `region` role and its label are Base UI's
 * (`accordion/trigger/AccordionTrigger.js:62-63`,
 * `accordion/panel/AccordionPanel.js:106-107`), as are single-open by default
 * (`multiple = false`, `accordion/root/AccordionRoot.js:36`) and keyboard
 * navigation between triggers.
 */

function merge(recipeClass: string, className: string | undefined): string {
  return [recipeClass, className].filter(Boolean).join(' ')
}

// `any` matches Base UI's own default for the value type parameter.
export type AccordionRootProps<Value = any> = BaseRootProps<Value>

/** Base UI's root, unchanged. It has no styling of its own. */
export const AccordionRoot = BaseAccordion.Root

export interface AccordionItemProps extends Omit<BaseItemProps, 'className'> {
  className?: string
}

/** Base UI's item, with a hairline between it and the next item. */
export const AccordionItem = forwardRef<HTMLDivElement, AccordionItemProps>(function AccordionItem(
  { className, ...rest },
  ref,
) {
  return (
    <BaseAccordion.Item {...rest} ref={ref} className={merge(accordionItemClass, className)} />
  )
})

export interface AccordionHeaderProps extends Omit<BaseHeaderProps, 'className'> {
  className?: string
}

/**
 * Base UI's header, an `<h3>` (`accordion/header/AccordionHeader.js:29`),
 * with its margin reset. `render` passes through untouched: it is how the
 * heading level changes (`render={<h2 />}`).
 */
export const AccordionHeader = forwardRef<HTMLHeadingElement, AccordionHeaderProps>(
  function AccordionHeader({ className, ...rest }, ref) {
    return (
      <BaseAccordion.Header
        {...rest}
        ref={ref}
        className={merge(accordionHeaderClass, className)}
      />
    )
  },
)

export interface AccordionTriggerProps extends Omit<BaseTriggerProps, 'className'> {
  className?: string
}

/**
 * Base UI's trigger with the recipe, and `nativeButton` derived from `render`
 * (§4.1.1), as `TabsTab` does. An explicit value wins.
 *
 * The chevron is the trigger's own: it is rendered after the children, inside
 * whatever element `render` supplies, as `SelectItem` owns its check
 * indicator. So no `render` can remove it. It is decorative (`Icon` sets
 * `aria-hidden` without a `label`); `aria-expanded` already says open or
 * closed.
 */
export const AccordionTrigger = forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  function AccordionTrigger({ render, nativeButton, className, children, ...rest }, ref) {
    return (
      <BaseAccordion.Trigger
        {...rest}
        // Base UI types this ref as `Ref<HTMLElement>`; the cast lives here so
        // consumers get the accurate type, as in SelectParts.tsx.
        ref={ref as Ref<HTMLElement>}
        {...(render !== undefined ? { render } : {})}
        nativeButton={nativeButton ?? deriveNativeButton(render)}
        className={merge(accordionTriggerClass, className)}
      >
        {children}
        <Icon name="chevron-down" className={accordionChevronClass} />
      </BaseAccordion.Trigger>
    )
  },
)

export interface AccordionPanelProps extends Omit<BasePanelProps, 'className'> {
  className?: string
}

/**
 * Base UI's panel with the recipe: `--panel-height` aliased to Base UI's
 * measured height, `expand` and `collapse` from `@ap/motion`, and a padded
 * content box it owns (see `Accordion.css.ts` for why the padding is not on
 * the panel). A closed panel unmounts unless `keepMounted` or
 * `hiddenUntilFound` is set (`accordion/root/AccordionRoot.js:102-103`).
 */
export const AccordionPanel = forwardRef<HTMLDivElement, AccordionPanelProps>(
  function AccordionPanel({ className, children, ...rest }, ref) {
    return (
      <BaseAccordion.Panel {...rest} ref={ref} className={merge(accordionPanelClass, className)}>
        <div className={accordionPanelContentClass}>{children}</div>
      </BaseAccordion.Panel>
    )
  },
)
