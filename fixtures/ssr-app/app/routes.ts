import { index, route, type RouteConfig } from '@react-router/dev/routes'

// RR8's SPA-mode build statically rejects any route module that exports a
// `loader` (there is no server to run it against) — `streamed.tsx` exports
// one deliberately, to prove gate 6's SSR streaming. Gate 7 never requests
// `/streamed`, so the SPA build simply doesn't route to it, keeping this one
// app buildable in both modes without a second fixture.
const isSpa = process.env['AP_SPA'] === '1'

export default [
  index('routes/home.tsx'),
  ...(isSpa ? [] : [route('streamed', 'routes/streamed.tsx')]),
] satisfies RouteConfig
