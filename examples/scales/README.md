# Size scales — visual reference

`index.html` renders every size scale in the token set against the **real**
generated `theme.css` and `fonts.css`, linked by relative path. Open it in a
browser directly — there is no build step. Every value on the page is a live
custom property, so it cannot drift from the tokens without the page changing.

```bash
npm run gen:scale-demo   # recapture scales-light.png / scales-dark.png
```

The script also prints the measured pairing table, so the numbers are
reviewable in a terminal rather than only by eye. It throws if `theme.css`
failed to load: an unstyled page still renders, with every `var()` falling
back to nothing, and the screenshot would look plausible while showing none of
the real token values.

## What the two icon tables are for

They exist to make one trap visible. `ICON` is in `em`, so its steps are
**multipliers against the surrounding font size**, not absolute sizes. A named
icon step and the text step of the same name therefore do not agree:

| step | `text-{step}` | `icon-{step}` in that row | `icon-md` in that row |
| ---- | ------------- | ------------------------- | --------------------- |
| xs   | 12px          | 9px                       | 12px                  |
| sm   | 14px          | 12.25px                   | 14px                  |
| md   | 16px          | 16px                      | 16px                  |
| lg   | 20px          | 25px                      | 20px                  |
| xl   | 24px          | 36px                      | 24px                  |
| 2xl  | 32px          | 64px                      | 32px                  |

**To pair an icon with a label, use `md`** — `1em` equals the surrounding text
at every step, which is why it is `Icon`'s default. Name another step only when
the icon should deliberately differ from the text beside it.

The `em` choice is deliberate and worth the trap: an icon inside a small button
shrinks with the button's text automatically, with no per-call-site
coordination. See the note in `docs/CONTRIBUTING.md`.
