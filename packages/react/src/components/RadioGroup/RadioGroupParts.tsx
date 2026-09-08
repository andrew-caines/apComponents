'use client'

import { forwardRef, useId, type CSSProperties, type Ref } from 'react'
import { Field as BaseField } from '@base-ui/react/field'
import { Fieldset as BaseFieldset } from '@base-ui/react/fieldset'
import { Radio as BaseRadio } from '@base-ui/react/radio'
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group'
import type { RadioGroupProps as BaseRadioGroupProps } from '@base-ui/react/radio-group'
import type { RadioRootProps as BaseRadioRootProps } from '@base-ui/react/radio'
import {
  radioGroupFieldsetClass,
  radioGroupHintRecipe,
  radioGroupItemClass,
  radioGroupLegendClass,
  radioGroupListClass,
  radioGroupOptionClass,
  radioGroupOptionTextClass,
  radioIndicatorClass,
  radioRecipe,
} from './RadioGroup.css.js'

export { RADIO_GROUP_TOKENS } from './RadioGroup.tokens.js'

/**
 * These two parts are the compound API behind `RadioGroup`, and between them
 * they assemble FOUR Base UI parts rather than one each. That is unlike
 * `FieldParts.tsx`, where every wrapper is one Base UI part plus a class, and
 * the reason is that a radio group's ARIA wiring is not expressible as a flat
 * set of independently-usable wrappers:
 *
 *  - `Radio.Root` has NO `name` prop of its own (see `radio/root/RadioRoot.js`,
 *    which destructures `name` from `RadioGroupContext`, and its props type,
 *    which declares only `value`/`disabled`/`required`/`readOnly`/`inputRef`).
 *    Outside a group its `checked` is computed against `''`, so nothing posts.
 *    A standalone `Radio` wrapper would therefore be a part that cannot work,
 *    which is why this file exports no such thing.
 *  - `Field.Item` and `Field.Description` both call
 *    `useFieldRootContext(false)` — the NON-optional form, which throws
 *    "FieldRootContext is missing" when there is no `<Field.Root>` ancestor
 *    (`internals/field-root-context/FieldRootContext.js`). So the `Field.Root`
 *    that scopes the group has to be inside `RadioGroupRoot`: if it lived in
 *    the convenience component instead, `RadioGroup.Root` + `RadioGroup.Item`
 *    — the documented escape hatch — would throw on render.
 *
 * `render` is deliberately not exposed on either part, per spec §4.1.2: each
 * one owns its own markup end to end, and swapping the rendered element would
 * break the wiring described above. With no `render` there is nothing to derive
 * `nativeButton` from either, so it is left off the prop surface entirely
 * rather than forwarded at Base UI's default — the same choice `Checkbox` and
 * `Switch` make.
 *
 * Neither part computes, reads or passes a CONTROL id or `aria-describedby`.
 * Base UI's `LabelableProvider` owns those: the description registers its own
 * id into the provider and `Radio.Root` merges it, and each option's hidden
 * input takes its id from the provider too. See the longer note on
 * `FieldParts.tsx` for why a second, hand-written wiring there is worse than
 * none.
 *
 * The GROUP's label id is the one exception, and `RadioGroupRoot`'s own comment
 * below explains why it has to be — Base UI registers that one from a layout
 * effect, so leaving it alone means server-rendered markup with no accessible
 * name on the group at all.
 */

function merge(recipeClass: string, className: string | undefined): string {
  return [recipeClass, className].filter(Boolean).join(' ')
}

/**
 * `label` is required, and it is rendered through `Fieldset.Legend` rather than
 * `Field.Label`.
 *
 * Base UI's radio group registers no control id — there is no single element
 * for a `<label for>` to point at, only N hidden inputs — so a `Field.Label`
 * beside the group emits a `for` naming a generated id that is on no element,
 * and clicking it does nothing at all. `RadioGroup`'s own source resolves its
 * accessible name as `labelId ?? fieldsetContext?.legendId`
 * (`radio-group/RadioGroup.js`), so the legend is the supported channel.
 *
 * Note that `Fieldset.Legend` renders a `<div>`, NOT a `<legend>`
 * (`fieldset/legend/FieldsetLegend.js` calls `useRenderElement('div', …)`), so
 * the association is `aria-labelledby` and nothing else — there is no native
 * `<fieldset>`/`<legend>` naming here to fall back on. Assert it that way; do
 * not look for a `<legend>` element.
 *
 * The legend's id is generated HERE, with `useId`, and passed to both ends of
 * that association — `id` on the legend, `aria-labelledby` on the group and on
 * the fieldset — rather than being left to Base UI to register.
 *
 * That is a deliberate exception to `FieldParts.tsx`'s "never pass `id` or the
 * ARIA attributes by hand" rule, and it is not the double-wiring that rule
 * forbids. Base UI registers the legend's id from a LAYOUT EFFECT
 * (`utils/useRegisteredLabelId.js` → `useIsoLayoutEffect(() =>
 * setLegendId(id))`), and the fieldset holds it in `useState`, so with the
 * registration left alone the group's `aria-labelledby` is absent from
 * server-rendered HTML entirely and only appears after hydration — a radio
 * group with NO accessible name at all until then. `Field` + `Input` has no
 * such gap (its control id comes from the labelable provider's initial state,
 * so `for`/`id` are both in the server markup), and accepting one here would
 * make a radio group the one labelled control in the library whose GROUP name
 * is missing from the server markup.
 *
 * Be precise about what that buys, because the broader claim is wrong: this is
 * NOT a no-JavaScript fix. Each option's own name is still assigned after
 * hydration — `useAriaLabelledBy` writes the wrapping `<label>`'s id from a
 * layout effect (`internals/labelable-provider/useAriaLabelledBy.js`) — and
 * the operable control is a `role="radio"` span, since the real `<input>` is
 * `aria-hidden`, `tabIndex: -1` and visually hidden (`radio/root/RadioRoot.js`,
 * `inputProps`). With JavaScript off the options are unnamed and unoperable
 * either way. What this DOES buy is a named group for assistive technology
 * reading streamed or not-yet-hydrated markup, and parity with `Field` +
 * `Input`, whose label association is already in the server HTML.
 *
 * There is exactly ONE id, used at both ends, and it is the same value Base UI
 * itself resolves to afterwards: `useBaseUiId(idOverride)` returns the override
 * unchanged, so the effect registers our id and `labelId ?? legendId` computes
 * our id. Server render, first client render and post-effect render therefore
 * all agree — nothing to conflict, and no hydration mismatch.
 */
