package ma.dari.api.media;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Hides files that have been revoked and are waiting for physical deletion.
 *
 * <p>Media cleanup is deliberately asynchronous so a temporary storage outage
 * cannot leave an account deletion half-complete. The cleanup outbox therefore
 * doubles as the access-revocation record for files served by this application:
 * once a key is pending deletion, it must no longer be readable even if the
 * object still exists on disk for a retry worker to remove later.
 */
@Component
public class MediaAccessInterceptor implements HandlerInterceptor {

    private static final String UPLOADS_PREFIX = "/uploads/";

    private final MediaCleanupRepository cleanups;

    public MediaAccessInterceptor(MediaCleanupRepository cleanups) {
        this.cleanups = cleanups;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if (!path.startsWith(UPLOADS_PREFIX)) {
            return true;
        }

        String storageKey = path.substring(UPLOADS_PREFIX.length());
        if (!storageKey.isBlank()
                && cleanups.existsByStorageKeyAndStatus(storageKey, MediaCleanupStatus.PENDING)) {
            // Do not reveal whether this was a formerly accessible key. This
            // intentionally matches a missing static resource.
            // Do not use sendError here: its internal /error dispatch would
            // pass through Spring Security as a separate protected request and
            // turn this intentional 404 into a misleading 401.
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            return false;
        }
        return true;
    }
}
