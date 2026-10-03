'use client'

import {
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useId,
  type ReactElement,
  type Ref,
  type RefCallback,
} from 'react'
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import type {
  TooltipPopupProps as BasePopupProps,
  TooltipPositionerProps,
  TooltipProviderProps as BaseProviderProps,
  TooltipRootProps as BaseRootProps,
  TooltipTriggerProps as BaseTriggerProps,
} from '@base-ui/react/tooltip'
import { mergeProps } from '@base-ui/react/merge-props'
import { POSITIONER_SIDE_OFFSET } from '../../internal/positioner.js'
import { tooltipPopupClass, tooltipPositionerClass } from './Tooltip.css.js'

export { TOOLTIP_TOKENS } from './Tooltip.tokens.js'

/**
 * Base UI's tooltip emits no ARIA of its own (only `aria-hidden` on its arrow,
 * `tooltip/arrow/TooltipArrow.js:49`) and generates no popup id. These parts
 * add the three things that make it a tooltip to assistive technology:
 * `role="tooltip"` on the popup, a Root-scoped id on it, and that id in the
 * trigger's `aria-describedby` while, and only while, the popup is open.
 */
const TooltipIdContext = createContext<string | undefined>(undefined)

function merge(recipeClass: string, className: string | undefined): string {
  return [recipeClass, className].filter(Boolean).join(' ')
}

function assignRef<T>(ref: Ref<T> | undefined, node: T | null): void {
  if (typeof ref === 'function') ref(node)
  else if (ref) ref.current = node
}

/**
 * One stable callback ref feeding both refs, as Base UI's `useMergedRefs`
 * does for its own element path. Stable across renders while the inputs are,
 * so React does not detach and reattach the node on every render.
 */
function useMergedRef<T>(a: Ref<T> | undefined, b: Ref<T> | undefined): RefCallback<T> {
  return useCallback(
    (node: T | null) => {
      assignRef(a, node)
      assignRef(b, node)
    },
    [a, b],
  )
}

export type TooltipProviderProps = BaseProviderProps

/**
 * Base UI's provider, unchanged: it groups open and close delays across the
 * tooltips inside it. Adds nothing.
 */
export const TooltipProvider = BaseTooltip.Provider

export type TooltipRootProps<Payload = unknown> = BaseRootProps<Payload>

/**
 * Base UI's root inside a context carrying a `useId()` for this tooltip's
 * popup. One id per Root, so two tooltips open at once never share one. Renders
 * no element of its own.
 */
export function TooltipRoot<Payload = unknown>(props: TooltipRootProps<Payload>) {
  const id = useId()
  return (
    <TooltipIdContext.Provider value={id}>
      <BaseTooltip.Root {...props} />
    </TooltipIdContext.Provider>
  )
}

export interface TooltipTriggerProps extends Omit<BaseTriggerProps, 'className'> {
  className?: string
}

/**
 * Base UI's trigger, plus `aria-describedby` pointing at the popup while this
 * trigger's tooltip is open (Base UI's trigger state `open`, which is per
 * trigger). The id is appended to any description the trigger already has,
 * and removed again on close, so a consumer's own `aria-describedby` survives.
 *
 * The default element is `<button type="button">`, so a trigger inside a form
 * never submits it.
 *
 * `render` takes an element or a function, as Base UI's does. An element is
 * merged with the trigger's props exactly as Base UI merges one, its own `ref`
 * and handlers included. **A function `render` must spread the `props` it is
 * given onto its element**: they carry the description, the id, the refs and
 * the event handlers that open the tooltip, and a function that drops them
 * loses all of it.
 */
export const TooltipTrigger = forwardRef<HTMLElement, TooltipTriggerProps>(function TooltipTrigger(
  { render, className, ...rest },
  forwardedRef,
) {
  const id = useContext(TooltipIdContext)
  // Base UI merges an element `render`'s own ref into the trigger's ref
  // (`internals/useRenderElement.js`, `useMergedRefs(outProps.ref,
  // getReactElementRef(renderProp), ref)`). It only ever sees our render
  // function, whose element ref is null, so the element's ref joins the
  // forwarded one here instead and reaches the clone through `props.ref`.
  const elementRef = isValidElement(render)
    ? (render.props as { ref?: Ref<HTMLElement> }).ref
    : undefined
  const ref = useMergedRef(forwardedRef, elementRef)
  return (
    <BaseTooltip.Trigger
      {...rest}
      ref={ref}
      {...(className !== undefined ? { className } : {})}
      render={(props, state) => {
        const describe = (existing?: string) =>
          state.open ? [existing, id].filter(Boolean).join(' ') : existing
        if (typeof render === 'function') {
          return render({ ...props, 'aria-describedby': describe(props['aria-describedby']) }, state)
        }
        // Base UI's element path (`internals/useRenderElement.js:113-114`):
        // merge the element's props over ours, then pin the ref to ours.
        const element = (render ?? <button type="button" />) as ReactElement<
          Record<string, unknown>
        >
        const merged = mergeProps<'button'>(props, element.props)
        return cloneElement(element, {
          ...merged,
          ref: props.ref,
          'aria-describedby': describe(merged['aria-describedby']),
        })
      }}
    />
  )
})

/** The placement a consumer may change, plus the positioner's `ref`. Everything else is fixed. */
export type TooltipPositionerOptions = Pick<
  TooltipPositionerProps,
  'side' | 'align' | 'sideOffset' | 'alignOffset' | 'collisionPadding'
> & {
  ref?: Ref<HTMLDivElement>
}

export interface TooltipPopupProps extends Omit<BasePopupProps, 'className' | 'id' | 'role'> {
  /** Overrides for the positioner's placement. `className` and `ref` address the popup. */
  positioner?: TooltipPositionerOptions
  className?: string
}

/**
 * Composes `Tooltip.Portal > Tooltip.Positioner > Tooltip.Popup`, so a
 * consumer never assembles the portal and positioner by hand. Adds:
 *
 * - **`side="top"`** and the token-derived `sideOffset` (§4.1.7), passed
 *   explicitly though they match Base UI's side default, so neither is ever
 *   inherited by accident.
 * - **`role="tooltip"`** and the Root's **id**. Both are set after the
 *   consumer's props and neither is a prop at all: the trigger's
 *   `aria-describedby` points at the id, an override would break that link,
 *   and any other role would stop the popup being a tooltip.
 *
 * A closed tooltip's popup is absent from server HTML (§4.1.9): the portal
 * renders only when `mounted || keepMounted`, and `keepMounted` defaults to
 * false (`tooltip/portal/TooltipPortal.js:23-28`) and is never set here.
 */
export const TooltipPopup = forwardRef<HTMLDivElement, TooltipPopupProps>(function TooltipPopup(
  { positioner, className, ...rest },
  ref,
) {
  const id = useContext(TooltipIdContext)
  // Only defined overrides are spread: Base UI's merge lets an explicit
  // `undefined` win, which would silently drop a default above.
  const overrides = Object.fromEntries(
    Object.entries(positioner ?? {}).filter(([, value]) => value !== undefined),
  ) as TooltipPositionerOptions
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner
        side="top"
        sideOffset={POSITIONER_SIDE_OFFSET}
        {...overrides}
        className={tooltipPositionerClass}
      >
        <BaseTooltip.Popup
          {...rest}
          role="tooltip"
          {...(id !== undefined ? { id } : {})}
          ref={ref}
          className={merge(tooltipPopupClass, className)}
        />
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  )
})
