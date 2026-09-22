package ma.dari.api.media;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriUtils;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;

/**
 * Hides files that have been revoked and are waiting for physical deletion.
 *
 * <p>Media cleanup is deliberately asynchronous so a temporary storage outage
 * cannot leave an account deletion half-complete. The cleanup outbox therefore
 * doubles as the access-revocation record for files served by this application:
 * once a key is enqueued (PENDING, and still after it turns DEAD), it must no
 * longer be readable even if the object still exists on disk.
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

        String storageKey;
        try {
            // Decode exactly once. A generated storage key never needs percent
            // escapes, so reject anything that would be ambiguous to the static
            // resource handler or could turn into traversal on a second decode.
            storageKey = UriUtils.decode(path.substring(UPLOADS_PREFIX.length()), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException invalidEncoding) {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            return false;
        }
        if (!isSafeStorageKey(storageKey)) {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            return false;
        }
        // Any cleanup row revokes the key, not only PENDING. A DEAD row means
        // the worker gave up while the file may well still be on disk, and it
        // must stay hidden until an operator deals with it.
        if (!storageKey.isBlank() && cleanups.existsByStorageKey(storageKey)) {
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

    private boolean isSafeStorageKey(String storageKey) {
        if (storageKey.isBlank() || storageKey.indexOf('\\') >= 0 || storageKey.indexOf('%') >= 0) {
            return false;
        }
        try {
            Path path = Path.of(storageKey);
            return !path.isAbsolute() && path.normalize().equals(path)
                    && storageKey.split("/").length >= 3;
        } catch (InvalidPathException invalidPath) {
            // A malformed URI (notably %00) must look exactly like a missing
            // public object, never escape this interceptor as a server error.
            return false;
        }
    }
}
