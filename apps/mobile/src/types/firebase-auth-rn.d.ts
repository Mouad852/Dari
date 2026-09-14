/**
 * `@firebase/auth`'s own package.json lists an unconditioned `"types"` key
 * ahead of its `"react-native"` export condition in its `exports` map, so
 * TypeScript always resolves to the generic (browser) declaration file
 * regardless of `customConditions` -- `getReactNativePersistence` only
 * exists in the platform-specific one Metro actually bundles at runtime
 * (`dist/rn/index.rn.d.ts`), never in the one `tsc` sees. A known,
 * documented gap in the SDK's own `exports` ordering, not a local bug.
 *
 * This augments the module with just that one function's real signature
 * (copied from `dist/rn/index.rn.d.ts`'s own JSDoc) rather than suppressing
 * the error at every call site -- lib/firebase.ts is the only intended
 * caller, but this keeps the type available anywhere else that imports it.
 *
 * The top-level `import type` (rather than nesting it inside the `declare
 * module` block) is load-bearing: it's what makes TypeScript treat this
 * file as a module and therefore *augment* the existing `@firebase/auth`
 * declaration rather than replace it outright -- a `declare module` inside
 * an otherwise import/export-free (ambient script) file redefines the
 * module from scratch instead of merging, which silently deleted every
 * other export (`initializeAuth`, `onAuthStateChanged`, ...) the first
 * time this was written the other way.
 */
import type { Persistence, ReactNativeAsyncStorage } from '@firebase/auth';

declare module '@firebase/auth' {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
