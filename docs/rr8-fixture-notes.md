# React Router 8 fixture notes

Three behaviours of React Router 8 shape how `fixtures/ssr-app` and its gate in
`packages/react/src/gates/ssr-render.gate.test.ts` are written. Each was found by
reading the installed source and capturing real output, not by reasoning from the
docs, and each one silently invalidated an assertion before it was understood.

The line references are against **`react-router` / `@react-router/dev` 8.3.1** and
are implementation details, not public API. If a version bump breaks a gate here,
re-derive the behaviour before changing the assertion — the whole point of these
gates is that they fail rather than quietly proving less.

## Node's `fetch()` looks like a bot, and bots do not get streaming

RR8's default server entry (`@react-router/dev/dist/config/defaults/entry.server.node.tsx`,
around lines 29-35) selects its render mode like this:

```js
let userAgent = request.headers.get("user-agent");
let readyOption = (userAgent && isbot(userAgent)) || routerContext.isSpaMode
  ? "onAllReady"
  : "onShellReady";
```

`onAllReady` waits for the entire tree before sending anything: no shell, no
Suspense fallback, no streaming. And Node's built-in `fetch()` sends
`User-Agent: node`, which `isbot` classifies as a crawler.

So a gate that fetches with Node's default UA gets a fully-buffered response and
*still sees the late Suspense content in the HTML* — because it was resolved
before the response was sent, not because it streamed. The streaming assertion
passes while exercising the opposite code path from the one it claims to test.

This is why the gate sends a browser User-Agent on every request, and why it
asserts the fallback text appears **before** the streamed content in the HTML
rather than merely appearing at all. Ordering is what distinguishes a genuine
out-of-order flush from a loader that awaited its own promise.

The fixture ships no `app/entry.server.tsx`, so this stock entry is what runs —
which is deliberate: the gate proves a *stock* RR8 app streams, not that our
fixture-specific entry does.

Note the trade: with a browser UA on every fetch, nothing exercises the bot
(`onAllReady`) path. That is acceptable — the bot path is defined as not
streaming, so there is no streaming property to prove there — but it means a
regression in that branch would not be caught here.

## A fixed port lets a leaked server answer for a build you did not make

The gate originally bound a fixed port and killed its server with
`server?.kill()`. On Windows, spawning through `shell: true` means that call
kills the `cmd.exe` wrapper, not the `npm` → `node` grandchild, so
`react-router-serve` survives the run.

The consequence is worse than a leaked process. The next run spawns its own
server, that server fails with `EADDRINUSE`, the failure is invisible because
stdio was discarded, and the readiness probe then gets its `200` from the
*previous* run's process. Every HTTP assertion afterwards measures a stale
build. This actually happened: a run reported 5/5 green while answering from a
server started four minutes earlier, and would have passed with the route module
deleted.

The gate now:

- binds port 0 and reads back the OS-assigned port, so a leaked process cannot
  collide with it at all — this removes the failure class structurally rather
  than detecting one instance of it;
- kills the process tree (`taskkill /PID <pid> /T /F` on Windows, `detached` plus
  `process.kill(-pid)` on POSIX);
- captures server stdio and includes it in the readiness-timeout message, so a
  startup failure is legible instead of indistinguishable from a slow boot;
- asserts the served HTML links **this build's** hashed asset filenames, read from
  `build/client/.vite/manifest.json`. Content hashes cannot match across differing
  builds, so a stale server fails even if every other guard were removed.

That last point is why `fixtures/ssr-app/vite.config.ts` sets `build.manifest: true`:
RR8 deletes the client manifest after building unless the user config asks for it
(`@react-router/dev/dist/vite.js`, `viteManifestEnabled` around line 1205 and
`cleanViteManifests` around 2503-2515).

## What an SPA-mode build actually emits

Two constraints apply when `ssr: false`, and they are easy to confuse.

**Non-root routes are stubbed out.** The generated server entry replaces every
non-root route module with `{ default: () => null }` (`vite.js` around line 1234),
and RR8 additionally rejects any non-root route exporting a `loader` at build time
(around lines 1949-1958). That second rule is why `app/routes.ts` drops the
`/streamed` route in SPA mode: the route exists to prove server streaming, and a
build with no server has no business routing to it.

**The shell is a real render, but not of your root component.** When no `prerender`
paths are configured, RR8 renders `__spa-fallback.html` through a genuine
`entry.server` render — validated to contain `window.__reactRouterContext` — and
`finalize()` renames it to `index.html` if no `index.html` exists (`vite.js` around
lines 2175-2186). But what gets rendered is root's **`HydrateFallback`**, not
root's own JSX (`react-router/dist/.../ssr/routes.js` around line 33). Our
`root.tsx` exports no `HydrateFallback`, so it gets RR8's default one, which
renders `BoundaryShell` (`.../ssr/fallback.js` and `.../ssr/errorBoundaries.js`
around lines 75-82) — a minimal document emitting `<Scripts/>` and **no `<Links/>`**.

Two consequences the gate depends on:

- The SPA shell legitimately contains **no stylesheet link**, because `<Links/>`
  is never called. An earlier version of this fixture added `prerender: ['/']` to
  make a stylesheet-link assertion pass — which quietly changed the artifact into a
  prerendered page containing real `Surface` markup, discarding the very
  SSR-versus-SPA distinction the gate exists to draw. It was removed.
- The shell cannot contain the index route's text, guaranteed twice over (the
  non-root stubbing, and the HydrateFallback substitution). The gate asserts the
  absence of `server rendered surface` positively, so the distinction is proven
  rather than assumed.

## Related

- `docs/CONTRIBUTING.md` § *Windows drive-letter casing breaks vanilla-extract
  silently* — the other environment artifact these fixtures work around.
- `docs/CONTRIBUTING.md` § *Known gaps in Phase 2's gates* — what these fixtures
  do **not** prove, in particular npm's transitive `file:` resolution.
