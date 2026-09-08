'use client'

import { forwardRef, useId, type Ref } from 'react'
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
 * so `for`/`id` are both in the server markup), so accepting one here would
 * make a radio group the one labelled control in the library whose name a
 * no-JS or pre-hydration reader does not get.
 *
 * There is exactly ONE id, used at both ends, and it is the same value Base UI
 * itself resolves to afterwards: `useBaseUiId(idOverride)` returns the override
 * unchanged, so the effect registers our id and `labelId ?? legendId` computes
 * our id. Server render, first client render and post-effect render therefore
 * all agree — nothing to conflict, and no hydration mismatch.
 */
export interface RadioGroupRootProps
  extends Omit<BaseRadioGroupProps<string>, 'className' | 'render'> {
  /** The group's visible label. Required — an unlabelled group is a defect. */
  label: string
  className?: string
}

/**
 * `className` and `ref` both address the element this part renders at its root
 * — the `<fieldset>` — so the two never disagree about which box they mean.
 * The elements inside it (the legend, the `Field.Root` scope, the
 * `role="radiogroup"` div) are this part's internal composition.
 */
export const RadioGroupRoot = forwardRef<HTMLFieldSetElement, RadioGroupRootProps>(
  function RadioGroupRoot({ label, className, children, ...rest }, ref) {
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
    'className' | 'render' | 'nativeButton' | 'children'
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
}

/**
 * `className` and `ref` both address the element this part renders at its root
 * — the `Field.Item` div — matching `RadioGroupRoot`. The hidden `<input>` is
 * still reachable through Base UI's own `inputRef` prop, which this part
 * forwards untouched.
 */
export const RadioGroupItem = forwardRef<HTMLDivElement, RadioGroupItemProps>(
  function RadioGroupItem({ label, hint, size = 'md', className, ...rest }, ref) {
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
      <BaseField.Item ref={ref} className={merge(radioGroupItemClass, className)}>
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
