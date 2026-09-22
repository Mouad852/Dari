'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * The first focusable element on every page -- WCAG 2.4.1 (Bypass Blocks).
 * Before `SiteNav` existed this had far less bite (there was nothing ahead
 * of a page's own content to skip); now every page has a logo link, a
 * search form and up to three nav links a keyboard user must tab through
 * first. Every page in this app renders exactly one `<main>` landmark
 * (confirmed elsewhere in this review's duplicate-landmark check), so this
 * targets it at runtime rather than requiring an `id`/`tabIndex` on all 25
 * page files individually. Hidden off-screen until focused -- `.skip-link`
 * in app.css handles the focused position, since inline styles can't
 * express `:focus`.
 *
 * The `id="main-content"` assignment and the `href` that points at it exist
 * for axe's own `skip-link` rule, which checks the target actually resolves
 * in the DOM -- it has no way to know the `onClick` below does the real
 * work. Keyed on `pathname`, the same pattern `SiteNav` already uses, since
 * a client-side transition swaps `{children}` (a new `<main>`) without
 * remounting this component. Both the click handler and the id
 * assignment re-query `<main>` rather than trusting a single lookup, so they
 * stay correct when a route's loading.tsx `<main>` is replaced by the loaded
 * page's without a pathname change.
 */
export function SkipLink() {
  const pathname = usePathname();

  useEffect(() => {
    const assign = () => {
      const main = document.querySelector('main');
      if (main && main.id !== 'main-content') main.id = 'main-content';
    };
    assign();

    // Keyed on pathname alone, the id was assigned to whichever <main> existed
    // at that moment -- and a route with a loading.tsx renders one <main> for
    // its skeleton and swaps in another when the content lands, with no
    // pathname change. The id stayed on the discarded element, "#main-content"
    // resolved to nothing, and axe failed both its skip-link and region rules
    // on /account. Following the element rather than the route is what the
    // click handler below already does.
    const observer = new MutationObserver(assign);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <a
      href="#main-content"
      className="skip-link"
      onClick={(event) => {
        const main = document.querySelector('main');
        if (!main) return;
        event.preventDefault();
        main.setAttribute('tabindex', '-1');
        main.focus();
        main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true });
      }}
    >
      Aller au contenu principal
    </a>
  );
}
