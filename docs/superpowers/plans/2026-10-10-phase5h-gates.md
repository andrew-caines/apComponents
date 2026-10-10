# Phase 5h — Gates 9 and 10, two production-build fixes, and the Phase 5 close-out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Phase 5. This adds:
- gate 10 (bundle budget) and gate 9 (visual regression), both advisory;
- fixes for the two production-build bugs gate 9's spike found;
- coverage of every stateful component in the streamed route;
- the Tooltip flake fix and twelve cheap follow-ups;
- a green all-ten sweep on one PR.

**Architecture:**
- **Gate 10** is a `tsx` script. For each entry it runs a Vite library build with `@ap/vite`, the real consumer plugin, then brotli-compresses the JS and CSS separately and compares each against a JSON budget.
- **Gate 9** is a Playwright suite over the static Storybook build. It enumerates `index.json` and shoots each story in light and dark after its `play` has finished, comparing against Linux-only baselines that a manual workflow commits.
- **`@ap/vite`** gains a `build.cssTarget` default, so `:dir(rtl)` survives a consumer's production CSS minify.

**Tech Stack:** TypeScript, Vite 8.2.2 (lightningcss CSS minify), vanilla-extract, Storybook 10.6.0, Playwright 1.62.1 (`@playwright/test`), Vitest 4, React Router 7 (the `fixtures/ssr-app` fixture), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-04-phase5-remaining-components-design.md`.
- Read §6, §6.1 and §6.2.
- **§6.3 is this plan's scope.** It includes §6.3.6, the two bugs.
- Before any task, read the "What actually happened" sections of the 5f and 5g plans in `docs/superpowers/plans/`.

**How this plan is written, deliberately:** as in 5c–5g:
- **Each rule is stated, and the precedent file that already follows it is cited.**
- Code appears where it is the contract: signatures, gate shapes and the tricky algorithms.
- Every test case is given as an exact input and expected output.
- A deviation from a cited precedent is a review finding unless the step says otherwise.

## Global Constraints

- **Node 22.22.0 in CI** (ICU 77.1). Development machines may run Node 24 (ICU 78.3).
  - Formatter and hook tests must pass on both.
  - The run step is `npx --yes node@22.22.0 node_modules/vitest/vitest.mjs run --project unit <paths>`.
- **Relative imports carry `.js`**, even from `.ts` and `.tsx`.
- **House style:** single quotes, no semicolons. **Never run prettier. Never run a snapshot-update flag locally.** Gate 9 baselines are made only by the `visual-baselines.yml` workflow, on Linux.
- **The SSR-safety gate scans raw text, comments included** (`gates/ssr-safety.gate.test.ts:21-35`).
  - No runtime source under `packages/react/src` may contain `window.`, `document.`, `Date.now()`, `Math.random()`, `localStorage`, `sessionStorage`, `matchMedia` or `useLayoutEffect`. That includes comments.
  - Test files and fixtures are not runtime source.
- **`exactOptionalPropertyTypes` is on** (`tsconfig.base.json:8`).
  - Spread optionals conditionally, and never pass `prop: undefined`.
  - Public option types declare optionals as `?: T | undefined`.
- **There is no jest-dom in unit tests.** Use plain values and `el.getAttribute(…)`.
  - DOM test files start with `// @vitest-environment jsdom`.
  - Stories use `storybook/test`'s `expect`, which does have DOM matchers.
- **Expected strings with invisible or non-ASCII characters are written with `\uXXXX` escapes.**
  - The Write tool turns escapes inside *prose* into raw characters (5g, R6). After writing any file, grep it for raw U+00A0, U+200E, U+200F, U+202F and U+2212, and diff any mechanical rewrite before committing.
- **Check every new file is valid UTF-8** before committing: `iconv -f utf-8 -t utf-8 <file> > /dev/null`.
- **Any task that changes a `package.json` refreshes every lockfile that installs that workspace** (5g, R11).
  - The root `package-lock.json` covers `packages/*` and `storybook`.
  - `fixtures/consumer`, `fixtures/ssr-app` and `showcase` each have their own; refresh with `npm --prefix <dir> install`.
  - `npm run check:lockfiles` must pass.
- **Only one dependency may be added:** `@playwright/test` `^1.62.1`, as a devDependency of the `storybook` workspace. It matches `fixtures/ssr-app/package.json:21` and the installed `playwright` 1.62.1.
- **Every assertion names the change that must make it fail.**
  - Apply each perturbation once, watch it fail, and revert it.
  - **Before prescribing a perturbation, check that the code under test is the only thing between the input and the failure** (5f).
- **A minor that a task reviewer writes as "for the final review" is a question for the controller.** Answer it when it is logged (5g).

## Facts established before writing this plan

Verified on 2026-10-10 by three spikes. Their scripts are in the session scratchpad and are not part of the deliverable.

