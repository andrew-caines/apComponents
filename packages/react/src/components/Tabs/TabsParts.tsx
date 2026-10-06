'use client'

import { createContext, forwardRef, useContext, useMemo } from 'react'
import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import type {
  TabsIndicatorProps as BaseIndicatorProps,
  TabsListProps as BaseListProps,
  TabsPanelProps as BasePanelProps,
  TabsRootOrientation,
  TabsRootProps as BaseRootProps,
  TabsTabProps as BaseTabProps,
} from '@base-ui/react/tabs'
import { deriveNativeButton } from '../../internal/deriveNativeButton.js'
import {
  tabRecipe,
  tabsIndicatorRecipe,
  tabsListRecipe,
  tabsPanelClass,
  tabsRootRecipe,
} from './Tabs.css.js'

export { TABS_TOKENS } from './Tabs.tokens.js'

/**
 * These wrappers add styling and nothing else. Roles, `aria-selected`,
 * `aria-orientation`, roving focus and manual activation are Base UI's:
 * `activateOnFocus` defaults to false and `loopFocus` to true
 * (`tabs/list/TabsList.js:26,28`).
 */

export type TabsVariant = 'underline' | 'pills'

interface TabsStyleContextValue {
  variant: TabsVariant
  orientation: TabsRootOrientation
}

/** Private: carries the root's `variant` and `orientation` to the parts' recipes. */
const TabsStyleContext = createContext<TabsStyleContextValue>({
  variant: 'underline',
  orientation: 'horizontal',
})

function merge(recipeClass: string, className: string | undefined): string {
  return [recipeClass, className].filter(Boolean).join(' ')
}

export interface TabsRootProps extends Omit<BaseRootProps, 'className'> {
  /** The visual treatment of the list and its indicator. Defaults to `underline`. */
  variant?: TabsVariant
  className?: string
}

/**
 * Base UI's root, plus `variant`. It passes `orientation` to Base UI, which
 * owns `aria-orientation` and the arrow-key axis (Base UI's list reads it from
 * the root, `tabs/list/TabsList.js:33-37`), and shares `variant` and
 * `orientation` with the parts below through a private context. In vertical
 * orientation it lays the list beside the panels.
 */
export const TabsRoot = forwardRef<HTMLDivElement, TabsRootProps>(function TabsRoot(
  { variant = 'underline', orientation = 'horizontal', className, ...rest },
  ref,
) {
  const style = useMemo(() => ({ variant, orientation }), [variant, orientation])
  return (
    <TabsStyleContext.Provider value={style}>
      <BaseTabs.Root
        {...rest}
        ref={ref}
        orientation={orientation}
        className={merge(tabsRootRecipe({ orientation }), className)}
      />
    </TabsStyleContext.Provider>
  )
})

export interface TabsListProps extends Omit<BaseListProps, 'className'> {
  className?: string
}

/**
 * Base UI's list with the recipe for the root's `variant` and `orientation`.
 * It passes no `orientation` of its own: Base UI's list has no such prop.
 * Place `TabsIndicator` first inside it, so the tabs paint above a pill.
 */
export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(function TabsList(
  { className, ...rest },
  ref,
) {
  const { variant, orientation } = useContext(TabsStyleContext)
  return (
    <BaseTabs.List
      {...rest}
      ref={ref}
      className={merge(tabsListRecipe({ variant, orientation }), className)}
    />
  )
})

export interface TabsTabProps extends Omit<BaseTabProps, 'className'> {
  className?: string
}

/**
 * Base UI's tab with the recipe, and `nativeButton` derived from `render`
 * (§4.1.1), as `PopoverTrigger` does. An explicit value wins.
 */
export const TabsTab = forwardRef<HTMLButtonElement, TabsTabProps>(function TabsTab(
  { render, nativeButton, className, ...rest },
  ref,
) {
  const { variant, orientation } = useContext(TabsStyleContext)
  return (
    <BaseTabs.Tab
      {...rest}
      ref={ref}
      {...(render !== undefined ? { render } : {})}
      nativeButton={nativeButton ?? deriveNativeButton(render)}
      className={merge(tabRecipe({ variant, orientation }), className)}
    />
  )
})

export interface TabsIndicatorProps
  extends Omit<BaseIndicatorProps, 'className' | 'renderBeforeHydration'> {
  className?: string
}

/**
 * Base UI's indicator with the recipe: an underline, or a pill behind the
 * selected tab. `renderBeforeHydration` is not offered: it injects an inline
 * `<script>` into server HTML (`tabs/indicator/TabsIndicator.js:134-135`),
 * and with it off (the default, `:36`) none is rendered. Put it first inside
 * `TabsList`.
 */
export const TabsIndicator = forwardRef<HTMLSpanElement, TabsIndicatorProps>(
  function TabsIndicator({ className, ...rest }, ref) {
    const { variant, orientation } = useContext(TabsStyleContext)
    return (
      <BaseTabs.Indicator
        {...rest}
        ref={ref}
        className={merge(tabsIndicatorRecipe({ variant, orientation }), className)}
      />
    )
  },
)

export interface TabsPanelProps extends Omit<BasePanelProps, 'className'> {
  className?: string
}

/**
 * Base UI's panel with a focus ring; the panel is focusable. An inactive
 * panel unmounts unless `keepMounted` is set (`tabs/panel/TabsPanel.js:36,100`).
 */
export const TabsPanel = forwardRef<HTMLDivElement, TabsPanelProps>(function TabsPanel(
  { className, ...rest },
  ref,
) {
  return <BaseTabs.Panel {...rest} ref={ref} className={merge(tabsPanelClass, className)} />
})
