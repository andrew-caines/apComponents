# Tooling minors: Phase 6 docs tooling and parked 5h CI

**Goal:** close the "Still open" lists in `2026-10-11-phase6-documentation.md` and `2026-10-10-phase5h-gates.md` (Parked from 5h). Branch `chore/tooling-minors`, one PR.

**Ground rules (carried):** every fix has a test that fails before it, or a named perturbation. Run `npm --prefix storybook run typecheck` locally, since the root `typecheck` skips story files. Write files with LF line endings.

## Verification plan

| # | Check | Success signal |
|---|---|---|
| 1 | `npx vitest run --project unit scripts` | docs-refs, size and visual-summary tests pass. Each new test failed before its fix. |
| 2 | `npx vitest run --project unit storybook/docs/generator` | The `?brand=` padding test passes. It failed before. |
| 3 | `npm run typecheck` | Green, now including `scripts/`. |
| 4 | `npm --prefix storybook run typecheck && npm run test:stories` | Green. The generator's debounce story still holds `generations ≤ 2`. |
| 5 | `npm run test:hydration` | The `/start` test applies the marker filter, and the subscribe submit test passes. |
| 6 | `npm run size` | Exit 0. A stale budget entry is reported (perturbation: add a fake key). |
| 7 | `npm test && npm run test:gates` | Green. |
| 8 | PR CI, then the baseline label, then an empty commit | 7/7 green. The bot commit changes only `foundations-theme-generator-stories--*` (the contrast table). |

**Proof artifact:** the green PR CI run after the baseline update.

## Tasks

### A. docs-refs (`scripts/docs-refs.ts`, `storybook/docs/lib/extractRegion.ts`)
1. **`docsIdOf`** becomes `toId(title, 'Docs')` from `storybook/internal/csf`. That is Storybook's own sanitizer, so non-ASCII letters (`Café` → `café`) now match. Test: a title with `é`.
2. **`META_TITLE`** uses a backreference, so the closing quote must match the opening one: `/<Meta\s+title=(["'])(.+?)\1/`. Test: `title="Guide's notes"`.
3. **Code fences.** Fenced blocks are blanked (with their line count kept) before the link and docs-link scans. Test: a broken `?path=` inside a ```` ``` ```` fence is not reported.
4. **Strict markers.** `marker()` accepts exactly `// #region docs:x` or `{/* #region docs:x */}`. Mixed forms such as `// … */}` or `{/* …` with no close are rejected. Test: each mixed form is "no region".
5. **Temp dirs.** The tests track each `mkdtempSync` dir and `rmSync` it in `afterEach`.

### B. Theme generator (`storybook/docs/generator`)
6. **`?brand=` padding.** `readBrandParam` trims before the `#` check. Test: `?brand=%20abc123%20` reads `#abc123`.
7. **Generation counter.** Move the increment out of `useMemo` into an effect on `[theme]` that writes `data-count` to the span through a ref. Render stays pure, and the story's `≤ 2` assertion is unchanged.
8. **Contrast table length.** Show a summary line (`110 pairings, N fail`) and the failing rows. The full table goes in a `<details>` that is closed by default. Story assertion: the summary count equals the rows' fail count. *(Screenshot change: the generator stories.)*
9. **Swatch hexes.** `RampStrip` keeps its blocks, adds a `<details><summary>Hex values</summary>` list under them, and drops `title`. ColourTheory is a docs page, so no screenshot changes.

### C. SSR fixture (`fixtures/ssr-app`)
10. **`/start` filter.** The test gets the same `HYDRATION_MARKERS` filter and assertion as the home route.
11. **`/subscribe`.** Add a fixture route with an `action` that returns a confirmation page. The guide's region is unchanged. A new e2e test fills the email, submits, and sees the confirmation. A one-line note in GettingStarted.mdx says the action is the app's own.

