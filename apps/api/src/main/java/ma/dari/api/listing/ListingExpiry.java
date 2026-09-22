package ma.dari.api.listing;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * The single rule for when a published listing ends.
 *
 * <p>{@link #startWindow} runs on approval (PENDING_REVIEW -> PUBLISHED), which
 * covers first publication and re-approval after an edit or a renewal, since
 * both of those send the listing back to review. Nothing else moves
 * {@code expires_at}: not availability changes, not photo edits, not the
 * expiry warning, and not a restore from SUSPENDED, which resumes the window
 * the listing already had.
 */
@Component
public class ListingExpiry {

    private final Clock clock;
    private final int expiryDays;
    private final int warningDays;

    public ListingExpiry(Clock clock,
                         @Value("${dari.listing.expiry-days:60}") int expiryDays,
                         @Value("${dari.listing.expiry-warning-days:7}") int warningDays) {
        this.clock = clock;
        this.expiryDays = expiryDays;
        this.warningDays = warningDays;
    }

    /** A fresh life from now, and a fresh warning before it ends. */
    public void startWindow(Listing listing) {
        listing.setExpiresAt(now().plus(expiryDays, ChronoUnit.DAYS));
        listing.setExpiryWarnedAt(null);
    }

    Instant now() {
        return Instant.now(clock);
    }

    int expiryDays() {
        return expiryDays;
    }

    int warningDays() {
        return warningDays;
    }
}
