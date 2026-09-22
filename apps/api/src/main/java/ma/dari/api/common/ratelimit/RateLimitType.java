package ma.dari.api.common.ratelimit;

public enum RateLimitType {
    REPORT,
    MESSAGE,
    LISTING,
    UPLOAD,
    SIGNUP,
    SEARCH,
    /**
     * Marks a read the web app renders on the server (listing detail, public
     * profile). Its policy is also the generous shared ceiling for every read
     * that carries the web runtime's SSR key: that runtime cannot forward a
     * trustworthy visitor address, so a per-IP quota would throttle the whole
     * rendered site. Without the key, an SSR_READ endpoint is limited exactly
     * like SEARCH, per address.
     */
    SSR_READ
}
