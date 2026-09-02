# Examples

Visual references for the token set. Both pages read the **generated** `theme.css`,
so nothing here can drift from the tokens without the page changing.

| | |
|---|---|
| [`scales/`](scales/) | Size scales — text, icons, radius, space, elevation. Hand-written; open `index.html` directly. `npm run gen:scale-demo` recaptures the screenshots. |
| [`colours/`](colours/) | Every colour token as swatch, text, icon and in context, plus the 74 contrast pairings CI asserts on. Generated — `npm run gen:colour-demo`. |

Each directory's README explains what the page proves and how it is verified.
