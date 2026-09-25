'use client';

/**
 * The first focusable element on every page -- WCAG 2.4.1 (Bypass Blocks).
 * Before `SiteNav` existed this had far less bite (there was nothing ahead
 * of a page's own content to skip); now every page has a logo link, a
 * search form and up to three nav links a keyboard user must tab through
 * first. Every page in this app renders exactly one `<main>` landmark
 * (confirmed elsewhere in this review's duplicate-landmark check), so the
 * click moves focus to it at runtime rather than requiring a `tabIndex` on all
 * 25 page files individually. Hidden off-screen until focused -- `.skip-link`
 * in app.css handles the focused position, since inline styles can't
 * express `:focus`.
 *
 * The `href` exists for axe's own `skip-link` rule, which checks the target
 * actually resolves in the DOM, and for a click before JavaScript has loaded.
 * Its target is the `#main-content` wrapper the root layout renders around
 * every page on the server. This component used to write that id onto
 * `<main>` from an effect instead, which ran before the rest of the page had
 * hydrated and made React report a mismatch between the server HTML and the
 * client. The click handler re-queries `<main>` each time, so it follows a
 * route's loading.tsx `<main>` being replaced by the loaded page's.
 */
export function SkipLink() {
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
