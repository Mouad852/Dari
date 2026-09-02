package ma.dari.api.common.error;

import com.fasterxml.jackson.databind.JsonMappingException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ErrorResponse> handle(ApiException e) {
        return ResponseEntity.status(e.status()).body(ErrorResponse.of(e.code(), e.getMessage()));
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
