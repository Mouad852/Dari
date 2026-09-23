import { deepLinkPath } from '@/lib/deepLinks';

/**
 * Rewrites an incoming link to the app route it means, before expo-router
 * matches it — at a cold start and while the app runs. Routing it afterwards
 * from the root layout (as before) meant `dari://listings/{id}` first landed
 * on the unmatched-route screen and `dari://messages/{id}` opened twice.
 * A link this app does not know is passed through unchanged.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return deepLinkPath(path) ?? path;
  } catch {
    return path;
  }
}
