package ma.dari.api.common.error;

/** Deliberate, user-facing failure. Anything else is a 500 and a log line. */
public class ApiException extends RuntimeException {

    private final int status;
    private final ErrorCode code;

    public ApiException(int status, ErrorCode code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static ApiException notFound(String message) {
        return new ApiException(404, ErrorCode.NOT_FOUND, message);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(403, ErrorCode.FORBIDDEN, message);
    }

    public static ApiException conflict(String message) {
        return new ApiException(409, ErrorCode.CONFLICT, message);
    }

    public int status() { return status; }

    public ErrorCode code() { return code; }
}
