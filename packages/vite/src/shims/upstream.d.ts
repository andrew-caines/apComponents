// Types for the upstream package, which ships none. Only `with-selector.test.tsx`
// imports it, to run the same cases against upstream and the port.
declare module 'use-sync-external-store/shim' {
  export { useSyncExternalStore } from 'react'
}
declare module 'use-sync-external-store/shim/with-selector' {
  export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => Snapshot,
    getServerSnapshot: undefined | null | (() => Snapshot),
    selector: (snapshot: Snapshot) => Selection,
    isEqual?: (a: Selection, b: Selection) => boolean,
  ): Selection
}
