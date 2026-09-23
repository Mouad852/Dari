/**
 * Where a `dari://` link opens, named after the web app's routes so the same
 * path works on both: `listings/{id}` (web /listings/[id]; the singular
 * `listing` is kept as an alias), `messages/{id}` or `conversation/{id}`, and
 * `profile-recovery`, the web's page for finishing a profile. The app has no
 * such screen, so that link opens sign-in, where a session starts.
 *
 * A plain function rather than expo-linking's parse, so it can be tested
 * without the Expo runtime. It reads `dari://listings/x` (kind in the host),
 * `dari:///listings/x` (kind in the path) and Expo Go's development form
 * `exp://host:port/--/listings/x`. Anything else, including an id that is not
 * a plain identifier, opens nothing.
 */
export type DeepLinkTarget =
  | { pathname: '/listing/[id]'; params: { id: string } }
  | { pathname: '/messages/[id]'; params: { id: string } }
  | { pathname: '/sign-in' };

const LINK = /^(dari|exps?):\/\/([^/?#]*)([^?#]*)/i;
const ID = /^[A-Za-z0-9-]{1,64}$/;

export function parseDeepLink(value: string): DeepLinkTarget | null {
  const split = (part: string) => part.split('/').filter(Boolean);
  const trimmed = value.trim();
  const match = LINK.exec(trimmed);
  if (!match && !trimmed.startsWith('/')) return null;
  // A bare path ("/listings/x"), as expo-router may hand over, reads like the path of a dari:/// link.
  const [, scheme, host, path] = match ?? [trimmed, 'dari', '', trimmed.replace(/[?#].*$/, '')];

  let segments: string[];
  if (scheme!.toLowerCase() === 'dari') {
    segments = [...split(host!), ...split(path!)];
  } else {
    const expoGoPath = path!.indexOf('/--/');
    if (expoGoPath < 0) return null;
    segments = split(path!.slice(expoGoPath + 4));
  }

  const [kind, id, ...rest] = segments;
  if (rest.length > 0) return null;
  if (kind === 'profile-recovery') return id === undefined ? { pathname: '/sign-in' } : null;
  if (!id || !ID.test(id)) return null;
  if (kind === 'listings' || kind === 'listing') return { pathname: '/listing/[id]', params: { id } };
  if (kind === 'messages' || kind === 'conversation') return { pathname: '/messages/[id]', params: { id } };
  return null;
}

/** The app route a link opens, as a path, or null when the link is not one of the above. */
export function deepLinkPath(value: string): string | null {
  const target = parseDeepLink(value);
  if (!target) return null;
  if (target.pathname === '/sign-in') return '/sign-in';
  return target.pathname.replace('[id]', encodeURIComponent(target.params.id));
}
