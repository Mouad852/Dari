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
 * remounting this component. The click handler itself re-queries `<main>`
 * directly rather than trusting the id, so it stays correct even in the
 * narrow window between a page's loading and loaded `<main>` (two pages in
 * this app swap one for the other without a pathname change).
 */
export function SkipLink() {
  const pathname = usePathname();

  useEffect(() => {
    const main = document.querySelector('main');
    if (main) main.id = 'main-content';
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
