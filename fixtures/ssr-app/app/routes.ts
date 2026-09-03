import { index, route, type RouteConfig } from '@react-router/dev/routes'

// RR8's SPA-mode build statically rejects any route module that exports a
// `loader` or an `action` (there is no server to run either against) —
// `streamed.tsx` exports a loader and `form.tsx` an action, both deliberately,
// to prove gate 6's SSR streaming and ADR-0011 §4's pre-hydration submit.
// Gate 7 never requests either path, so the SPA build simply doesn't route to
// them, keeping this one app buildable in both modes without a second fixture.
const isSpa = process.env['AP_SPA'] === '1'

export default [
  index('routes/home.tsx'),
  ...(isSpa ? [] : [route('streamed', 'routes/streamed.tsx'), route('form', 'routes/form.tsx')]),
] satisfies RouteConfig
