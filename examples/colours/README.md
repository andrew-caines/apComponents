# Colour tokens — visual reference

`index.html` is **generated** — do not edit it.

```bash
npm run gen:colour-demo   # regenerate the page, verify it, recapture the PNGs
```

Open `index.html` in a browser, or look at `colours-light.png` / `colours-dark.png`.

## What it shows

Every one of the 38 semantic colour tokens, drawn as a swatch, then as text, then
as icons, then in context — status banners, buttons per role, borders, the focus
ring — and finally the 74 pairings the WCAG gate asserts on in CI, each with its
measured ratio and APCA Lc.

Ratios marked **gated** are the ones `contrast.gate.test.ts` enforces. The rest are
measured here but not enforced, and are labelled that way so the page never implies
coverage the suite does not have.

## Why it is generated rather than hand-written

Token names, hex labels and contrast ratios come from the token source
(`SEMANTIC_MAP`, `contrastPairings()`, `wcagRatio()`) — the same functions the gate
uses, so the page and CI cannot drift apart. The *colour you see*, though, comes from
the linked `theme.css` at render time. Those are deliberately two different paths:
if the generated stylesheet and the token source ever disagree, a swatch will
disagree with its own printed hex, and the verification pass below fails.

## The light/dark toggle

The three-way control at the top sets `data-ap-scheme` on the root element — the same
attribute `ThemeProvider` writes — so it exercises the real theming mechanism rather
than a demo-only one. **System** removes the attribute and hands control back to the
OS preference.

Because the hex and ratio labels are baked in at generate time, both modes' labels are
emitted and CSS shows one, using selectors that mirror `theme.css`'s exactly. That is
the part most likely to rot: the colours would keep switching while the numbers quietly
described the wrong mode. Check 4 below exists for precisely that.

## The verification pass

`gen:colour-demo` does not just write a file. It loads the page in Chromium in both
schemes and checks five things, failing the build on any of them:

1. **Completeness** — every `--ap-color-*` declared in `theme.css` appears on the
   page. Enumerated from the stylesheet, not from a hand-written list, so a token
   added to the theme cannot be silently missing here.
2. **Painted == specified** — each swatch's computed `background-color` is compared
   against the hex the token source says it should be, in both modes.
3. **Page and gate agree** — the pairing table's row count matches
   `contrastPairings()`.
4. **The toggle moves both the colour and the labels**, in both directions, against a
   light OS and a dark OS — so neither direction passes by agreeing with the system
   preference — and **System** restores the OS value.
5. **The pinned hover specimen equals what `:hover` actually paints**, for every role,
   and both equal the `-bg-hover` token. A swatch labelled "hover" that does not match
   the real hover is worse than no swatch — a wrong answer wearing a proof's clothing.
   This check earned its place immediately: it found that live hover never moved at all,
   because an inline `background` beats any stylesheet `:hover` rule. Backgrounds now
   travel as `--rest-bg` / `--hover-bg` custom properties so the stylesheet governs them.

Each check was confirmed to fail under its own perturbation (drop a token from the
palette; paint a swatch red; hide a gate row; stop the toggle setting the attribute;
remove the label-switching CSS so the colours follow but the numbers do not; point the
pinned hover swatch at the resting colour) and to pass once restored. A check that
has never been seen to fail is not evidence of anything.

If playwright is not installed (`npm run fixture:install`), the page is still written
and the verification is skipped with a notice.
