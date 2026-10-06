'use client'

import type { ReactNode } from 'react'
import {
  TabsIndicator,
  TabsList,
  TabsPanel,
  TabsRoot,
  TabsTab,
  type TabsIndicatorProps,
  type TabsListProps,
  type TabsPanelProps,
  type TabsRootProps,
  type TabsTabProps,
} from './TabsParts.js'

export { TABS_TOKENS } from './TabsParts.js'
export type {
  TabsIndicatorProps,
  TabsListProps,
  TabsPanelProps,
  TabsRootProps,
  TabsTabProps,
}

export interface TabsItem<Value extends string = string> {
  value: Value
  /** Keep this to text: it is the tab's accessible name as well as its visible label. */
  label: ReactNode
  content: ReactNode
  disabled?: boolean
}

/**
 * A tab list must have a name: an `aria-label` or an `aria-labelledby`, never
 * both and never neither. Without one a screen reader announces only "tab
 * list", with no hint what the tabs switch between.
 */
export type TabsName =
  | { 'aria-label': string; 'aria-labelledby'?: never }
  | { 'aria-labelledby': string; 'aria-label'?: never }

type ChangeDetails = Parameters<NonNullable<TabsRootProps['onValueChange']>>[1]

export type TabsProps<Value extends string = string> = Omit<
  TabsRootProps,
  'children' | 'value' | 'defaultValue' | 'onValueChange'
> &
  TabsName & {
    items: ReadonlyArray<TabsItem<Value>>
    value?: Value
    defaultValue?: Value
    onValueChange?: (value: Value, eventDetails: ChangeDetails) => void
    /** Defaults to `underline`. */
    variant?: 'underline' | 'pills'
    /** Defaults to `horizontal`. */
    orientation?: 'horizontal' | 'vertical'
    /** Keep inactive panels mounted (hidden) instead of unmounting them. */
    keepMounted?: boolean
  }

function TabsBase<Value extends string = string>({
  items,
  value,
  defaultValue,
  onValueChange,
  keepMounted,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...root
}: TabsProps<Value>) {
  // Base UI's own fallback picks the first tab only on the client, so the
  // server HTML would carry no panel. Choose the first enabled item here.
  const initial =
    value === undefined && defaultValue === undefined
      ? items.find((item) => item.disabled !== true)?.value
      : defaultValue
  return (
    <TabsRoot
      {...root}
      {...(value !== undefined ? { value } : {})}
      {...(initial !== undefined ? { defaultValue: initial } : {})}
      {...(onValueChange !== undefined
        ? { onValueChange: (next: unknown, details: ChangeDetails) => onValueChange(next as Value, details) }
        : {})}
    >
      <TabsList
        {...(ariaLabel !== undefined ? { 'aria-label': ariaLabel } : {})}
        {...(ariaLabelledBy !== undefined ? { 'aria-labelledby': ariaLabelledBy } : {})}
      >
        <TabsIndicator />
        {items.map((item) => (
          <TabsTab
            key={item.value}
            value={item.value}
            {...(item.disabled !== undefined ? { disabled: item.disabled } : {})}
          >
            {item.label}
          </TabsTab>
        ))}
      </TabsList>
      {items.map((item) => (
        <TabsPanel
          key={item.value}
          value={item.value}
          {...(keepMounted !== undefined ? { keepMounted } : {})}
        >
          {item.content}
        </TabsPanel>
      ))}
    </TabsRoot>
  )
}

/**
 * `Tabs` is both the convenience component and the namespace holding its
 * parts, as `Popover` is.
 *
 * Activation is manual: arrow keys move focus between tabs and Enter or Space
 * selects one (Base UI's `activateOnFocus` is off). The `aria-label` or
 * `aria-labelledby` names the tab list, so a screen reader says what the tabs
 * choose between. Inactive panels unmount, so form state typed into one is
 * lost when you switch away; set `keepMounted` to keep them in the DOM, hidden.
 * Keep each `label` to text: it is the tab's accessible name.
 */
export const Tabs = Object.assign(TabsBase, {
  Root: TabsRoot,
  List: TabsList,
  Tab: TabsTab,
  Panel: TabsPanel,
  Indicator: TabsIndicator,
})
