import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * Unmount anything React Testing Library rendered, between every test.
 *
 * RTL registers this itself only when it can find a global `afterEach` — which
 * needs `globals: true`. This project does not set that, so without this file
 * every rendered tree stays in the document and the *second* test that renders
 * the same component fails with "Found multiple elements", pointing at the
 * assertion rather than at the leak. Task 3 of Phase 4a hit exactly that and
 * worked around it per-file; this makes the workaround unnecessary, before the
 * component tasks (4b–4d) each rediscover it.
 *
 * Registering `afterEach` at setup scope applies it to every test file, so a
 * new component test gets isolation without opting in.
 */
afterEach(() => {
  cleanup()
})
