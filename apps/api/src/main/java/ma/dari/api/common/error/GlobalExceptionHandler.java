package ma.dari.api.common.error;

import com.fasterxml.jackson.databind.JsonMappingException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ErrorResponse> handle(ApiException e) {
        ResponseEntity.BodyBuilder response = ResponseEntity.status(e.status());
        if (e instanceof RateLimitExceededException rateLimit) {
            response.header("Retry-After", Long.toString(rateLimit.retryAfterSeconds()));
        }
        return response.body(ErrorResponse.of(e.code(), e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        return validationResponse(e.getBindingResult().getFieldErrors());
    }

    @ExceptionHandler(BindException.class)
    ResponseEntity<ErrorResponse> handleBindingValidation(BindException e) {
        return validationResponse(e.getBindingResult().getFieldErrors());
    }

    private ResponseEntity<ErrorResponse> validationResponse(Iterable<FieldError> errors) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError f : errors) {
            fields.putIfAbsent(f.getField(), f.getDefaultMessage());
        }
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(ErrorCode.VALIDATION_FAILED.name(), "Données invalides", fields));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ErrorResponse> handleUnreadableRequest(HttpMessageNotReadableException e) {
        Map<String, String> fields = new LinkedHashMap<>();
        Throwable cause = e.getMostSpecificCause();
        if (cause instanceof JsonMappingException mappingException && !mappingException.getPath().isEmpty()) {
            String field = mappingException.getPath().get(0).getFieldName();
            if (field != null) {
                fields.put(field, "Valeur invalide");
            }
        }
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(
                        ErrorCode.VALIDATION_FAILED.name(),
                        "Données invalides",
                        fields.isEmpty() ? null : fields));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ErrorResponse> handleArgumentTypeMismatch(MethodArgumentTypeMismatchException e) {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put(e.getName(), "Valeur invalide");
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(ErrorCode.VALIDATION_FAILED.name(), "Données invalides", fields));
    }

    /**
     * An upload rejected by the servlet container before it ever reached a
     * controller.
     *
     * <p>Without this the request falls through to the catch-all below and the
     * owner gets an opaque 500 for the entirely ordinary act of picking a large
     * photo. The message deliberately matches {@code LocalImageStore}'s own size
     * check, because from the owner's side it is the same problem — only the
     * layer that caught it differs.
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ErrorResponse> handleUploadTooLarge(MaxUploadSizeExceededException e) {
        return ResponseEntity.badRequest()
                .body(ErrorResponse.of(ErrorCode.VALIDATION_FAILED, "La photo doit faire moins de 5 Mo"));
    }

    /**
     * A role check that fired inside the controller rather than in the filter
     * chain — {@code @PreAuthorize} on {@code AdminController}, in practice.
     *
     * <p>This exists because the two halves of the doubled role check did not
     * report the same way. The URL matcher in {@code SecurityConfig} is handled
     * by {@code RestAccessDeniedHandler} and returns 403; {@code @PreAuthorize}
     * throws inside the handler invocation, so without this it fell through to
     * the catch-all below and returned a 500. Access was still refused either
     * way, but a genuine authorization event was being reported as a server
     * fault — which is both the wrong contract for the client and the kind of
     * thing that gets investigated as an outage instead of read as a denial.
     *
     * <p>Verified by removing the URL matcher and confirming the second layer
     * now answers 403 on its own.
     */
    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException e) {
        return ResponseEntity.status(403).body(ErrorResponse.of(ErrorCode.FORBIDDEN, "Accès refusé"));
    }

    /**
     * The catch-all. The message is deliberately vague to the client and
     * deliberately detailed in the log — never leak SQL or a stack trace.
     */
    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> handleUnexpected(Exception e, HttpServletRequest req) {
        log.error("Unhandled exception on {} {}", req.getMethod(), req.getRequestURI(), e);
        return ResponseEntity.status(500)
                .body(ErrorResponse.of(ErrorCode.INTERNAL_ERROR, "Une erreur est survenue"));
    }
}
