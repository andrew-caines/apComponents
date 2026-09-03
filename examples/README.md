# Examples

Visual references. Every page reads the **generated** `theme.css`, so nothing here can
drift from the tokens without the page changing. Open any of them straight from disk —
no server, no build.

| | |
|---|---|
| [`scales/`](scales/) | Size scales — text, icons, radius, space, elevation. Hand-written; open `index.html` directly. `npm run gen:scale-demo` recaptures the screenshots. |
| [`colours/`](colours/) | Every colour token as swatch, text, icon and in context, plus the 74 contrast pairings CI asserts on. Generated — `npm run gen:colour-demo`. |
| [`InputFields.html`](InputFields.html) | `Input` and `Field`: what they look like and how to use them, each specimen paired with the source that produced it. Generated — `npm run gen:input-demo`. |

The token pages are built from the token source. `InputFields.html` goes further: its
specimens are `renderToString` output from the real components, styled by a real
vanilla-extract compile of their `.css.ts` files, and each code sample is read back out
of `scripts/input-demo/examples.tsx`'s AST — the same expression that produced the markup
beside it. There is no second copy of any snippet, so a sample cannot disagree with its
own output.

The inputs on that page are genuine `<input>` elements, so typing, hover and focus all
work with no JavaScript. Only behaviour that needs React — validation firing on blur — is
inert, and those states appear as rendered specimens instead.

Each directory's README explains what the page proves and how it is verified.
