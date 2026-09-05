package ma.dari.api.moderation;

import jakarta.validation.Valid;
import ma.dari.api.common.auth.CurrentUser;
import ma.dari.api.common.ratelimit.RateLimited;
import ma.dari.api.common.ratelimit.RateLimitType;
import ma.dari.api.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Reporting, from the reporter's side (phase 06).
 *
 * <p>Kept separate from the admin queue on purpose (§7): this path must never
 * see reporter identities other than the caller's own, or any moderation
 * outcome.
 */
@RestController
@RequestMapping("/api/v1/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    /**
     * Files a report. Three distinct reporters within a rolling seven-day window
     * auto-suspend the target.
     *
     * <p>That threshold is also an attack: a small coordinated group can suppress
     * a competitor's listing. Rate limiting narrows it and does not close it;
     * reporter-reliability weighting would, and is deferred. Watch the auto-flag
     * rate in production.
     */
    @PostMapping
    @RateLimited(RateLimitType.REPORT)
    public ResponseEntity<ReportResponse> create(@CurrentUser User reporter,
                                               @Valid @RequestBody CreateReportRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ReportResponse.from(reportService.create(reporter, request)));
    }

    /**
     * The reporter's own reports — received or closed, and nothing else.
     *
     * <p>Never the outcome, never the target's state, never whether anyone
     * acted. §6 is explicit, and this is the easiest place to leak it by being
     * helpful.
     */
    @GetMapping("/me")
    public List<ReportResponse> mine(@CurrentUser User reporter) {
        return reportService.mine(reporter);
    }
}