| # | Fact | Consequence |
|---|---|---|
| 1 | Vite 8.2.2 `build()` with `write: false` returns `RollupOutput[]`, even for one format. Lib mode resolves `lib.entry` against `root`, so a virtual entry arrives as `<root>\virtual:size-entry` (Windows) and must be matched by **suffix**. Each build emits `entry.js` and, when CSS exists, `entry.css`. | `scripts/size/measure.ts` normalises with `Array.isArray` and matches the virtual id with `.replace(/\\/g, '/').endsWith(…)`. |
| 2 | Vite lib mode with the `es` format forces oxc minify `{ codegen: false }`. Whitespace and `//#region <absolute path>` comments stay, so raw bytes vary by working directory. `rollupOptions.output: { minify: true, comments: false }` is spread last and fixes it, making bytes identical from any cwd. | The size build sets that override. Without it the numbers are wrong and machine-dependent. |
| 3 | Brotli at quality 11 (`BROTLI_DEFAULT_QUALITY`), mode `GENERIC`, measured: `index` JS 83,866 / CSS 4,492. Single imports range from 1.1% (`Surface`) to **48.9%** (`Select`) of index JS; Popover is 41.3% and Tooltip 34.5%. CSS is at most 24% (Toast). `hooks` is 6,181 JS, `format` 2,858, `format/phone` 456. All 21 checks take about 11 s. | The ceilings are seeded from these numbers (Task 8). The tripwires are **JS ≤ 70%** and **CSS ≤ 50%** of `index` (spec §6.3.1, the user's decision). |
| 4 | With `"sideEffects": true`, every single import is about 87.6% of index JS and **100%** of index CSS. | This is Task 8's perturbation; it trips both tripwires. |
| 5 | The `Banner` directory exports `BannerRegion` and `BANNER_TOKENS`, not `Banner`. Every other component directory exports `<Dir>`. | The size script's directory → export map is `{ Banner: 'BannerRegion' }`, and it fails loudly for any other mismatch. |
| 6 | `storybook-static/index.json` has 131 entries: 126 stories and 5 docs. `npx vite preview --outDir storybook-static --port 6007 --strictPort`, run from `storybook/`, serves it with no config file. It binds **IPv6 `[::1]` only**. | Playwright's `baseURL` is `http://localhost:6007`, never `127.0.0.1`. |
| 7 | Render phases run `preparing → loading → rendering → playing → played → completing → completed → afterEach → finished`. `completed` lasts about 100 ms; **`finished` is the resting phase**. A throwing play passes through `errored` and **still ends at `finished`**, with `storyFinished` reporting `status: "success"`. | Gate 9 waits for `finished` and detects play failures through the channel trap (fact 8). |
| 8 | An `addInitScript` setter trap on `window.__STORYBOOK_ADDONS_CHANNEL__` fires exactly once per load (756 of 756 in the spike) and catches every failing play. The trap code is in Task 9, Step 3. | Gate 9 uses it verbatim. |
| 9 | Under `reducedMotion: 'reduce'`, Accordion `Motion` and Toast `Swipe` fail and Select `Default` flakes. Under `'no-preference'` with `animations: 'disabled'`, three passes over 126 stories were byte-identical in light. In dark, only `select--multiple` differed, by 2 px; in a separate run it reached 5 px. | Gate 9 uses `'no-preference'` and `maxDiffPixels: 10`. |
| 10 | Real token names are `--ap-color-bg-canvas` (`theme.css:86`) and `--ap-color-text-primary` (`theme.css:92`). `--ap-color-fg-default` does not exist. With no body background, dark screenshots are white pages. | `storybook/.storybook/preview.css` paints the canvas (Task 4). |
| 11 | Plays that throw in the **production** Storybook, every run:<br>• `select--native-label-warning`: asserts a dev-only warning.<br>• `tabs--right-to-left` and `toast--right-to-left`: the RTL bug.<br>• `select--default`: the second ArrowDown does not move the highlight. | One opt-out (`native-label-warning`). Tasks 5 and 6 fix the rest. |
| 12 | Vite's client CSS minify is lightningcss against `build.cssTarget`, which defaults to `['chrome111','edge111','firefox114','safari16.4','ios16.4']` (`vite/dist/node/chunks/node.js:612-618, 33578, 33632, 33639-33640, 23484-23488`). `:dir()` needs chrome120, so it is lowered to `:is(:lang(ae),:lang(ar),…,:lang(yi))`. With `['chrome120','edge120','firefox114','safari16.4','ios16.4']` it survives. `fixtures/ssr-app`'s production build has no `:dir(rtl)` today. | Task 5. |
| 13 | `fixtures/ssr-app` has no `app/entry.client.tsx`. React Router's default calls `hydrateRoot` with no `onRecoverableError`, and `e2e/hydration.spec.ts:30-38` watches only the console and `pageerror`. | Task 7 adds the entry and the assertion. |
| 14 | `app/root.tsx` in `fixtures/ssr-app` has no `LocaleProvider`. `Select` throws without one (`LocaleProvider.tsx:53`). `form.tsx:67` wraps its content in `<LocaleProvider>` with no props. | `streamed.tsx` wraps its `<Suspense>` the same way (Task 7). |
| 15 | `formatTime(Date.UTC(2026, 2, 5, 14, 30), { locale: 'en-US', timeZone: 'UTC', timeZoneName: 'short' })` is `'3/5/2026, UTC'` on both ICU 77.1 and 78.3. | F8, Task 1. |
| 16 | The `formatAddress` outputs in Task 1's table were run on Node 24.19.0 and Node 22.22.0 and are byte-identical. | Safe to assert exactly. |
| 17 | `process.env.TZ = 'Asia/Tokyo'` set at runtime changes `new Intl.DateTimeFormat().resolvedOptions().timeZone` on Node 24 (the spike) and is honoured by V8 on Node 22. | F7, Task 2. Task 2 verifies this on Node 22 in its first step. |
| 18 | RadioGroup's `invalid` JSDoc (`RadioGroup.tsx:31-49`) already says it is a colour-and-border cue, must be paired with visible copy, and points to `Field`'s `error`. It landed in `d25edbb`. | F2 is recorded closed, with no code change. |
| 19 | The unit project includes only `packages/*/src/**/*.test.{ts,tsx}` (`vitest.config.ts:17`). | Task 8 adds `scripts/**/*.test.ts` to that include. |

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/react/src/format/address.test.ts` | F3: pins the untested templates |
| `packages/react/src/format/mask.ts` (+ test) | F4: extension-aware `maskPhone` |
| `packages/react/src/format/date.test.ts`, `date.ts` (JSDoc) | F8 |
| `packages/react/src/hooks/useStorage.test.tsx` | F5 |
| `packages/react/src/hooks/useCopyToClipboard.ts` (+ test) | F6: the unmount-while-pending fix |
| `packages/react/src/hooks/useFormatter.ts` (+ test) | F7 test; F11 removes the casts |
| `packages/react/src/hooks/useIntersectionObserver.ts` (+ test) | F9: reset on rebuild |
| `packages/react/src/hooks/useControllableState.ts` | F12: JSDoc |
| `packages/react/src/hooks/useEventListener.ts` (+ test) | F11: event-typed handler |
| `packages/react/src/notifications/types.ts`, `NotificationProvider.tsx`, `providers/ApProvider.tsx`, `notifications/api.test.ts` | F1 |
| `packages/react/src/gates/ssr-safety.gate.test.ts` | F10: reference-based check plus a self-test |
| `packages/react/src/components/Tooltip/Tooltip.stories.tsx` | The `TwoOpen` flake |
| `storybook/.storybook/preview.css`, `preview.tsx` | Themed canvas |
| `packages/vite/src/index.ts` (+ test) | `AP_CSS_TARGET`, the `cssTarget` default, the lowering warning |
| `storybook/.storybook/main.ts` | The same `cssTarget` |
| `packages/react/src/gates/ssr-render.gate.test.ts` | RTL CSS assertion; streamed-route assertions |
| `packages/react/src/components/Select/*` | Whatever Task 6's root cause dictates |
| `fixtures/ssr-app/app/entry.client.tsx`, `app/routes/streamed.tsx`, `e2e/hydration.spec.ts` | Task 7 |
| `scripts/size/measure.ts`, `scripts/size/budget.ts`, `scripts/size/budget.test.ts`, `scripts/size.ts` | Gate 10 |
| `packages/react/size-budget.json` | Gate 10 ceilings |
| `storybook/visual/playwright.config.ts`, `storybook/visual/stories.spec.ts`, `storybook/visual/summary.ts` | Gate 9 |
| `.github/workflows/ci.yml`, `.github/workflows/visual-baselines.yml` | CI wiring |
| `docs/CONTRIBUTING.md` | Gate 9 and 10 docs; the Chrome 120 CSS floor |
| root `package.json`, `storybook/package.json`, `vitest.config.ts` | Scripts, the dependency, the unit include |

## Review Focus

The five inputs most likely to bite that no task's own tests would naturally exercise:

1. **A consumer who already sets `build.cssTarget`.** The plugin must respect it and must not overwrite it silently. If that target lowers `:dir()` anyway, the consumer gets one warning, not silence and not an error. Pinned in Task 5, Step 2.
2. **A story added after the baselines exist.** Gate 9 must report it as a missing baseline, not pass vacuously and not crash the run. Pinned in Task 9, Step 6, by the summary's "missing" count.
3. **A new component directory with no budget entry.** Gate 10 reports a breach that names it, rather than skipping it. Pinned in Task 8, Step 2.
4. **A phone number whose extension is written in full-width digits, or with no space before `x`.** It is still recognised as an extension. Pinned in Task 1's F4 table.
5. **`useCopyToClipboard` unmounted mid-copy while the clipboard promise later rejects.** Nothing is set and no timer is left. Pinned in Task 2's F6 test.

---

### Task 1: Formatter follow-ups (F2, F3, F4, F8)

**Files:**
- Modify: `packages/react/src/format/address.test.ts`, `packages/react/src/format/mask.ts`, `packages/react/src/format/mask.test.ts`, `packages/react/src/format/date.test.ts`, `packages/react/src/format/date.ts` (JSDoc only)

**Interfaces:**
- Produces: `maskPhone(value: string | null | undefined): string`. The signature is unchanged; the behaviour changes as described below.

- [ ] **Step 1: F3, address tests.** Add one `it` per row to `address.test.ts`, in the shape of the GB case at lines 46-53. Write the JP row with escapes, as the existing JP tests at lines 59-68 do.

  | Name | Input | Options | Expected |
  |---|---|---|---|
  | AU, city line without commas | `{ lines: ['1 George St'], locality: 'Sydney', region: 'NSW', postalCode: '2000', country: 'AU' }` | `{ locale: 'en-US' }` | `'1 George St\nSydney NSW 2000\nAustralia'` |
  | NZ drops the region | `{ lines: ['1 Queen St'], locality: 'Auckland', region: 'Auckland', postalCode: '1010', country: 'NZ' }` | `{ locale: 'en-US' }` | `'1 Queen St\nAuckland 1010\nNew Zealand'` |
  | IE stacked | `{ lines: ['1 Grafton St'], locality: 'Dublin', region: 'Co. Dublin', postalCode: 'D02 X285', country: 'IE' }` | `{ locale: 'en-US' }` | `'1 Grafton St\nDublin\nCo. Dublin\nD02 X285\nIreland'` |
  | IN, region after the postal line | `{ lines: ['1 MG Road'], locality: 'Bengaluru', region: 'Karnataka', postalCode: '560001', country: 'IN' }` | `{ locale: 'en-US' }` | `'1 MG Road\nBengaluru 560001\nKarnataka\nIndia'` |
  | SG | `{ lines: ['1 Raffles Place'], locality: 'Singapore', postalCode: '048616', country: 'SG' }` | `{ locale: 'en-US' }` | `'1 Raffles Place\nSingapore 048616\nSingapore'` |
  | NL, postal code first | `{ lines: ['Damrak 1'], locality: 'Amsterdam', postalCode: '1012 LG', country: 'NL' }` | `{ locale: 'en-US' }` | `'Damrak 1\n1012 LG Amsterdam\nNetherlands'` |
  | CA, like US | `{ lines: ['1 Yonge St'], locality: 'Toronto', region: 'ON', postalCode: 'M5E 1W7', country: 'CA' }` | `{ locale: 'en-US' }` | `'1 Yonge St\nToronto, ON M5E 1W7\nCanada'` |
  | CA at home omits the country | same as CA | `{ locale: 'en-CA' }` | `'1 Yonge St\nToronto, ON M5E 1W7'` |
  | JP single-line | the existing JP address from lines 57-65 | `{ locale: 'ja-JP', form: 'single' }` | `'〒100-0001, 東京都千代田区, 1-2-3, 山田太郎'` |

  - The AU row's expected output equals the generic fallback, so deleting AU's entry cannot fail it. Say so in a comment.
  - Perturbations:
    - set `NZ: NO_COMMA_CITY_LAST` (the NZ row fails);
    - set `TEMPLATES.CA = TEMPLATES.GB` (the CA row fails);
    - set `AU: POSTAL_FIRST` (the AU row fails).

- [ ] **Step 2: F4, failing tests.** Add a `describe('maskPhone extensions')` block to `mask.test.ts`. Keep the existing `beforeEach`, which spies on `console.warn`.

  | Input | Expected |
  |---|---|
  | `'+1 (555) 123-4567 ext. 89'` | `'+* (***) ***-4567 ext. **'` |
  | `'+1 555 123 4567 x1234'` | `'+* *** *** 4567 x****'` |
  | `'+1 555 123 4567x12'` | `'+* *** *** 4567x**'` |
  | `'tel:+1-555-123-4567;ext=12'` | `'tel:+*-***-***-4567;ext=**'` |
  | `'020 7946 0958 #5'` | `'*** **** 0958 #*'` |
  | `'020 7946 0958 EXT 7'` | `'*** **** 0958 EXT *'` |
  | `'+1 555 123 4567 x１２'` (full-width 1 and 2) | `'+* *** *** 4567 x**'` |
  | `'+1 (555) 123-4567'` (no extension; unchanged) | `'+* (***) ***-4567'` |

  Run `npx vitest run --project unit packages/react/src/format/mask.test.ts`. Expected: the first seven rows FAIL. For example, the first returns `'+* (***) ***-**67 ext. 89'`.

- [ ] **Step 3: F4, implementation.** In `mask.ts`:

  ```ts
  // An extension is a marker (`;ext=`, `ext`, `ext.`, `x` or `#`, any case) followed by
  // digits at the very end. The leftmost possible marker wins, so `;ext=` is taken
  // whole rather than matching its `x`.
  const EXTENSION = /(;ext=|\s*(?:ext\.?|x|#)\s*)(\p{Nd}+)$/iu

  /**
   * Keeps the last four digits of the main number; separators, spaces, '+' and
   * parentheses pass through. An extension is masked in full and never counts
   * toward the four.
   */
  export function maskPhone(value: string | null | undefined): string {
    return guard('maskPhone', value, typeof value !== 'string' || value === '', () => {
      const match = EXTENSION.exec(value!)
      if (!match) return maskKeepingLast(value!, 4, isDigit)
      const main = value!.slice(0, match.index)
      return maskKeepingLast(main, 4, isDigit) + match[1] + '*'.repeat(Array.from(match[2]!).length)
    })
  }
  ```

  - Run Step 2's command. Expected: PASS, along with every existing `maskPhone` test (lines 30-42, 88 and 109).
  - Perturbation: drop the `u` flag (the full-width row fails).

- [ ] **Step 4: F8.**
  - Replace the assertion at `date.test.ts:79-81` with `.toBe('3/5/2026, UTC')`.
  - In `formatTime`'s JSDoc in `date.ts`, add one sentence: passing only `timeZoneName` switches off the time default, so `Intl` fills in its default **date** fields. To get a time with a zone name, pass `hour` and `minute` too.
  - Perturbation: remove `timeZoneName` from `COMPONENT_KEYS` (`date.ts:30`). The test fails, because a `timeStyle` gets merged and `Intl` throws a `TypeError`, which the guard turns into `''`.

- [ ] **Step 5: F2.** No code change. The Task 10 retrospective records F2 as closed by `d25edbb` (fact 18).

- [ ] **Step 6: Run both Node versions.**
  - `npx vitest run --project unit packages/react/src/format`
  - `npx --yes node@22.22.0 node_modules/vitest/vitest.mjs run --project unit packages/react/src/format`
  - `npm run test:guards`

  All pass. Apply and revert each perturbation above.

- [ ] **Step 7: Commit.**
  ```bash
  git add packages/react/src/format
  git commit -m "fix(format): maskPhone masks extensions whole; pin remaining address templates and timeZoneName output"
  ```

---

### Task 2: Hook follow-ups (F5, F6, F7, F9, F12)

**Files:**
- Modify: `packages/react/src/hooks/useStorage.test.tsx`, `useCopyToClipboard.ts`, `useCopyToClipboard.test.tsx`, `useFormatter.test.tsx`, `useIntersectionObserver.ts`, `useIntersectionObserver.test.tsx`, `useControllableState.ts`

**Interfaces:** no public signature changes.

- [ ] **Step 1: Verify fact 17 on Node 22.** Run: `npx --yes node@22.22.0 -e "process.env.TZ='Asia/Tokyo'; console.log(new Intl.DateTimeFormat().resolvedOptions().timeZone)"`
  - Expected output: `Asia/Tokyo`.
  - If it prints anything else, stop and report to the controller. F7's test would then need a different mechanism.

- [ ] **Step 2: F5 test.** In `useStorage.test.tsx`, next to the test at lines 216-227, add `'a clear() event purges this area's memory fallbacks and keeps the other area's'`. It follows that test's shape:
  1. Spy `Storage.prototype.setItem` to throw a quota error.
  2. Render a local probe for key `n` and a session probe for key `m`.
  3. Call `set(5)` on both, so each falls back to memory and renders `5`.
  4. Restore the spy.
  5. Dispatch `new StorageEvent('storage', { key: null, storageArea: localStorage })` inside `act`.
  6. Expect the local probe to read the default (memory purged; real storage holds nothing), and the session probe to still read `5`.

  - Perturbations:
    - delete the purge loop at `useStorage.ts:86` (the local assertion fails);
    - drop the `${kind}:` prefix check (the session assertion fails).

- [ ] **Step 3: F6, failing test.** In `useCopyToClipboard.test.tsx` (fake timers are already on), add two tests:
  - `'does not set state or start a timer when unmounted while writeText is pending'`:
    - stub `writeText` with a promise you resolve manually;
    - call `copy('x')` without awaiting it;
    - `unmount()`;
    - resolve the promise and `await` the copy promise;
    - expect it to resolve to `false`, and expect `vi.getTimerCount()` to be `0`.
  - `'… when unmounted while writeText is pending and then rejects'`: the same, rejecting instead, with the same assertions. This is Review Focus 5.

  Run it. Expected: the first test FAILS on `getTimerCount()` (`1`) and on the `true` return.

- [ ] **Step 4: F6 fix.** In `useCopyToClipboard.ts`:
  - Keep a `mounted` ref. Set it `true` in a `useEffect` and `false` in that effect's cleanup.
  - After the `await`, `if (!mounted.current) return false` before `setCopied(true)` and `timeout.start(…)`.
  - Add a JSDoc line: an unmounted caller gets `false`.
  - Run: PASS.
  - Perturbation: remove the guard (both new tests fail).

- [ ] **Step 5: F7 test.** In `useFormatter.test.tsx`, beside the hydration tests at lines 132-168, add `'the hydration pass ignores an explicit undefined timeZone even on a non-UTC host'`:
  1. Save `process.env.TZ`, set it to `'Asia/Tokyo'`, and restore it in `finally`.
  2. Render, through the existing `hydrate()` helper, a component that renders `formatDate(V, { timeZone: undefined })` (`V = Date.UTC(2026, 2, 5, 23, 30)`). Wrap it the way the existing hydration tests do, but in a provider given **no `timeZone`**, so the hook's own server-pass default (`'UTC'`) is what is under test.
  3. Expect the server HTML text `'Mar 5, 2026'` (UTC).
  4. Expect `hydrate()`'s `onRecoverableError` never to have been called.

  - Perturbation: in `useFormatter.ts`, replace `...defined(o)` with `...o` in `formatDate`. The server pass formats in Tokyo (`'Mar 6, 2026'`), so the text assertion fails.
  - Check that this perturbation is the **only** thing between the input and the failure. Revert, and confirm green.

- [ ] **Step 6: F9 failing test.** In `useIntersectionObserver.test.tsx`, add `'resets a stale entry when the observer is rebuilt'`:
  1. Render `<Probe threshold={0.5} />`.
  2. Inside `act`, call `instances[0]!.trigger([{ isIntersecting: true, intersectionRatio: 0.75 }])`, and expect `'true:0.75'`.
  3. `rerender(<Probe threshold={[0, 1]} />)`, and expect `data-r` to be `'none'`.

  Run. Expected: FAIL, with `'true:0.75'` still showing.

- [ ] **Step 7: F9 fix.**
  - In `useIntersectionObserver.ts`, change the effect cleanup to `return () => { observer.disconnect(); setEntry(undefined) }`.
  - Add to the JSDoc: a rebuilt observer starts again from `undefined`.
  - Run: PASS, and the existing six tests stay green.
  - Perturbation: remove the `setEntry` call (the new test fails).

- [ ] **Step 8: F12.** Append to `useControllableState`'s JSDoc (`useControllableState.ts:15-20`): `T` cannot be a function type. The setter treats any function as an updater (line 37), so a function-typed value would be called rather than stored. Wrap it in an object instead.

- [ ] **Step 9: Run** `npx vitest run --project unit packages/react/src/hooks`, the same command under Node 22.22.0, `npm run test:guards` and `npm run typecheck`. All pass. Apply and revert each perturbation above.

- [ ] **Step 10: Commit.**
  ```bash
  git add packages/react/src/hooks
  git commit -m "fix(hooks): copy-to-clipboard ignores a copy that settles after unmount; intersection entry resets on rebuild; pin storage clear and hydration timeZone"
  ```

---

### Task 3: Types and gate follow-ups (F1, F10, F11)

**Files:**
- Modify: `packages/react/src/notifications/types.ts`, `packages/react/src/notifications/NotificationProvider.tsx`, `packages/react/src/providers/ApProvider.tsx`, `packages/react/src/notifications/severity.ts`
- Create: `packages/react/src/notifications/types.test.tsx`
- Modify: `packages/react/src/gates/ssr-safety.gate.test.ts`
- Modify: `packages/react/src/hooks/useEventListener.ts`, `useEventListener.test.tsx`, `packages/react/src/hooks/useFormatter.ts`

**Interfaces:**
- Produces:
  ```ts
  type ApEventMap = WindowEventMap & DocumentEventMap & HTMLElementEventMap
  export function useEventListener<K extends string>(
    target: EventTarget | RefObject<EventTarget | null> | null | undefined,
    type: K,
    handler: (event: K extends keyof ApEventMap ? ApEventMap[K] : Event) => void,
    options?: AddEventListenerOptions | undefined,
  ): void
  ```

- [ ] **Step 1: F1, failing type test.** Create `notifications/types.test.tsx` (`// @vitest-environment jsdom`; `.tsx` because it holds element expressions), with a `describe('option types accept explicit undefined')` and one test that calls:
  - `toast({ title: 'x', description: undefined, severity: undefined, action: undefined, id: undefined, timeout: undefined })`;
  - the same for `banner`, `confirm`, `alert` and `announce`, with each of their optionals as listed in spec §6.3.4, F1 (`types.ts:13-62`);
  - a `<NotificationProvider placement={undefined}>` and an `<ApProvider notifications={{ placement: undefined }}>` element expression.

  It asserts only that the calls return (the runtime part). The real assertion is that `npm run typecheck` compiles the file; the `@ts-expect-error` precedent at `Select.test.tsx:48-58` explains this pattern.
  - Run `npm run typecheck`. Expected: FAIL, with TS2379 or TS2375 on each `undefined`.

- [ ] **Step 2: F1 fix.**
  - Change every optional in `types.ts`, `NotificationProvider.tsx:18` and `ApProvider.tsx:16` to `?: T | undefined`.
  - Then fix any internal site that now receives `undefined`. The known one is `severity.ts:47-51`, which passes `rest` to Base UI's `UpdateOptions`. Spread each key conditionally, as `toBaseToast` at `severity.ts:23-36` does.
  - Run `npm run typecheck` and `npx vitest run --project unit packages/react/src/notifications`. Both pass.
  - Perturbation: revert `description` in `ToastOptions` (typecheck fails on the test line).

- [ ] **Step 3: F10.** In `ssr-safety.gate.test.ts`:
  - Add `referencesDuringRender(hook, names)` beside `directCallsDuringRender` (lines 37-51). It walks the hook body, skips nested arrow functions and function expressions as the existing walker does, and records **every** `Identifier` whose text is in `names`.
  - Exclude only:
    - a property name in a `PropertyAccessExpression` (`x.readRaw`), which is not a reference to the binding;
    - an `import` specifier.
  - Replace the assertion at lines 298-304 to use it.
  - Add a self-test, `'the reference check flags aliases and indirect calls'`. Following the `ts.createSourceFile` pattern at `style-rules.gate.test.ts:348,358`, build four synthetic hooks and assert each is flagged:
    - `function useX() { const read = readRaw; return read('local', 'k') }`
    - `function useX() { return readRaw.call(null, 'local', 'k') }`
    - `function useX() { return (0, readRaw)('local', 'k') }`
    - `function useX() { return readRaw('local', 'k') }`
  - And one that must **not** be flagged: `function useX() { return useSyncExternalStore(s, () => readRaw('local', 'k')) }`, since it is inside a nested arrow.
  - Run `npm run test:guards`. Expected: PASS on the real source, plus the self-test.
  - Perturbation: change the walker back to call-only (the alias, `.call` and comma cases fail).

- [ ] **Step 4: F11, failing type tests.** In `useEventListener.test.tsx`, add a test whose body contains:
  ```ts
  useEventListener(window, 'keydown', (e) => e.key)            // compiles: KeyboardEvent
  useEventListener(document, 'visibilitychange', (e) => e.type) // compiles: Event
  useEventListener(window, 'my-custom', (e) => e.type)          // compiles: Event fallback
  // @ts-expect-error — a click is a MouseEvent, which has no `key`
  useEventListener(window, 'click', (e) => e.key)
  ```
  Call these inside a component rendered by the test, so the hook rules hold. Run `npm run typecheck`. Expected: FAIL. The first line errors, because `key` does not exist on `Event`, and the `@ts-expect-error` is unused.

- [ ] **Step 5: F11 implementation.**
  - Apply the signature from **Interfaces**. Internally, `useStableCallback(handler as (event: Event) => void)` is the one sanctioned cast. Comment it: the event map is a type-level narrowing of a DOM event the runtime cannot check.
  - In `useFormatter.ts`, remove the four casts:
    - (a) Retype `defined` as `function defined<O extends object>(options: O | undefined): Partial<O>`, built with a typed loop instead of `Object.fromEntries`, so no `as` is needed. `Partial<O>` is assignable wherever the options are optional.
    - (b) `formatDuration`: widen the bound defaults' type so `{ ...L, ...defined(o) }` satisfies `DurationOptions` without `as`. If that needs `DurationOptions`' own optionals as `?: T | undefined`, change them there.
    - (c) `formatName` and `formatAddress`: retype the `Formatter` interface's parameter for each to match the formatter's own (`PersonName | null | undefined`, `PostalAddress | null | undefined`), so no cast is needed.
  - If any of (a)–(c) cannot be done without a cast, stop and report to the controller with the compiler error. Do not substitute a different cast.
  - Run `npm run typecheck`, `npx vitest run --project unit packages/react/src/hooks`, and `npm run test:guards`. All pass.
  - Perturbation: revert the handler type to `(event: Event) => void` (the `@ts-expect-error` line fails as unused).

- [ ] **Step 6: Commit.**
  ```bash
  git add packages/react/src
  git commit -m "fix(types): notification options accept explicit undefined; event-typed useEventListener; no casts in useFormatter; SSR gate catches aliased storage reads"
  ```

---

### Task 4: Storybook preparation — the Tooltip flake and a themed canvas

**Files:**
- Modify: `packages/react/src/components/Tooltip/Tooltip.stories.tsx:187-212`
- Create: `storybook/.storybook/preview.css`
- Modify: `storybook/.storybook/preview.tsx`

- [ ] **Step 1: The flake.** In `TwoOpen`'s play, replace the sleep at line 207 and the two assertions after it with:
  ```ts
  // Poll rather than sleep: the first tooltip's close is animated, and a fixed
  // wait failed once on CI (PR #7) when the runner was slow.
  await waitFor(() => expect(body().queryAllByRole('tooltip')).toHaveLength(1), { timeout: 3000 })
  await expect(body().getByRole('tooltip')).toHaveTextContent('Second tip')
  ```
  `waitFor` is already imported (line 2).
  - Perturbation: give the first `Tooltip` `open` so it never closes. The story must fail within 3 s.

- [ ] **Step 2: The canvas.** Create `preview.css`:
  ```css
  /*
   * theme.css themes components, not the page, so without this a dark-scheme
   * story renders dark components on a white page. Gate 9's dark baselines and
   * gate 5's axe contrast checks both need the real canvas behind the story.
   */
  body {
    background: var(--ap-color-bg-canvas);
    color: var(--ap-color-text-primary);
  }
  ```
  Import it in `preview.tsx` after the three `@ap/react` CSS imports.

- [ ] **Step 3: Run** `npm run test:stories` (gates 4 and 5, every story). Then `npm --prefix storybook run build`.
  - Both pass.
  - Run `test:stories` three times. `TwoOpen` must pass all three.
  - If axe reports a new contrast violation against the canvas, stop and report it. That is a real finding about the component, not about the canvas.

- [ ] **Step 4: Commit.**
  ```bash
  git add packages/react/src/components/Tooltip/Tooltip.stories.tsx storybook/.storybook
  git commit -m "test(stories): poll instead of sleep in Tooltip TwoOpen; paint the themed canvas behind every story"
  ```

---

### Task 5: RTL survives a consumer's production build

**Files:**
- Modify: `packages/vite/src/index.ts`, `packages/vite/src/index.test.ts`
- Modify: `storybook/.storybook/main.ts`
- Modify: `packages/react/src/gates/ssr-render.gate.test.ts`
- Modify: `docs/CONTRIBUTING.md`

**Interfaces:**
- Produces, from `@ap/vite`:
  ```ts
  /** The CSS browser floor `:dir()` needs; lower targets make lightningcss rewrite it to `:lang()`. */
  export const AP_CSS_TARGET: readonly string[] = ['chrome120', 'edge120', 'firefox114', 'safari16.4', 'ios16.4']
  ```
  The `ap-components:config` plugin's `config` hook becomes `config(user: UserConfig)`.

- [ ] **Step 1: Failing gate 6 assertion.** In `ssr-render.gate.test.ts`, add `'serves RTL rules as :dir(rtl), not lowered to :lang()'`:
  - Fetch `/disclosure` and `/notifications`, collect their stylesheet hrefs, and fetch the CSS, as the test at lines 216-240 does.
  - Assert `css` matches `/:dir\(rtl\)/`, and that `css` does not contain `':lang(ae)'`.

  Run `npm run test:ssr`. Expected: FAIL. No `:dir(rtl)`; `:lang(ae)` is present (fact 12).

- [ ] **Step 2: Failing unit tests.** In `packages/vite/src/index.test.ts`:
  - Update `presetConfig()` to call `cfgPlugin.config({})`.
  - Add three tests:
    - `'sets build.cssTarget to AP_CSS_TARGET when the consumer has not'`: `config({})` returns `build.cssTarget` equal to `[...AP_CSS_TARGET]`.
    - `'leaves a consumer cssTarget alone'`: `config({ build: { cssTarget: 'chrome100' } })` returns no `build.cssTarget`. That is Review Focus 1, part 1.
    - `'warns once when emitted CSS still has :dir() lowered'`. Find the `ap-components:rtl-check` plugin and call its `generateBundle` with a fake `this` that has a `warn` spy. Pass a bundle holding two CSS assets whose `source` contains `':is(:lang(ae),:lang(ar))'`. Expect exactly one `warn` call, whose message contains `':dir()'` and `'AP_CSS_TARGET'`. A bundle without the pattern produces no call. That is Review Focus 1, part 2.

  Run `npx vitest run --project unit packages/vite`. Expected: FAIL.

- [ ] **Step 3: Implement.** In `packages/vite/src/index.ts`:
  - Export `AP_CSS_TARGET`.
  - The config hook returns its existing keys plus `...(user.build?.cssTarget === undefined ? { build: { cssTarget: [...AP_CSS_TARGET] } } : {})`.
  - Add a third plugin, `{ name: 'ap-components:rtl-check', enforce: 'post', apply: 'build', generateBundle(_, bundle) { … } }`. It scans assets whose `fileName` ends with `.css` for `:lang(ae)`, and calls `this.warn(…)` at most once per build. The message reads: `@ap/vite: a :dir() rule was lowered to :lang(), so RTL styling will follow the page language instead of direction. Set build.cssTarget to AP_CSS_TARGET (exported from @ap/vite) or newer.`
  - Write the JSDoc on `AP_CSS_TARGET` and the hook to say *why*, citing Vite's lightningcss minify and its chrome111 default.
  - Run Step 2's command. Expected: PASS.
  - Then rebuild and run gate 6: `npm run test:ssr`. Expected: PASS. Gate 6 builds the fixture through `@ap/vite`.

- [ ] **Step 4: Storybook.** In `storybook/.storybook/main.ts`'s `viteFinal`, add `build: { cssTarget: [...AP_CSS_TARGET] }` to the merged config, importing `AP_CSS_TARGET` from `@ap/vite`.
  - Comment it: Storybook uses vanilla-extract directly, not `@ap/vite`, so it must set the same floor. Otherwise the production Storybook lowers `:dir()` and the RTL stories fail.
  - Confirm `@ap/vite` resolves from `storybook/`. It is a root workspace package, so this should work. If it does not, stop and report.
  - Rebuild with `npm --prefix storybook run build`, then `grep -l "dir(rtl)" storybook/storybook-static/assets/*.css`. Expected: at least the Tabs and Toast CSS files.

- [ ] **Step 5: Docs.** In `docs/CONTRIBUTING.md`, add a section `## The CSS browser floor (Chrome 120)` beside `## Known caveats` (around line 1195). It covers:
  - why `:dir()` sets the floor;
  - what `@ap/vite` does, and what happens when a consumer overrides `cssTarget`;
  - that the 5e `:dir()` caveat is now a stated requirement, not an open question.

- [ ] **Step 6: Perturbation and run.**
  - Delete the `cssTarget` spread. `test:ssr`'s new test fails and two unit tests fail. Revert.
  - Run `npm run typecheck`, `npx vitest run --project unit packages/vite`, `npm run test:ssr`, `npm run test:consumer` and `npm run test:stories`. All pass.

- [ ] **Step 7: Commit.**
  ```bash
  git add packages/vite storybook/.storybook/main.ts packages/react/src/gates/ssr-render.gate.test.ts docs/CONTRIBUTING.md
  git commit -m "fix(vite): default build.cssTarget to the :dir() floor so RTL survives production CSS minify; warn when it is lowered"
  ```

---

### Task 6: Select `Default` in the production build — root cause first

**Files:** decided by the root cause. Candidates are `packages/react/src/components/Select/Select.tsx`, `Select.stories.tsx`, and a new test.

**This task is a debugging task.** Use `superpowers:systematic-debugging`. **Do not change code until Step 3's finding has been reported to the controller and the controller has ruled.**

- [ ] **Step 1: Reproduce.**
  1. Rebuild the production Storybook: `npm --prefix storybook run build`.
  2. Serve it with `npx vite preview --outDir storybook-static --port 6007 --strictPort`, run from `storybook/`.
  3. Run the spike harness in the session scratchpad: `gate9/shots2.cjs`. Read it first, and limit it to `components-select--default` through its id-regex argument. Alternatively, open `http://localhost:6007/iframe.html?id=components-select--default&viewMode=story` in Playwright's chromium (`npx playwright open`).

  Expected: the play fails in step 2. After the second ArrowDown, the highlight stays on Canada.
  - Record the exact failure text.
  - Confirm it passes under `npm run test:stories -- -t "Default"`, which runs in dev mode.

- [ ] **Step 2: Narrow it down.** Find the smallest difference between the passing run and the failing one:
  - **Production versus development React or Base UI.** Build Storybook with `NODE_ENV=development`. Does it pass?
  - **Static build versus Vite dev.** Check whether the module identity of `Field` and Select's context differs, given the alias comment at `main.ts:36-61`.
  - **Timing.** Does a manual second ArrowDown, sent a second later, move the highlight?
  - **Real input versus `userEvent`.** In a hand-driven Playwright session, does pressing ArrowDown twice on the real built page move the highlight?

  Log each hypothesis and its result.

- [ ] **Step 3: Report to the controller.** The report states which of these it is:
  - **(A) A product bug:** a real user, pressing ArrowDown twice in a production build, does not move the highlight.
  - **(B) A play artifact:** real keyboard input works, and only the play's timing or setup differs.
  - **(C) Something else**, with evidence.

  The controller rules on the fix.
  - For **(A)**: fix it in `Select.tsx` or its wiring, and add a unit or story test that fails for the root cause. Gate 9's play-error check (Task 9) is the production-build regression net: the story must pass in the production build.
  - For **(B)**: change the play so it waits on the state it asserts. For example, `await waitFor(() => expect(canada).toHaveAttribute('data-highlighted'))` before the second ArrowDown, and **no sleeps**. The play must keep testing the same keyboard behaviour.

- [ ] **Step 4: Verify.** Rebuild Storybook and re-run Step 1's reproduction three times. All three must pass. Then run `npm run test:stories` and `npx vitest run --project unit packages/react/src/components/Select`. Both pass.

- [ ] **Step 5: Commit.** The message depends on the ruling:
  - (A): `fix(select): <root cause>`
  - (B): `test(select): Default play waits for <state> before the second ArrowDown`

  The body names the root cause in one sentence.

---

### Task 7: The streamed route covers every stateful component, and hydration watches recoverable errors

**Files:**
- Create: `fixtures/ssr-app/app/entry.client.tsx`
- Modify: `fixtures/ssr-app/app/routes/streamed.tsx`, `fixtures/ssr-app/e2e/hydration.spec.ts`, `packages/react/src/gates/ssr-render.gate.test.ts`

- [ ] **Step 1: The client entry.** Create `entry.client.tsx`. Base it on React Router's default (`node_modules/@react-router/dev/dist/config/defaults/entry.client.tsx`) and keep it identical except for the options:
  ```tsx
  import { startTransition, StrictMode } from 'react'
  import { hydrateRoot } from 'react-dom/client'
  import { HydratedRouter } from 'react-router/dom'

  // React 19 reports a hydration mismatch it recovered from through
  // onRecoverableError, not necessarily through the console (5g found this).
  // Recording it on window gives hydration.spec.ts something it can assert
  // is empty, rather than inferring a clean hydration from console silence.
  declare global {
    interface Window {
      __apRecoverableErrors: string[]
    }
  }
  window.__apRecoverableErrors = []

  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <HydratedRouter />
      </StrictMode>,
      {
        onRecoverableError(error) {
          window.__apRecoverableErrors.push(String((error as Error)?.message ?? error))
          console.error(error)
        },
      },
    )
  })
  ```
  Copy the imports exactly as the default's own file has them. If they differ from the above, the default wins.

- [ ] **Step 2: Assert it in every hydration test.** In `hydration.spec.ts`:
  - Add a helper:
    ```ts
    const recoverableErrors = (page: Page) => page.evaluate(() => window.__apRecoverableErrors)
    ```
  - In **every** test, after `waitForHydration`, add `expect(await recoverableErrors(page), 'onRecoverableError fired').toEqual([])`.
  - Update the header comment (lines 3-13) to say this is now the primary enforcement, and the console check is the secondary net.
  - Run `npm run test:hydration`. Expected: PASS.
  - Perturbation: add `<p>{String(Date.now())}</p>` to `home.tsx`. The new assertion in the home test fails with a non-empty array. Revert.

- [ ] **Step 3: Grow the streamed route.** *(Write Step 4's assertions first and watch them fail, then do this step. The two are numbered in the order they read best.)*
  - In `streamed.tsx`, wrap the `<Suspense>` in `<LocaleProvider>`, imported from `@ap/react`, as `form.tsx:67` does. Explain in a comment why it sits **outside** the boundary, referring to the existing comment at lines 27-36.
  - Inside the `<Await>` render, after the existing `Field`, add the following, each with props mirroring `form.tsx` and `disclosure.tsx` but with `streamed-` names and ids:

    | Component | Props |
    |---|---|
    | `Textarea` | `name="streamed-message"` and `defaultValue="streamed message"`, inside `<Field label="Streamed message">` |
    | `Checkbox` | `name="streamed-subscribe"`, `value="yes"`, `label="Streamed subscribe"`, `defaultChecked` |
    | `Switch` | `name="streamed-alerts"`, `value="on"`, `label="Streamed alerts"`, `defaultChecked` |
    | `RadioGroup` | `label="Streamed contact"`, `name="streamed-contact"`, `defaultValue="sms"`, `options={[{ value: 'email', label: 'Streamed email' }, { value: 'sms', label: 'Streamed text' }]}` |
    | `Select` | `name="streamed-country"`, `defaultValue="fr"`, with `options` ca/Canada, fr/France, de/Germany; inside `<Field label="Streamed country">` |
    | `Tabs` | `aria-label="Streamed sections"` and `items` `one`/`Streamed one`/`<p id="streamed-tab-one">first</p>` and `two`/`Streamed two`/`<p id="streamed-tab-two">second</p>` |
    | `Accordion` | `defaultValue={['a']}` and `items` `a`/`Streamed A`/`<p id="streamed-acc-a">open</p>` and `b`/`Streamed B`/`<p id="streamed-acc-b">closed</p>` |

- [ ] **Step 4: Failing gate 6 assertions.**
  - Extend the streamed test at `ssr-render.gate.test.ts:205-214`. Let `late = html.slice(html.indexOf('loading…'))`. Every assertion below runs on `late`, which proves the markup arrived in the streamed chunk:
    - the `<textarea …name="streamed-message"…>` content is `streamed message`, matched with the regex shape used for Textarea in the form test;
    - the `<input>` tags named `streamed-subscribe`, `streamed-alerts`, and `streamed-contact` with `value="sms"` each match `/\bchecked=/`, scoped by tag as in the form test (comment at lines 297-302);
    - the `streamed-contact` input with `value="email"` does **not** match `/\bchecked=/`;
    - the button labelled by the `Streamed country` label contains `France`, and a hidden input `name="streamed-country"` has `value="fr"`, using the same lookup as lines 331-339; `late` does not contain `role="listbox"`;
    - `late` contains `id="streamed-tab-one"` and not `id="streamed-tab-two"`; and it contains `aria-selected="true"`. **Verify that string first:** render `<Tabs …/>` with `renderToString` in a scratch node script, and pin what Base UI 1.7.0 actually emits (`TabsTab.js:180`);
    - `late` contains `id="streamed-acc-a"`, and the panel tag around `streamed-acc-b` matches `/\shidden(=""|\s|>)/`. Reuse `panelTagAround` from `e2e/disclosure.spec.ts` by copying it, since gate 6 cannot import from the fixture.
  - Before Step 3 is in place, run `npm run test:ssr`. Expected: FAIL, because none of the `streamed-` markup exists yet.

- [ ] **Step 5: Run** `npm --prefix fixtures/ssr-app run typecheck`, `npm run test:ssr`, `npm run test:spa` and `npm run test:hydration`. All pass. Apply and revert the perturbations:
  - remove `defaultChecked` from the streamed `Checkbox` (its assertion fails);
  - set Select's `defaultValue="de"` (the `France` assertion fails).

- [ ] **Step 6: Commit.**
  ```bash
  git add fixtures/ssr-app packages/react/src/gates/ssr-render.gate.test.ts
  git commit -m "test(ssr): stream every stateful component; hydration asserts onRecoverableError never fires"
  ```

---

### Task 8: Gate 10 — bundle budget (`npm run size`)

**Files:**
- Create: `scripts/size/measure.ts`, `scripts/size/budget.ts`, `scripts/size/budget.test.ts`, `scripts/size.ts`, `packages/react/size-budget.json`
- Modify: root `package.json` (the `size` script), `vitest.config.ts` (unit include), `.github/workflows/ci.yml`, `docs/CONTRIBUTING.md`

**Interfaces:**
- Produces, from `scripts/size/budget.ts`. It is pure, with no I/O:
  ```ts
  export interface Measured { js: number; css: number }               // brotli bytes
  export type Budgets = Record<string, Measured>
  export interface Row {
    check: string; js: number; css: number
    budget: Measured | undefined
    jsRatio: number | undefined; cssRatio: number | undefined        // vs index; undefined for non-import checks
    problems: string[]                                               // empty = ok
  }
  export const JS_RATIO_LIMIT = 0.7
  export const CSS_RATIO_LIMIT = 0.5
  export function evaluate(measured: Record<string, Measured>, budgets: Budgets): Row[]
  export function renderTable(rows: Row[]): string                    // markdown
  export function seedBudgets(measured: Record<string, Measured>): Budgets // +10%, ceil to next 100
  ```
- Produces, from `scripts/size/measure.ts`:
  ```ts
  export const COMPONENT_EXPORTS: Record<string, string> // dir -> export; only { Banner: 'BannerRegion' } differs
  export function checks(componentDirs: string[]): Record<string, string> // check name -> entry source
  export async function measure(entry: string): Promise<Measured>
  ```

- [ ] **Step 1: Include scripts in the unit project.** Add `'scripts/**/*.test.ts'` to the unit project's `include` (`vitest.config.ts:17`). Comment it: gate 10's pure logic lives beside its script.

- [ ] **Step 2: Failing tests for `budget.ts`.** In `scripts/size/budget.test.ts` (node environment), let `index = { js: 1000, css: 100 }`.

  | Case | Input | Expected |
  |---|---|---|
  | within budget and ratios | `import:A = { js: 300, css: 20 }`, budget `{ js: 400, css: 30 }` | `problems: []`, `jsRatio: 0.3`, `cssRatio: 0.2` |
  | JS over budget | `import:A = { js: 401, css: 20 }`, budget `{ js: 400, css: 30 }` | one problem containing `'js 401 > budget 400'` |
  | CSS over budget by 1 byte | `css: 31` vs `30` | one problem containing `'css 31 > budget 30'` |
  | missing budget (Review Focus 3) | `import:New` measured, no entry | one problem containing `'no budget for import:New'` |
  | JS ratio breach | `import:A = { js: 701, … }`, generous budget | a problem containing `'js 70.1% of index > 70%'` |
  | JS ratio at the limit | `js: 700` | no ratio problem (≤ is allowed) |
  | CSS ratio breach | `css: 51` | a problem containing `'css 51.0% of index > 50%'` |
  | ratios apply only to `import:` checks | `hooks = { js: 900, css: 0 }` | `jsRatio: undefined`, no ratio problem |
  | index has no CSS | `index.css = 0`, `import:A.css = 0` | no CSS ratio problem, no division by zero |
  | `seedBudgets` | `{ a: { js: 4555, css: 459 } }` | `{ a: { js: 5100, css: 600 } }` (`4555 × 1.1 = 5010.5`, up to 5100; `459 × 1.1 = 504.9`, up to 600) |
  | `renderTable` | one ok row and one failing row | a markdown table with header `\| check \| js \| css \| budget js \| budget css \| js/index \| css/index \| status \|`, statuses `ok` and `FAIL: <problems joined by '; '>` |

  Run `npx vitest run --project unit scripts/size`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement `budget.ts`.** Make Step 2 pass. Format ratios as `(r * 100).toFixed(1) + '%'`.

- [ ] **Step 4: Implement `measure.ts`.** Port the spike's mechanism (facts 1–3):
  - `vite.build({ configFile: false, root: <repo root>, logLevel: 'silent', plugins: [apComponents(), sizeEntryPlugin(code)], build: { write: false, minify: true, cssCodeSplit: false, lib: { entry: 'virtual:size-entry', formats: ['es'], fileName: 'entry' }, rollupOptions: { external: [/^react($|\/)/, /^react-dom($|\/)/, /^libphonenumber-js($|\/)/], output: { minify: true, comments: false } } } })`.
  - `sizeEntryPlugin` resolves any id whose slash-normalised form ends with `virtual:size-entry` to `'\0virtual:size-entry.js'`, and loads `code` for it.
  - Normalise the result with `Array.isArray`. Sum brotli sizes (`BROTLI_PARAM_QUALITY: 11`, `BROTLI_PARAM_MODE: BROTLI_MODE_GENERIC`) of the `.js` outputs and the `.css` outputs separately.
  - **Comment the `output` override with fact 2.** It is the line a future reader will be tempted to delete.
  - `checks(dirs)` returns `index`, `hooks`, `format` and `format/phone`, plus `import:<Dir>` → `export { ${COMPONENT_EXPORTS[dir] ?? dir} } from '@ap/react'`.
  - Before measuring, the script imports nothing from `@ap/react`. Instead, it reads `packages/react/src/index.ts` and its re-export targets as text. It **fails** if `import:<Dir>`'s export name is not exported from the index, naming the directory. Do this with the TypeScript compiler API: `ts.createProgram` on `src/index.ts`, then `checker.getExportsOfModule`.

- [ ] **Step 5: Implement `scripts/size.ts`.** It:
  - lists `packages/react/src/components/*` directories;
  - measures each check in sequence;
  - reads `packages/react/size-budget.json`;
  - calls `evaluate`;
  - writes `renderTable` to `reports/size.md`;
  - appends it to `process.env.GITHUB_STEP_SUMMARY` when that is set;
  - prints it, and exits `1` if any row has problems.
  - `--seed` writes `seedBudgets(measured)` to the budget file, sorted by key, and exits `0`.

  Add `"size": "tsx scripts/size.ts"` to root `package.json`.

- [ ] **Step 6: Seed and check the numbers.**
  - Run `npm run size -- --seed`, then `npm run size`.
  - Compare against fact 3. Expect each JS and CSS figure within ±2% of the spike's. A larger gap means the build differs from the measured mechanism: stop and report.
  - Commit the seeded `size-budget.json`. Note in the commit body that it is the first seeding.

- [ ] **Step 7: Perturbations.**
  - Set `"sideEffects": true` in `packages/react/package.json`. `npm run size` exits 1, with every `import:` row breaching both ratios. Revert.
  - Lower `import:Button.js` in the budget by 1 byte from its measured value. Breach. Revert.
  - Delete the `import:Button` entry. `'no budget for import:Button'`. Revert.
  - Rename `COMPONENT_EXPORTS.Banner` to `'Banner'`. The script fails, naming the `Banner` directory. Revert.

- [ ] **Step 8: CI.** Add a `size` job to `ci.yml`, after `storybook`:
  ```yaml
  size:
    name: Bundle budget (gate 10, advisory)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - name: Measure every entry against its budget
        # Advisory (ADR-0014: "warns on regression"). Making it blocking is
        # deleting this line.
        continue-on-error: true
        run: npm run size
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: size-report
          path: reports/size.md
  ```

- [ ] **Step 9: Docs.** In `docs/CONTRIBUTING.md`:
  - add `npm run size` to the `## Everyday commands` table (line 15);
  - extend `## Hooks and formatters`' mention of gate 10 (line 469);
  - add a `### Gate 10 — bundle budget` subsection covering what is measured, the two ratio limits and why (fact 4), how to re-seed, and that a new component needs a budget entry.

- [ ] **Step 10: Run** `npx vitest run --project unit scripts/size`, `npm run size` (exit 0), `npm run typecheck`, then commit.
  ```bash
  git add scripts/size scripts/size.ts packages/react/size-budget.json package.json vitest.config.ts .github/workflows/ci.yml docs/CONTRIBUTING.md
  git commit -m "feat(gates): gate 10 bundle budget, per-entry brotli JS and CSS with tree-shaking ratio checks"
  ```

---

### Task 9: Gate 9 — visual regression (`npm run test:visual`)

**Files:**
- Modify: `storybook/package.json` (adds `@playwright/test` `^1.62.1` and the `test:visual` script), root `package-lock.json`, root `package.json` (`"test:visual": "npm --prefix storybook run test:visual"`)
- Create: `storybook/visual/playwright.config.ts`, `storybook/visual/stories.spec.ts`, `storybook/visual/summary.ts`
- Modify: `packages/react/src/components/Select/Select.stories.tsx` (one opt-out), `.github/workflows/ci.yml`, `docs/CONTRIBUTING.md`, `.gitignore` (if needed)
- Create: `.github/workflows/visual-baselines.yml`

- [ ] **Step 1: Dependency.**
  - Run `npm install --save-dev @playwright/test@^1.62.1 -w storybook`.
  - `git diff package-lock.json` must show only `@playwright/test`, plus the `storybook` workspace entry, at 1.62.1. No other version moves. If others move, revert and report.
  - Run `npm run check:lockfiles`. Expected: PASS.
  - Add `"test:visual": "playwright test -c visual/playwright.config.ts"` to `storybook/package.json`.

- [ ] **Step 2: `playwright.config.ts`.**
  ```ts
  import { defineConfig } from '@playwright/test'

  // Gate 9 (spec §6.2, §6.3.2). Advisory; baselines are Linux-only and made only by
  // .github/workflows/visual-baselines.yml.
  const shared = {
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 1,
    // Not 'reduce': the plays are gate 4's tests and are written for full motion
    // (spec §6.3.2). `animations: 'disabled'` on the screenshot freezes the frame.
    reducedMotion: 'no-preference' as const,
  }

  export default defineConfig({
    testDir: '.',
    snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
    fullyParallel: true,
    reporter: [['list'], ['json', { outputFile: '../test-results/visual.json' }]],
    use: {
      // vite preview binds IPv6 only; 127.0.0.1 would not connect.
      baseURL: 'http://localhost:6007',
    },
    webServer: {
      command: 'npx vite preview --outDir storybook-static --port 6007 --strictPort',
      cwd: '..',
      url: 'http://localhost:6007/index.json',
      reuseExistingServer: !process.env.CI,
    },
    projects: [
      { name: 'light', use: { ...shared, colorScheme: 'light' } },
      { name: 'dark', use: { ...shared, colorScheme: 'dark' } },
    ],
  })
  ```
  - `cwd: '..'` is relative to the config file, which makes it `storybook/`. Verify that.
  - The JSON reporter path is under the gitignored `test-results/`.

- [ ] **Step 3: `stories.spec.ts`.**
  ```ts
  import { readFileSync } from 'node:fs'
  import { join } from 'node:path'
  import { expect, test } from '@playwright/test'

  interface IndexEntry { id: string; type: 'story' | 'docs'; parameters?: { visual?: { skip?: string } } }
  const index = JSON.parse(
    readFileSync(join(import.meta.dirname, '..', 'storybook-static', 'index.json'), 'utf8'),
  ) as { entries: Record<string, IndexEntry> }
  const stories = Object.values(index.entries).filter((e) => e.type === 'story')

  test('the static build has stories', () => {
    // Otherwise every generated test below vanishes and an empty build reports clean.
    expect(stories.length).toBeGreaterThan(0)
  })

  for (const story of stories) {
    test(story.id, async ({ page }) => {
      test.skip(process.platform !== 'linux', 'Baselines are Linux-only (spec §6.2)')
      await page.addInitScript(() => {
        // Spec §6.3.2: a throwing play still ends at phase 'finished', so the phase
        // alone cannot reveal it. Trap the channel's assignment and record errors.
        const w = window as unknown as { __gate9Errors: string[]; __STORYBOOK_ADDONS_CHANNEL__: unknown }
        w.__gate9Errors = []
        let channel: { on(event: string, fn: (a: any) => void): void } | undefined
        Object.defineProperty(window, '__STORYBOOK_ADDONS_CHANNEL__', {
          configurable: true,
          enumerable: true,
          get: () => channel,
          set(value) {
            channel = value
            for (const event of ['playFunctionThrewException', 'storyErrored', 'storyThrewException']) {
              value.on(event, (a: any) => w.__gate9Errors.push(`${event}: ${String(a?.message ?? JSON.stringify(a))}`))
            }
            value.on('storyRenderPhaseChanged', (a: any) => {
              if (a?.newPhase === 'errored') w.__gate9Errors.push('phase errored')
            })
          },
        })
      })
      await page.goto(`/iframe.html?id=${story.id}&viewMode=story`)
      await page.waitForFunction(
        () => (window as any).__STORYBOOK_PREVIEW__?.currentRender?.phase === 'finished',
        undefined,
        { timeout: 15_000 },
      )
      const errors = await page.evaluate(() => (window as any).__gate9Errors as string[])
      expect(errors, 'the story threw before its screenshot').toEqual([])
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(`${story.id}.png`, {
        animations: 'disabled',
        caret: 'hide',
        // Observed run-to-run noise is at most 5 px (spec §6.3.2).
        maxDiffPixels: 10,
      })
    })
  }
  ```
  - **The opt-out.** Check whether Storybook 10.6's `index.json` carries story `parameters`. It probably does not.
    - If it does not, read opt-outs from a typed constant instead: `const SKIP: Record<string, string> = { 'components-select--native-label-warning': '…' }` in `stories.spec.ts`, applied with `test.skip(story.id in SKIP, SKIP[story.id])`.
    - Leave a comment explaining why the parameter route was not used.
    - The skip **reason** is required by the type. Report which route was taken.
  - **The one opt-out:** `components-select--native-label-warning`, with the reason `'asserts a development-only console warning that a production build strips'`.

- [ ] **Step 4: Run locally (Windows).**
  - Run `npm --prefix storybook run build`, then `npm run test:visual`.
  - Expected: `the static build has stories` passes, and all 252 story tests are **skipped**, with the Linux-only reason. Not one fails.
  - Then run the suite under the Docker image (Step 8's command) **only if Docker is available**. If it is, expect every test to fail with "missing baseline" and to write actuals. Delete the generated `__screenshots__` afterwards, because baselines come only from the workflow.

- [ ] **Step 5: The baselines workflow.** Create `.github/workflows/visual-baselines.yml`:
  ```yaml
  name: Visual baselines

  # Gate 9 baselines are Linux-only (spec §6.2): Windows rasterises type differently,
  # so they are made here and committed, never on a dev machine.
  on:
    workflow_dispatch:
      inputs:
        branch:
          description: Branch to generate baselines for and commit to
          required: true

  permissions:
    contents: write

  jobs:
    baselines:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
          with:
            ref: ${{ inputs.branch }}
        - uses: actions/setup-node@v4
          with:
            node-version: '22.22.0'
            cache: npm
        - run: npm ci
        - run: npx playwright install --with-deps chromium
        - run: npm --prefix storybook run build
        - run: npm run test:visual -- --update-snapshots
        - name: Commit baselines
          run: |
            git config user.name 'github-actions[bot]'
            git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
            git add storybook/visual/__screenshots__
            if git diff --cached --quiet; then echo 'Baselines unchanged.'; exit 0; fi
            git commit -m "chore(visual): regenerate gate 9 baselines"
            git push
  ```
  The `node-version` must equal `ci.yml`'s `NODE_VERSION`. Say so in a comment.

- [ ] **Step 6: `summary.ts` and the CI steps.**
  - `summary.ts` (run with `tsx`) reads `test-results/visual.json` and writes these counts to `$GITHUB_STEP_SUMMARY`:
    - **passed**;
    - **diffs**: failures whose error message mentions a screenshot comparison;
    - **missing baselines**: failures whose message contains `"A snapshot doesn't exist"` (Review Focus 2);
    - **play errors**: failures from the `__gate9Errors` assertion;
    - **skipped**, with each reason.
  - When every story failure is a missing baseline, print: `No baselines on this branch — run the "Visual baselines" workflow with branch=<head ref>.`
  - `summary.ts` resolves the report path from its own location: `join(import.meta.dirname, '..', 'test-results', 'visual.json')`. That matches the reporter's `outputFile`, which is relative to the config. So the script works from any cwd.
  - `summary.ts` exports a pure `summarise(report): { passed: number; diffs: number; missing: number; playErrors: number; skipped: Array<{ id: string; reason: string }>; text: string }` and runs only when invoked directly.
  - Its tests live in `scripts/visual-summary.test.ts`, because the unit project includes `scripts/**` (Task 8, Step 1) but not `storybook/`. They import from `../storybook/visual/summary.js` and are written **before** `summary.ts`. Cases:
    - a hand-built report with one pass, one diff, one missing baseline, one play error and one skip yields counts `1/1/1/1/1`, with the skip's reason;
    - an all-missing report's `text` contains `run the "Visual baselines" workflow`;
    - perturbation: match "missing" on a wrong string, and the first case fails.
  - In `ci.yml`'s `storybook` job, after "Build the static Storybook", add:
    ```yaml
    - name: Visual regression (gate 9, advisory)
      if: github.event_name == 'pull_request'
      # Advisory (ADR-0014). Baselines are committed by the Visual baselines workflow.
      continue-on-error: true
      run: npm run test:visual
    - name: Summarise gate 9
      if: always() && github.event_name == 'pull_request'
      run: npx tsx storybook/visual/summary.ts
    - uses: actions/upload-artifact@v4
      if: always() && github.event_name == 'pull_request'
      with:
        name: visual-diffs
        path: storybook/test-results/
        if-no-files-found: ignore
    ```
  - Check where Playwright writes `test-results/` for this config (relative to the config file) and point `path` at it.

- [ ] **Step 7: Typecheck.** Make sure `npm --prefix storybook run typecheck` covers `visual/`. Add it to `storybook/tsconfig.json`'s `include` if it is missing. Then run it. Expected: PASS.

- [ ] **Step 8: Docs.** Add `### Gate 9 — visual regression` to `docs/CONTRIBUTING.md`, beside the gate 10 section. It covers:
  - what runs, when, and why it is advisory;
  - why the shots are post-`play`, why not reduced motion, and why the canvas is themed;
  - how to add an opt-out (the reason is required);
  - **how to regenerate baselines**: run the workflow, with `gh workflow run visual-baselines.yml -f branch=<branch>`;
  - the optional Docker path:
    ```bash
    docker run --rm -v "$PWD":/w -w /w mcr.microsoft.com/playwright:v1.62.1-noble \
      bash -c "npm ci && npm --prefix storybook run build && npm run test:visual -- --update-snapshots"
    ```
    It is a convenience: CI's workflow is the source of truth.
  - Add `npm run test:visual` to the `## Everyday commands` table.

- [ ] **Step 9: Commit.**
  ```bash
  git add storybook package.json package-lock.json scripts/visual-summary.test.ts .github/workflows docs/CONTRIBUTING.md
  git commit -m "feat(gates): gate 9 visual regression over the static Storybook, Linux baselines via workflow_dispatch"
  ```

---

### Task 10: Whole-branch review, the all-ten sweep, the PR, and closing Phase 5

- [ ] **Step 1: Whole-branch review.**
  - Dispatch one reviewer over `main..HEAD`, using `superpowers:requesting-code-review`, with this plan and spec §6.3 as the brief.
  - Fix everything Important in one wave. The controller rules on each minor at the time it is logged.
  - Re-run the affected tasks' commands.

- [ ] **Step 2: The local sweep.** Run each `ci.yml` job's commands and record the counts:
  - `npm run typecheck`, `npm test`, the unit run under Node 22.22.0, `npm run test:gates`, `npm run check:lockfiles`, `npm run report:contrast`;
  - the `gen:*` freshness commands, with `git status` clean afterwards;
  - consumer: `npm --prefix fixtures/consumer install`, the consumer typecheck, `npm run test:consumer`;
  - SSR: `npm run test:ssr`, `npm run test:spa`, `npm run test:hydration`;
  - Storybook: `npm --prefix storybook run typecheck`, `npm run test:stories`, `npm --prefix storybook run build`, `npm run test:visual` (all story tests skipped on Windows);
  - showcase: `npm run showcase:install`, `npm --prefix showcase run typecheck`, `npm run showcase:test`;
  - `npm run size` (exit 0).

- [ ] **Step 3: The PR sequence** (spec §6.3.5, amended in the final fix wave). Each step is outward-facing, so **ask the user before each push and before adding the label.**
  1. Push and open the PR. Gates 1–8 green, gate 10's table in the job summary, gate 9 summary: "no baselines", naming the label first.
  2. Add the label `update-visual-baselines` to the PR. The Visual baselines workflow runs from the PR branch's own copy of the file (`workflow_dispatch` cannot run until the file is on `main`), commits the baselines and removes the label.
  3. The bot's push used `GITHUB_TOKEN`, so it starts no CI, and a re-run would reuse the old commit. `git pull` the bot commit, then `git commit --allow-empty -m "ci: run gate 9 against committed baselines"` and push.
  4. Expect gate 9 to report 0 diffs, 0 play errors and **2 skips** (`components-select--native-label-warning` in light and in dark).
  5. A throwaway commit changes one token colour, for example the accent step in the token source, regenerated with `gen:theme-css`. Gate 9 must report diffs, with images in the `visual-diffs` artifact. Expect noise in gates 1–8 too, from the contrast report and the generated-artifacts freshness check: record it; it is not a regression.
  6. Revert that commit and confirm CI is back to 0 diffs.

- [ ] **Step 4: Close out.**
  - Append "What actually happened" to this plan, in the 5g format. Include:
    - each task's review rounds;
    - Task 6's ruling and root cause;
    - the opt-out route taken in Task 9, Step 3;
    - the sweep counts;
    - F2 closed by `d25edbb`;
    - what remains open.
  - Mark 5h done in spec §2's table.
  - Update the project memory file `phase5-progress.md`: Phase 5 is complete, and the carried-forward follow-ups are the date-only ISO default, the focus ring, underline vs hairline, Switch `[data-invalid]`, and the width caps.
  - Commit, push (with the user's go-ahead), and hand the merge decision to the user via `superpowers:finishing-a-development-branch`.

---

## Verification plan

| # | Claim | Command | Must fail when… |
|---|---|---|---|
| 1 | The follow-ups behave as specified on both ICU versions | `npm test`; the Node 22.22.0 unit run | any Task 1–3 perturbation is applied |
| 2 | Aliased storage reads are caught | `npm run test:guards` | the walker is call-only again |
| 3 | `TwoOpen` no longer sleeps, and still fails when it should | `npm run test:stories` ×3 | the first tooltip is pinned open |
| 4 | RTL survives a consumer production build | `npm run test:ssr` | the `cssTarget` default is removed |
| 5 | A consumer's own `cssTarget` is respected, with a warning | `npx vitest run --project unit packages/vite` | the hook overwrites it, or the warning is dropped |
| 6 | Select `Default` passes in the production build | Task 6, Step 4 | the root-cause fix is reverted |
| 7 | Every stateful component streams in the late chunk | `npm run test:ssr` | `defaultChecked` or `defaultValue` is changed |
| 8 | Hydration fails on a recoverable error, not just on console noise | `npm run test:hydration` | `Date.now()` text is added to a route |
| 9 | Tree-shaking holds, and budgets are enforced | `npm run size` | `"sideEffects": true`; a budget is lowered by 1 byte; an entry is removed |
| 10 | Screenshots match Linux baselines | gate 9 on the PR | a token colour changes |
| 11 | Every CI job is green; gates 9 and 10 report | the PR's CI run | — |

**Final proof artifact:** the PR's CI run, together with its `contrast-report`, `size-report` and gate 9 job summary. It must show gates 1–8 green, gate 10's table, and gate 9 clean against the committed baselines. Add Step 3.5's diff run, showing gate 9 catching a real change.

---

## What actually happened

The run had nine build tasks, then one whole-branch review with a single fix wave, then the PR sequence. It was opened as PR #9. The branch holds 28 commits after `bf0b849`, counting the bot's baselines commit, the empty CI commit, the throwaway diff, its revert and this retrospective.

- **Reviews:**
  - Tasks 1–6 and 9 passed their first review.
  - Task 7 needed one fix round. The edit ran twice, which left a duplicated `<LocaleProvider>` and a `//` comment rendered as JSX text.
  - Task 8 needed one fix round. `export type { Button }` of a value passed the export check; the fix walks the alias chain and rejects type-only re-exports.
  - No task stopped as BLOCKED.
- **Final review:** four Important findings, fixed in one wave and re-reviewed as ADDRESSED.
  - I1: the baselines trigger.
  - I2: a re-run cannot see the bot commit.
  - I3: the summary could pass vacuously and could block the advisory gate.
  - I4: the streamed hydration check ran before the boundary hydrated.
- **Local sweep at `05809bd`:**
  - typecheck
  - unit 2419, also on Node 22.22.0
  - vite + scripts 43
  - gates 3, 110, 2, 5, 4, 4, 7, 1133 and 148
  - SSR 8, SPA 1, hydration 31
  - stories typecheck and build
  - showcase 12
  - `size` exit 0
  - consumer 12
  - `check:lockfiles`, and `gen:*` freshness clean
- **Execution** was subagent-driven, with a fresh implementer per task and a task review after each.

### Two production-only bugs

- **RTL was lost in production.**
  - Vite 8 minifies CSS with lightningcss at `build.cssTarget`. It defaults to baseline-widely-available, which is Chrome 111, and at that target `:dir(rtl)` is lowered to `:is(:lang(ae),:lang(ar),…)`.
  - Development builds never lower, so every earlier gate passed.
  - `@ap/vite` now sets `build.cssTarget` to `AP_CSS_TARGET` (Chrome/Edge 120, Firefox 114, Safari 16.4), unless the consumer set `build.cssTarget` or `build.target`.
  - `ap-components:rtl-check` warns when the lowered shape appears, once per build environment.
  - Gate 6 asserts that `:dir(rtl)` is present and `:lang(ae)` is absent in the fixture's production CSS.
  - ADR-0016 and ADR-0017 are amended.
- **Select `Default` failed against `storybook-static`** (Task 6, ruling B).
  - Base UI moves focus to the highlighted item on the next animation frame after opening. A second ArrowDown within about 16 ms resets the highlight.
  - Real input at human speed is unaffected, so this was a play artifact. The play now waits on `toHaveFocus` before each follow-up ArrowDown, with no sleeps.
  - The sub-frame reset is recorded as a known Base UI edge, not a product bug.

### Gate 9 in practice

- **Opt-out route (Task 9, Step 3):** `index.json` carries no story parameters, so `parameters.visual.skip` could not be read. Opt-outs live in a typed `SKIP` map in `stories.spec.ts`, checked by a sanity test. Its one entry is `components-select--native-label-warning`, which asserts a development-only warning that production strips.
- **Getting baselines before merge:** `workflow_dispatch` only runs once the workflow is on the default branch. `visual-baselines.yml` therefore also triggers on the `pull_request` label `update-visual-baselines`.
  - The bot's commit, pushed with `GITHUB_TOKEN`, starts no CI. A re-run reuses the old SHA.
  - So the sequence is: add the label, `git pull`, then push an empty commit.
- **PR #9 results:**

| Commit | Gate 9 | Other jobs |
|---|---|---|
| `05809bd` (first push) | no baselines | 7/7 green |
| `6a156f5` (bot, run 38088384713) | 250 PNGs committed, label removed | — |
| `d6eed80` (empty commit) | 254 passed, 0 diffs, 0 play errors, 2 skipped | 7/7 green |
| `24d0e85` (throwaway: brand seed `#2e5fd9` → `#d92e8a`) | **150 diffs**, 104 passed, 0 play errors; 2.9 MB `visual-diffs` artifact | gate 1 determinism snapshot red (expected); contrast and freshness green |
| `65793e4` (revert) | 254 passed, 0 diffs, 2 skipped | 7/7 green |

  The 104 stories that did not change draw no brand-ramp colour, which is consistent with a brand-only change.

### Follow-ups

- **F2** is closed by `d25edbb` with no code change. RadioGroup's `invalid` JSDoc already said what F2 asked for.

### Still open

- **Carried from 5g and earlier:**
  - the date-only ISO default;
  - the focus ring vs `bg-raised`;
  - underline vs hairline;
  - Switch `[data-invalid]`;
  - the Tooltip/Popover width caps.
- **Parked from 5h:**
  - Move `visual-baselines.yml` concurrency under the job.
  - The fork-PR comment names the wrong failing step.
  - `summary.ts` throws on a malformed report.
  - Orphan baselines are not reported.
  - Stale budget entries are not reported.
  - `scripts/` is not typechecked.
  - `export type *` is not detected as type-only.
  - Cosmetic test minors from Tasks 1–4, 6 and 8.
- **Not started:** a GitHub Pages deploy for Storybook. `STORYBOOK_BASE_PATH` is ready; spec §3.5 deferred the workflow to Phase 6.
