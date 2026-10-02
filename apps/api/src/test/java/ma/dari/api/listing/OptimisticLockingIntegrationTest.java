package ma.dari.api.listing;

import ma.dari.api.support.AbstractIntegrationTest;
import ma.dari.api.user.User;
import ma.dari.api.user.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A write built on a stale read no longer wins silently (audit P2-2): the
 * owner's "chambre trouvée" saving over a moderator's suspension, or two
 * profile edits crossing.
 */
class OptimisticLockingIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    ListingRepository listings;

    @Autowired
    UserRepository users;

    @Test
    @DisplayName("a listing saved from a stale copy is refused, and the newer write survives")
    void staleListingWriteIsRefused() {
        User owner = users.saveAndFlush(new User("uid-lock-" + System.nanoTime(), "lock-" + System.nanoTime() + "@example.ma",
                true, "Lock Owner"));
        Listing created = listings.saveAndFlush(new Listing(owner, "Studio verrou", "Rabat", "Agdal", 33.9716, -6.8498,
                new BigDecimal("2500.00"), ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE));

        Listing ownersCopy = listings.findById(created.getId()).orElseThrow();
        Listing moderatorsCopy = listings.findById(created.getId()).orElseThrow();

        moderatorsCopy.setStatus(ListingStatus.SUSPENDED);
        listings.saveAndFlush(moderatorsCopy);

        ownersCopy.setAvailabilityState(AvailabilityState.ROOM_FOUND);
        assertThatThrownBy(() -> listings.saveAndFlush(ownersCopy))
                .isInstanceOf(ObjectOptimisticLockingFailureException.class);
        assertThat(listings.findById(created.getId()).orElseThrow().getStatus()).isEqualTo(ListingStatus.SUSPENDED);
    }

    @Test
    @DisplayName("an account saved from a stale copy is refused")
    void staleUserWriteIsRefused() {
        User created = users.saveAndFlush(new User("uid-lock-user-" + System.nanoTime(),
                "lock-user-" + System.nanoTime() + "@example.ma", true, "Lock User"));

        User first = users.findById(created.getId()).orElseThrow();
        User second = users.findById(created.getId()).orElseThrow();
        first.setBio("Première version");
        users.saveAndFlush(first);

        second.setBio("Version périmée");
        assertThatThrownBy(() -> users.saveAndFlush(second)).isInstanceOf(ObjectOptimisticLockingFailureException.class);
    }
}