export interface RadioGroupRootProps
  extends Omit<BaseRadioGroupProps<string>, 'className' | 'render' | 'style'> {
  /** The group's visible label. Required — an unlabelled group is a defect. */
  label: string
  className?: string
  /**
   * Narrowed to a plain style object. Base UI also accepts a
   * `(state) => CSSProperties` callback here, but this part renders TWO
   * elements and a callback typed against the radio group's state could only
   * ever be evaluated for one of them — so the callback form is dropped rather
   * than silently applied to whichever element won. `className` is narrowed to
   * `string` for the same reason, as it is on every part in `FieldParts.tsx`.
   */
  style?: CSSProperties
}

/**
 * This part renders two boxes a caller could plausibly mean — the outer
 * `<fieldset>` and the inner `role="radiogroup"` div — so the split between
 * them is stated here in full, and pinned by `RadioGroupParts.test.tsx`'s
 * "props land on the elements these parts document" test:
 *
 *  - **`className`, `style` and `ref` address the `<fieldset>`.** It is the
 *    element this part renders at its root and the one carrying the layout, so
 *    the three presentation/identity props a caller reaches for never disagree
 *    about which box they mean. (An earlier revision left `style` in the spread
 *    to the inner group, which put a caller's margin on a different element
 *    from their class. That is the specific incoherence this comment and that
 *    test exist to prevent.)
 *  - **Every other prop addresses the inner group.** Those are Base UI's radio
 *    group props (`name`, `value`/`defaultValue`, `onValueChange`, `disabled`,
 *    `readOnly`, `required`, `form`, `inputRef`) and the remaining DOM
 *    passthrough — `id`, `data-*`, `aria-*`, event handlers — which travel with
 *    them so there is no hand-maintained list of prop names here to drift out
 *    of step with Base UI's own type.
 *
 * Two of those are deliberate rather than incidental, and would be wrong on the
 * fieldset:
 *
 *  - `id` must stay on the group. Base UI passes it to
 *    `useRegisterFieldControl` (`radio-group/RadioGroup.js`), so it is the
 *    identity a surrounding `Field` registers this control under, not a styling
 *    hook.
 *  - `aria-labelledby` must stay on the group, because the group is the element
 *    with `role="radiogroup"` and therefore the one whose accessible name a
 *    caller would be overriding.
 *
 * A handler passed here still sees every event this component can raise even
 * though it sits on the inner element: all of them originate at or below the
 * group, and React's synthetic `onFocus`/`onBlur` bubble too.
 *
 * The legend and the `Field.Root` scope take no caller props at all — they are
 * this part's internal composition.
 */
