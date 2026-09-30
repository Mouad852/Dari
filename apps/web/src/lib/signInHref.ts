/**
 * The sign-in page, told where to come back to (audit P2-18).
 *
 * Every "Se connecter" link and redirect used to point at bare /sign-in, so
 * a visitor stopped on /favorites, a listing's "Contacter" or the publish
 * wizard landed on /account after signing in and had to find their way back.
 * /sign-in already returns to a same-site `next` path and ignores any other.
 *
 * @param returnTo a path on this site; defaults to the page the visitor is on.
 */
export function signInHref(returnTo?: string): string {
  const path = returnTo
    ?? (typeof window === 'undefined' ? '/' : `${window.location.pathname}${window.location.search}`);
  return `/sign-in?next=${encodeURIComponent(path)}`;
}
