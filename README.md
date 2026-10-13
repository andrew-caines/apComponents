# apComponents

A themeable, accessible React component library, built on Base UI and vanilla-extract, and SSR-safe.

**[Storybook →](https://andrew-caines.github.io/apComponents/)** has live examples of every component plus the guides. Start with [Getting started](https://andrew-caines.github.io/apComponents/?path=/docs/guides-getting-started--docs).

## Packages

| Package | What it is |
|---|---|
| `@ap/tokens` | The colour engine and design tokens. `generateTheme({ brand })` builds a full light and dark theme from one seed colour. |
| `@ap/react` | The components, providers, hooks and notifications. |
| `@ap/motion` | Motion tokens and named motions, with reduced-motion overrides. |
| `@ap/vite` | A Vite preset (`apComponents()`) that wires vanilla-extract and the SSR settings. |

Consume it as a git submodule:

```sh
git submodule add https://github.com/andrew-caines/apComponents vendor/apComponents
```

The [Getting started](https://andrew-caines.github.io/apComponents/?path=/docs/guides-getting-started--docs) guide covers the full setup.

## Components

- **[Accordion](https://andrew-caines.github.io/apComponents/?path=/story/components-accordion--default)**
  - Pass an `items` array, or compose `Root`/`Item`/`Header`/`Trigger`/`Panel`.
  - `headingLevel` sets the trigger headings.
  - Closed panels can still be found with find-in-page.
- **[Banner](https://andrew-caines.github.io/apComponents/?path=/story/components-banner--default)**
  - Raise one imperatively with `banner()`.
  - `<BannerRegion>` sets where banners appear in normal page flow.
  - Errors are announced assertively, and the rest politely.
  - With no region mounted, a banner falls back to a toast.
- **[Button](https://andrew-caines.github.io/apComponents/?path=/story/components-button--default)**
  - `variant` is `solid`, `outline` or `ghost`; `tone` is `action` or `danger`; `size` is `sm`, `md` or `lg`.
  - `render` turns it into a real link without forcing `role="button"`.
- **[Checkbox](https://andrew-caines.github.io/apComponents/?path=/story/components-checkbox--default)**
  - Has a built-in `label`, an `indeterminate` state and three sizes.
  - It owns its own markup, so there is no `render` prop.
- **[Dialog](https://andrew-caines.github.io/apComponents/?path=/story/components-dialog--closed)**
  - A modal that requires a `title`, with an optional `description`, `footer` and `trigger`.
  - `size` runs from `sm` to `xl`, plus `fit`.
  - `layout="auto"` becomes a bottom sheet on small screens.
  - Use the compound parts when a form must wrap both the body and the footer.
- **[Field](https://andrew-caines.github.io/apComponents/?path=/story/components-field--default)**
  - Wires the label, description and error to its control.
  - `error` both marks the field invalid and supplies the message, so an invalid field always has text beside it.
  - `validate` supports client-side checks.
- **[Input](https://andrew-caines.github.io/apComponents/?path=/story/components-input--default)**
  - Has `startIcon`/`endIcon`, which flip correctly in right-to-left (RTL) locales, and a `loading` state.
  - A clickable icon must have a `label`; this is enforced by its type.
- **[Popover](https://andrew-caines.github.io/apComponents/?path=/story/components-popover--default)**
  - A non-modal popup that requires either a `title` or an `aria-label`, not both.
- **[RadioGroup](https://andrew-caines.github.io/apComponents/?path=/story/components-radiogroup--default)**
  - Pass `options`, each with an optional per-option `hint`.
  - Has `invalid` and three sizes. `invalid` shows no message on its own, so pair it with error text.
- **[Select](https://andrew-caines.github.io/apComponents/?path=/story/components-select--default)**
  - Supports grouped options and separators.
  - Non-string values require `itemToStringValue`, so forms post a real value.
- **[Spinner](https://andrew-caines.github.io/apComponents/?path=/story/components-spinner--default)**
  - An indeterminate progress indicator that takes `currentColor`.
  - It has an accessible `label`, and its `size` is an icon size or a number.
- **[Surface](https://andrew-caines.github.io/apComponents/?path=/story/components-surface--default)**
  - A themed background container.
  - `tone` is `canvas`, `surface` or `raised`, and `pad` sets the padding.
- **[Switch](https://andrew-caines.github.io/apComponents/?path=/story/components-switch--default)**
  - An on/off toggle with a built-in `label` and three sizes.
- **[Tabs](https://andrew-caines.github.io/apComponents/?path=/story/components-tabs--default)**
  - `variant` is `underline` or `pills`, and the tabs can run horizontally or vertically.
  - The tab list requires an `aria-label` or `aria-labelledby`.
- **[Textarea](https://andrew-caines.github.io/apComponents/?path=/story/components-textarea--default)**
  - A native `<textarea>` that plugs into Field, with typed `rows`, `cols` and `wrap`.
- **[Toast](https://andrew-caines.github.io/apComponents/?path=/story/components-toast--severities)**
  - Raise one imperatively with `toast()` under `NotificationProvider`.
  - Its parts are exported for a custom stack.
- **[Tooltip](https://andrew-caines.github.io/apComponents/?path=/story/components-tooltip--default)**
  - Set `content` and `side`, plus `delay`/`closeDelay`.
  - Wrap the app in `Tooltip.Provider` to share delays across tooltips.
- **[Icon](https://andrew-caines.github.io/apComponents/?path=/story/components-icon--decorative)**
  - The built-in icon set.
  - Override icons app-wide with `IconProvider`.

**[Notifications](https://andrew-caines.github.io/apComponents/?path=/story/notifications-dialogs-and-announcements--confirm):**
- `confirm()` and `alert()` return promises.
- `announce()` sends a message to screen readers only.

**Providers and hooks:**
- `ApProvider` combines theme, locale, icons and notifications.
- `ThemeProvider` and `ThemeScript` set the theme without a flash on load.
- `LocaleProvider` provides translated strings.
- `useHydrated` and `useIsomorphicLayoutEffect` support SSR.

## Guides

- [Getting started](https://andrew-caines.github.io/apComponents/?path=/docs/guides-getting-started--docs): install, configure Vite, and render your first page.
- [SSR rules](https://andrew-caines.github.io/apComponents/?path=/docs/guides-ssr-rules--docs): what server-rendering requires, and which test enforces each rule.
- [Colour theory](https://andrew-caines.github.io/apComponents/?path=/docs/guides-colour-theory--docs): how the ramps and contrast pairings are built.
- [Theming](https://andrew-caines.github.io/apComponents/?path=/docs/foundations-theming--docs) and the [Theme generator](https://andrew-caines.github.io/apComponents/?path=/docs/foundations-theme-generator--docs): pick a brand colour, then copy the code or download a `theme.css`.

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for setup, scripts and the CI gates.
