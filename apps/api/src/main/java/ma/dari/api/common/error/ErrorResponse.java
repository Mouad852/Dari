package ma.dari.api.common.error;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

/**
 * One error shape for the whole API, including failures raised inside servlet
 * filters — those bypass {@code @RestControllerAdvice}, so the auth filter
 * serializes this record by hand rather than letting Spring emit its default.
 *
 * @param code    machine-readable, from {@link ErrorCode}
 * @param message user-facing French, plain and non-blaming; never a stack trace
 * @param fields  per-field validation messages, absent when not applicable
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(String code, String message, Map<String, String> fields) {

    public static ErrorResponse of(ErrorCode code, String message) {
        return new ErrorResponse(code.name(), message, null);
    }
}
