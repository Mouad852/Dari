package ma.dari.api.common.error;

/**
 * Marks a route that exists in the skeleton but is built in a later phase.
 *
 * <p>501, not 500 and not a silent empty response. The endpoint surface from
 * design doc §7 is a contract worth having visible from day one — routes,
 * methods, path shapes and auth rules are all reviewable now — but a stub
 * returning {@code 200 []} would be a lie the frontend could build against.
 *
 * <p>Every use of this class is a TODO that the compiler and the HTTP status
 * agree on. When there are none left, the API is complete against §7.
 */
public class NotImplementedYetException extends ApiException {

    /** e.g. "phase 05" — for logs, never for the client. */
    private final String phase;

    public NotImplementedYetException(String phase) {
        super(501, ErrorCode.NOT_IMPLEMENTED, "Fonctionnalité indisponible pour le moment");
        this.phase = phase;
    }

    public String phase() {
        return phase;
    }
}
