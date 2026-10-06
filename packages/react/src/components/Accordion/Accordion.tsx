'use client'

import type { ReactNode } from 'react'
import {
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  AccordionRoot,
  AccordionTrigger,
  type AccordionHeaderProps,
  type AccordionItemProps,
  type AccordionPanelProps,
  type AccordionRootProps,
  type AccordionTriggerProps,
} from './AccordionParts.js'

export { ACCORDION_TOKENS } from './AccordionParts.js'
export type {
  AccordionHeaderProps,
  AccordionItemProps,
  AccordionPanelProps,
  AccordionRootProps,
  AccordionTriggerProps,
}

/** The data for one section. Named apart from the `AccordionItem` part. */
export interface AccordionSection<Value extends string = string> {
  value: Value
  /** Keep this to text: it is the trigger's accessible name. */
  title: ReactNode
  content: ReactNode
  disabled?: boolean
}

type ChangeDetails = Parameters<NonNullable<AccordionRootProps['onValueChange']>>[1]

export type AccordionProps<Value extends string = string> = Omit<
  AccordionRootProps,
  'children' | 'hiddenUntilFound' | 'keepMounted' | 'value' | 'defaultValue' | 'onValueChange'
> & {
  items: ReadonlyArray<AccordionSection<Value>>
  /** Values of the open sections. */
  value?: Value[]
  defaultValue?: Value[]
  /** Called with the values of the open sections. */
  onValueChange?: (value: Value[], eventDetails: ChangeDetails) => void
  /**
   * The level of each section heading, default 3. It must fit the page's
   * heading outline: screen-reader users navigate by heading level, so
   * sections under an `<h2>` should be `3`, and a skipped or repeated level
   * misreports the page structure.
   */
  headingLevel?: 2 | 3 | 4 | 5 | 6
}

const HEADINGS = { 2: <h2 />, 3: <h3 />, 4: <h4 />, 5: <h5 />, 6: <h6 /> } as const

function AccordionBase<Value extends string = string>({
  items,
  headingLevel = 3,
  value,
  defaultValue,
  onValueChange,
  ...root
}: AccordionProps<Value>) {
  const heading = HEADINGS[headingLevel]
  // A disabled root disables every item (`accordion/item/AccordionItem.js:50`).
  const rootDisabled = root.disabled === true
  return (
    <AccordionRoot
      {...root}
      {...(value !== undefined ? { value } : {})}
      {...(defaultValue !== undefined ? { defaultValue } : {})}
      {...(onValueChange !== undefined
        ? {
            // Honest narrowing: Base UI's value is an array of item values
            // (`accordion/root/AccordionRoot.d.ts`: `AccordionValue = Value[]`)
            // and every item here carries a `Value`, so nothing else occurs.
            // Unlike Tabs there is no null fallback.
            onValueChange: (next: unknown[], details: ChangeDetails) =>
              onValueChange(next as Value[], details),
          }
        : {})}
      hiddenUntilFound
    >
      {items.map((item) => (
        <AccordionItem
          key={item.value}
          value={item.value}
          {...(item.disabled !== undefined ? { disabled: item.disabled } : {})}
        >
          <AccordionHeader render={heading}>
            <AccordionTrigger>{item.title}</AccordionTrigger>
          </AccordionHeader>
          {/* A disabled item (or root) opts out of hidden-until-found. Base UI's
              beforematch listener opens the panel without checking disabled
              (`collapsible/panel/useCollapsiblePanel.js:286-293`), so find-in-page
              would open a section its trigger refuses to. The panel's own prop
              outranks the root's (`accordion/panel/AccordionPanel.js:50`), and
              with it off a closed panel unmounts (`useCollapsiblePanel.js:297`;
              `keepMounted` defaults off, `accordion/root/AccordionRoot.js:103`). */}
          <AccordionPanel
            {...(item.disabled === true || rootDisabled ? { hiddenUntilFound: false } : {})}
          >
            {item.content}
          </AccordionPanel>
        </AccordionItem>
      ))}
    </AccordionRoot>
  )
}

/**
 * `Accordion` is both the convenience component and the namespace holding its
 * parts.
 *
 * Closed content stays in the page (hidden-until-found), so the browser's
 * find-in-page can open a matching section. That works only after hydration:
 * server HTML carries plain `hidden`, and `until-found` is set on the client.
 * A disabled item is the exception: its closed content is not rendered, so
 * find-in-page cannot open it.
 * Keep each `title` to text: it is the trigger's accessible name.
 */
export const Accordion = Object.assign(AccordionBase, {
  Root: AccordionRoot,
  Item: AccordionItem,
  Header: AccordionHeader,
  Trigger: AccordionTrigger,
  Panel: AccordionPanel,
})
