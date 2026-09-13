/**
 * Routes that bound their own layout to exactly the viewport height instead
 * of scrolling as a normal document — a conversation thread's sticky header,
 * internally-scrolling message list, and composer pinned at the bottom.
 * Any persistent site chrome (footer, header, mobile nav bar) appearing on
 * these routes adds page-level scroll that nudges that whole layout upward,
 * working against the point of pinning the composer in the first place.
 * Grep `height: '100vh'` under `app/` before adding a route here — every
 * other page uses `minHeight`, where site chrome is exactly right.
 */
export const FULL_SCREEN_ROUTES = [/^\/messages\/[^/]+$/];
