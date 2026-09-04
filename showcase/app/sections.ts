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
 * Ordering is foundations first, then components — roughly the order someone
 * meeting the library should read them in, not alphabetical.
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
    slug: 'foundations',
    title: 'Foundations',
    file: 'routes/foundations.tsx',
    blurb: 'The scales everything else is built from: space, radius, icon sizes and elevation.',
  },
  {
    slug: 'typography',
    title: 'Typography',
    file: 'routes/typography.tsx',
    blurb: 'The type scale, the font stacks, and the metric-matched fallback.',
  },
  {
    slug: 'colour',
    title: 'Colour',
    file: 'routes/colour.tsx',
    blurb: 'Semantic colour roles in both schemes — every pairing CI checks for contrast.',
  },
  {
    slug: 'theming',
    title: 'Theming',
    file: 'routes/theming.tsx',
    blurb: 'How ThemeProvider works: the build-time default, the runtime override, and colour scheme.',
  },
  {
    slug: 'icons',
    title: 'Icons',
    file: 'routes/icons.tsx',
    blurb: 'The icon set, its sizes, and the decorative-versus-labelled contract.',
  },
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
]