### D. Gate 9 (`.github/workflows/visual-baselines.yml`, `storybook/visual`)
12. **Concurrency.** Move it under the job. A non-matching label event then skips without taking the group, so it cannot replace a pending baseline run.
13. **Fork comment.** On a fork PR, `actions/checkout` fails first, because `head_ref` is not a branch of this repo. The push never runs. Correct the comment.
14. **Malformed report.** `summary.ts` CLI: an unparsable or misshapen report becomes `::warning::` and exit 0, matching the no-report path. `summarise` treats a non-array `suites` as a global error. Tests in `scripts/visual-summary.test.ts`.
15. **Orphan baselines.** A platform-independent test in `stories.spec.ts` checks that every PNG in `__screenshots__/{light,dark}` names a story in `index.json` that is not in `SKIP`.

### E. Gate 10 and typecheck (`scripts/size`, root)
16. **Stale budgets.** `evaluate` adds a row for every budget key with no measurement (`stale budget entry`). Test in `budget.test.ts`.
17. **`export type *`.** `valueExports` drops names that reach the module only through `export type *` chains. Test in `exports.test.ts`: `export type * from './a'` where `a` exports a function.
18. **`scripts/` typecheck.** Add `scripts/tsconfig.json` (`noEmit`, extends base) and run `tsc -p scripts` in `typecheck`. Fix whatever it finds.

### F. Close-out
19. **Cosmetic test minors (5h Tasks 1–4, 6, 8).** No list of them survives in the plan or the PR. Close the item as unrecorded, not as done.
20. Annotate both "Still open" lists in place with commits, append a retrospective here, open the PR, and run the baseline sequence.

## Retrospective

### What shipped
- **docs-refs** (`de6f891`): ids come from Storybook's own `toId`, titles with an apostrophe read whole, fenced samples are not checked as links, markers are exactly one of the two forms, and test temp dirs are removed.
- **Generator** (`d82cb3d`): a padded `?brand=` is trimmed, generations are counted in an effect, the contrast table opens on a summary and the failing rows, and swatch hexes sit in a keyboard-reachable disclosure.
- **SSR fixture** (`aa5446e`): `/subscribe` is a real action, and an e2e test submits the guide's form to it with client JavaScript blocked. `/start` applies the hydration marker filter.
- **Gate 9** (`939f46e`): concurrency is job-level, the fork note is accurate, an unreadable report warns rather than throws, and orphan baselines fail a per-project check.
- **Gate 10 and typecheck** (`1757f1c`): stale budget entries fail, names reached only through `export type *` are not value exports, and `scripts/` is typechecked.
- **Closed without code:** the 5h cosmetic minors, as unrecorded. The 5h Pages item was already done (`08098d1`).

### Found while building
- **Storybook keeps non-ASCII letters in ids** (`Café` → `café`). The old `docsIdOf` dropped them.
- **`scripts/` had one real type error.** It was an untyped tuple array in `gen-colour-demo.ts`, and the fix is type-only. It also needed `DOM.Iterable`.
- **Process.** An escaped newline (backslash-n) passed through a Bash heredoc into Python reached the files as real newlines. Use Edit for anything with escapes. Restoring after a perturbation with `git checkout -- <file>` also discards the uncommitted fix, so copy the file aside and restore from the copy.

### Proof
- Locally: `npm test` (2565), `test:gates`, `typecheck` (now with `scripts/`), the storybook typecheck, `test:stories` (132), `test:ssr`, `test:spa`, `test:hydration` (37), `size` (exit 0) and `check:lockfiles`. All green.
- Perturbations: the debounce story fails without the debounce. A fake orphan PNG fails in its project only. A fake budget key fails `size`. A type error in `scripts/` fails `typecheck`.

### Still open
- Nothing. The baseline run left every baseline unchanged (268 passed). Gate 9 captures only the 1024×768 viewport, and the contrast table and ramp disclosures sit below the fold. Verification row 8's expected screenshot change was wrong.

