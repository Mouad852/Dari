package ma.dari.api.common.ratelimit;

public enum RateLimitType {
    REPORT,
    MESSAGE,
    LISTING,
    UPLOAD,
    SIGNUP,
    SEARCH,
    /**
     * Generous shared ceiling for reads reached from Next.js Server Components.
     * The web runtime cannot forward a trustworthy visitor address, so applying
     * a per-IP browser quota here would throttle the whole rendered site.
     */
    SSR_READ
}
