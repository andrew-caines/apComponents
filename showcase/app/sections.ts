/**
 * The showcase's single source of truth.
 *
 * Both the router (`routes.ts`) and the nav bar (`root.tsx`) derive from this
 * list, so the navigation cannot advertise a page that does not exist and a
 * page cannot exist without appearing in the navigation. That is the whole
 * point of the indirection: a showcase whose nav has to be updated by hand
 * eventually stops matching the app, and then nobody trusts it.
 *
 * **Adding a component to the showcase is one entry here and one route file.**
 * The smoke test in `e2e/smoke.spec.ts` walks this array, so a new section is
 * covered the moment it is added, with no test to update.
 *
 * The prose foundations pages (colour, typography, theming, icons and the
 * scales page) live in Storybook now, as MDX docs — this list is only the
 * components, so it is not alphabetical, just the order they were added in.
 */
export interface Section {
  /** URL path and the anchor the nav links to. */
  slug: string
  /** Nav label. Keep it short — the bar is one line. */
  title: string
  /** Route module, relative to `app/`. */
  file: string
  /** One line, shown as the page's standfirst. */
  blurb: string
}

export const SECTIONS: readonly Section[] = [
  {
    slug: 'button',
    title: 'Button',
    file: 'routes/button.tsx',
    blurb: 'Variants, tones and sizes, plus `render` passthrough to a real anchor.',
  },
  {
    slug: 'surface',
    title: 'Surface',
    file: 'routes/surface.tsx',
    blurb: 'The three background tones and the padding steps.',
  },
  {
    slug: 'field-input',
    title: 'Field & Input',
    file: 'routes/field-input.tsx',
    blurb: 'Labelled fields, errors, adornments and the loading state.',
  },
  {
    slug: 'spinner',
    title: 'Spinner',
    file: 'routes/spinner.tsx',
    blurb: 'The indeterminate indicator, and what it does under reduced motion.',
  },
  {
    slug: 'dialog',
    title: 'Dialog',
    file: 'routes/dialog.tsx',
    blurb: 'Modal surfaces: sizes, the sheet layout, focus handling and motion.',
  },
  {
    slug: 'form-controls',
    title: 'Form controls',
    file: 'routes/form-controls.tsx',
    blurb: 'Textarea, Checkbox, Switch and RadioGroup — sizes, defaults and indeterminate.',
  },
  {
    slug: 'select',
    title: 'Select',
    file: 'routes/select.tsx',
    blurb: 'Single, grouped and multiple selection.',
  },
  {
    slug: 'overlays',
    title: 'Tooltip & Popover',
    file: 'routes/overlays.tsx',
    blurb: 'A hover and focus tooltip, and a click-opened popover with a title.',
  },
  {
    slug: 'disclosure',
    title: 'Tabs & Accordion',
    file: 'routes/disclosure.tsx',
    blurb: 'Manual-activation tabs and an accordion whose closed sections are findable in the page.',
  },
]
