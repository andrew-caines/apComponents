/**
 * Interface strings the components ship themselves — the ones a consumer never
 * passes in. Left hardcoded, a screen-reader user in a non-English locale gets
 * English ARIA, which is the failure ADR-0012 names.
 *
 * The key set is exported as a typed constant so a product can hand it to its
 * i18n pipeline and get a COMPILE ERROR when a key is added and not translated,
 * rather than discovering it in production.
 */
export const DEFAULT_MESSAGES = Object.freeze({
  close: 'Close',
  loading: 'Loading…',
  error: 'Error',
  required: 'required',
  optional: 'optional',
  noResults: 'No results',
  dismiss: 'Dismiss',
})

export type MessageKey = keyof typeof DEFAULT_MESSAGES
// `string | undefined` (not bare `string`) is deliberate: under this repo's
// `exactOptionalPropertyTypes`, an optional property typed as bare `string`
// may be OMITTED but not explicitly set to `undefined`. LocaleProvider must
// accept `messages={{ close: undefined }}` — an explicit no-op override that
// falls back to English rather than blanking the string — so the value type
// has to name `undefined` outright.
export type Messages = Partial<Record<MessageKey, string | undefined>>
