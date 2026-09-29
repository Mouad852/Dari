package ma.dari.api.common.error;

import tools.jackson.core.JacksonException;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.hibernate.exception.ConstraintViolationException;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.validation.BindException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final MeterRegistry meterRegistry;
    private final ErrorReporter errorReporter;
    private final String releaseVersion;

    @Autowired
    public GlobalExceptionHandler(MeterRegistry meterRegistry, ErrorReporter errorReporter,
                                  @Value("${dari.release-version}") String releaseVersion) {
        this.meterRegistry = meterRegistry;
        this.errorReporter = errorReporter;
        this.releaseVersion = releaseVersion;
    }

    public GlobalExceptionHandler(MeterRegistry meterRegistry) {
        this(meterRegistry, new NoopErrorReporter(), "development");
    }

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
        if (cause instanceof JacksonException mappingException && !mappingException.getPath().isEmpty()) {
            String field = mappingException.getPath().get(0).getPropertyName();
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
     * A static path under {@code /uploads/**} (or any other unmatched route)
     * with nothing behind it — most commonly a photo or avatar that has since
     * been deleted.
     *
     * <p>Without this, {@code NoResourceFoundException} fell through to the
     * catch-all below and a plain missing file was reported as a server fault
     * rather than the ordinary 404 it is — the same class of misreporting the
     * {@code AccessDeniedException} handler above exists to prevent for denials.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ErrorResponse> handleMissingResource(NoResourceFoundException e) {
        return ResponseEntity.status(404).body(ErrorResponse.of(ErrorCode.NOT_FOUND, "Ressource introuvable"));
    }

    /**
     * Protocol mistakes Spring MVC rejects before a controller runs: the wrong
     * verb, the wrong Content-Type, a missing multipart file or query parameter.
     *
     * <p>Without these they fell through to the catch-all below, so anyone could
     * produce 500s, error-tracking events and {@code dari.errors.unhandled}
     * increments at will ({@code curl -X PUT /api/v1/listings}). They are client
     * errors and are answered as such, unreported.
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ErrorResponse> handleMethodNotSupported(HttpRequestMethodNotSupportedException e) {
        ResponseEntity.BodyBuilder response = ResponseEntity.status(405);
        Set<HttpMethod> supported = e.getSupportedHttpMethods();
        if (supported != null && !supported.isEmpty()) {
            response.allow(supported.toArray(HttpMethod[]::new));
        }
        return response.body(ErrorResponse.of(ErrorCode.METHOD_NOT_ALLOWED, "Méthode non autorisée"));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ResponseEntity<ErrorResponse> handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException e) {
        return ResponseEntity.status(415)
                .body(ErrorResponse.of(ErrorCode.UNSUPPORTED_MEDIA_TYPE, "Type de contenu non pris en charge"));
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    ResponseEntity<ErrorResponse> handleMissingPart(MissingServletRequestPartException e) {
        return missingInput(e.getRequestPartName());
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    ResponseEntity<ErrorResponse> handleMissingParameter(MissingServletRequestParameterException e) {
        return missingInput(e.getParameterName());
    }

    private static ResponseEntity<ErrorResponse> missingInput(String name) {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put(name, "Requis");
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(ErrorCode.VALIDATION_FAILED.name(), "Données invalides", fields));
    }

    /**
     * A write that lost a race against a database constraint -- two concurrent
     * first uploads both claiming the cover ({@code idx_listing_photos_active_cover}),
     * for instance. The client can retry, so it is a 409, not a server fault.
     *
     * <p>Logged at warn with the constraint name only: the driver message
     * carries the conflicting values ({@code (email)=(...)}), which can name a
     * person. A steady stream of these for one constraint is a missing
     * validation, not a race; the log line is what shows it.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ErrorResponse> handleConstraintViolation(DataIntegrityViolationException e, HttpServletRequest req) {
        String constraint = e.getCause() instanceof ConstraintViolationException violation
                && violation.getConstraintName() != null ? violation.getConstraintName() : "unknown";
        log.warn("Constraint violation on {} {} (constraint {})", req.getMethod(), routePattern(req), constraint);
        return ResponseEntity.status(409)
                .body(ErrorResponse.of(ErrorCode.CONFLICT, "Conflit avec une autre modification, veuillez réessayer"));
    }

    /**
     * The catch-all. The message is deliberately vague to the client and
     * deliberately detailed in the log — never leak SQL or a stack trace.
     *
     * <p>Only this handler reports to error tracking: everything above is an
     * expected 4xx. The report carries the route <em>pattern</em>
     * ({@code /api/v1/users/{id}}), never the concrete path or query string,
     * which can name a person.
     */
    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> handleUnexpected(Exception e, HttpServletRequest req) {
        log.error("Unhandled exception on {} {}", req.getMethod(), req.getRequestURI(), e);
        meterRegistry.counter("dari.errors.unhandled", "exception", e.getClass().getSimpleName()).increment();
        try {
            errorReporter.report(e, new ErrorReporter.SafeErrorContext(
                    routePattern(req), req.getMethod(), MDC.get("correlationId"), releaseVersion));
        } catch (RuntimeException reportingFailure) {
            // Reporting must never change the response.
            log.warn("Error reporting failed ({})", reportingFailure.getClass().getSimpleName());
        }
        return ResponseEntity.status(500)
                .body(ErrorResponse.of(ErrorCode.INTERNAL_ERROR, "Une erreur est survenue"));
    }

    private static String routePattern(HttpServletRequest req) {
        return req.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE) instanceof String pattern
                ? pattern : "unmatched";
    }
}