export const RadioGroupRoot = forwardRef<HTMLFieldSetElement, RadioGroupRootProps>(
  function RadioGroupRoot({ label, className, style, children, ...rest }, ref) {
    // See the block comment above for why this id is ours rather than Base
    // UI's, and why that is not a second, conflicting ARIA wiring.
    const legendId = useId()
    return (
      <BaseFieldset.Root
        // Base UI types this ref as `Ref<HTMLElement>` while rendering a real
        // `<fieldset>`; a ref object is invariant in its element type, so the
        // narrower ref is not assignable without a cast. Same reasoning as
        // `FieldParts.tsx`/`Input.tsx` — the cast lives here so consumers get
        // the accurate type.
        ref={ref as Ref<HTMLElement>}
        aria-labelledby={legendId}
        className={merge(radioGroupFieldsetClass, className)}
        // Conditionally SPREAD, never `style={style}`. Base UI merges element
        // props with `for...in` (`merge-props/mergeProps.mjs`), which visits a
        // key whose value is `undefined` and lets it win, and under
        // `exactOptionalPropertyTypes` an explicit `undefined` is not the same
        // as an omitted prop either.
        {...(style !== undefined ? { style } : {})}
      >
        <BaseFieldset.Legend id={legendId} className={radioGroupLegendClass}>
          {label}
        </BaseFieldset.Legend>
        {/*
          `Field.Root` carries no props and no class on purpose. It is here for
          its CONTEXT alone: `Field.Item` and `Field.Description` inside each
          option throw without it (see the note at the top of this file), and
          the per-option labelable providers that give each hidden input its
          own id are nested inside this one.

          It must NOT be given `name`. Base UI's RadioGroup resolves its name
          as `fieldName ?? nameProp` (`radio-group/RadioGroup.js`), so a `name`
          here would silently override the one on the group and the two would
          look interchangeable while only one took effect.
        */}
        <BaseField.Root>
          {/*
            `aria-labelledby` sits BEFORE the spread so a caller who supplies
            their own still wins — the group's name is theirs to override, and
            a value placed after the spread would silently ignore it.
          */}
          <BaseRadioGroup
            aria-labelledby={legendId}
            {...rest}
            className={radioGroupListClass}
          >
            {children}
          </BaseRadioGroup>
        </BaseField.Root>
      </BaseFieldset.Root>
    )
  },
)

/**
 * One option: its control, its text, and optionally its own hint.
 *
 * The props are `Radio.Root`'s, because that is what a caller varies per
 * option — `value`, `disabled`, `required` — plus the copy this part renders.
 */
export interface RadioGroupItemProps
  extends Omit<
    BaseRadioRootProps<string>,
    'className' | 'render' | 'style' | 'nativeButton' | 'children'
  > {
  /**
   * The option's visible, clickable label — and the source of this radio's
   * accessible name, via the `<label>` that wraps the control. Required for
   * the same reason `Checkbox`'s and `Switch`'s are: an unnamed control is the
   * single most common accessibility failure, and requiring the prop makes it
   * unreachable rather than merely discouraged.
   */
  label: string
  /**
   * Supporting copy for THIS option alone, rendered as a `Field.Description`
   * inside this option's `Field.Item` — so it lands in that option's
   * `aria-describedby` and no other's.
   */
  hint?: string
  /** Size of the control. Defaults to `md`. */
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Narrowed to a plain style object — see `RadioGroupRootProps.style`. */
  style?: CSSProperties
}

/**
 * The same split as `RadioGroupRoot`, for the same reason: `className`, `style`
 * and `ref` address the element this part renders at its root — the
 * `Field.Item` div, which holds the option's row and its hint — and every other
 * prop addresses the wrapped `Radio.Root` (`value`, `disabled`, `required`,
 * `readOnly`, `inputRef`, plus `id`, `data-*`, `aria-*` and event handlers).
 * `id` in particular belongs on `Radio.Root`, which feeds it to
 * `useLabelableId` as the hidden input's id override.
 *
 * The hidden `<input>` stays reachable through Base UI's own `inputRef`, which
 * this part forwards untouched.
 */
export const RadioGroupItem = forwardRef<HTMLDivElement, RadioGroupItemProps>(
  function RadioGroupItem({ label, hint, size = 'md', className, style, ...rest }, ref) {
    return (
      /*
        The `Field.Item` wrapper is LOAD-BEARING, not decorative — do not
        remove it because it looks like a redundant div.

        `Field.Item` renders a fresh `LabelableProvider` around its children
        (`field/item/FieldItem.js`), and that provider is what mints the id
        each hidden `<input>` uses (`useLabelableId` returns the provider's
        `controlId`) and what scopes each hint's registered description id.
        Without one Field.Item per option, every option resolves to the SAME
        `controlId` from the group's single `Field.Root` provider: three
        identical DOM ids, and every hint describing every option.

        `RadioGroup.test.tsx`'s distinct-ids test is the assertion that
        catches its removal.
      */
      <BaseField.Item
        ref={ref}
        className={merge(radioGroupItemClass, className)}
        // Conditionally spread — see the note on `RadioGroupRoot`'s `style`.
        {...(style !== undefined ? { style } : {})}
      >
        {/*
          A wrapping `<label>`, not a `Field.Label`: `Radio.Root`'s
          `useAriaLabelledBy` looks for a `<label>` that is the hidden input's
          parent and points the radio's `aria-labelledby` at it
          (`internals/labelable-provider/useAriaLabelledBy.js`). The hint is
          deliberately OUTSIDE this element — inside it, the option's
          accessible name would become its label AND its hint run together.
        */}
        <label className={radioGroupOptionClass}>
          <BaseRadio.Root {...rest} className={radioRecipe({ size })}>
            <BaseRadio.Indicator className={radioIndicatorClass} />
          </BaseRadio.Root>
          <span className={radioGroupOptionTextClass}>{label}</span>
        </label>
        {hint !== undefined ? (
          <BaseField.Description className={radioGroupHintRecipe({ size })}>
            {hint}
          </BaseField.Description>
        ) : null}
      </BaseField.Item>
    )
  },
)
