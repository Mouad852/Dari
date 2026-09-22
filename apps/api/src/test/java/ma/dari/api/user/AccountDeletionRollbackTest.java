package ma.dari.api.user;

import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import ma.dari.api.listing.AvailabilityState;
import ma.dari.api.listing.Listing;
import ma.dari.api.listing.ListingRepository;
import ma.dari.api.listing.ListingStatus;
import ma.dari.api.support.AbstractJobIntegrationTest;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;

/**
 * {@code firebaseAuth.deleteUser} runs last, inside the deletion transaction.
 * When it fails (a timeout included, now that the SDK has one), nothing of
 * the deletion may survive: not the scrub, not the soft-deleted listings, and
 * not the revocation of the person's avatar.
 */
class AccountDeletionRollbackTest extends AbstractJobIntegrationTest {

    @Autowired
    UserRepository users;

    @Autowired
    ListingRepository listings;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void aFailedFirebaseDeletionRollsTheWholeDeletionBack() throws Exception {
        String uid = "uid-rollback-" + System.nanoTime();
        String email = uid + "@example.ma";
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn(uid);
        Mockito.when(token.getEmail()).thenReturn(email);
        Mockito.when(token.isEmailVerified()).thenReturn(true);
        Mockito.when(firebaseAuth.verifyIdToken(Mockito.anyString())).thenReturn(token);
        User user = users.saveAndFlush(new User(uid, email, true, "Rollback Owner"));
        Listing listing = listings.saveAndFlush(new Listing(user, "Chambre à garder", "Rabat", "Agdal",
                33.9716, -6.8498, new BigDecimal("2500.00"), ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE));

        String avatarUrl = given().header("Authorization", "Bearer rollback")
                .multiPart("file", "me.jpg", AvatarCleanupLocalIntegrationTest.jpeg(), "image/jpeg")
                .when().post("/users/me/avatar")
                .then().statusCode(200)
                .extract().path("avatarUrl");
        String avatarKey = avatarUrl.substring("/uploads/".length());

        Mockito.doThrow(Mockito.mock(FirebaseAuthException.class)).when(firebaseAuth).deleteUser(uid);

        given().header("Authorization", "Bearer rollback").when().delete("/users/me")
                .then().statusCode(502).body("code", equalTo("INTERNAL_ERROR"));

        User kept = users.findById(user.getId()).orElseThrow();
        assertThat(kept.getDeletedAt()).isNull();
        assertThat(kept.getEmail()).isEqualTo(email);
        assertThat(kept.getDisplayName()).isEqualTo("Rollback Owner");
        assertThat(kept.getAvatarStorageKey()).isEqualTo(avatarKey);

        Listing keptListing = listings.findById(listing.getId()).orElseThrow();
        assertThat(keptListing.getStatus()).isEqualTo(ListingStatus.PUBLISHED);
        assertThat(keptListing.getDeletedAt()).isNull();

        assertThat(jdbc.queryForObject("SELECT count(*) FROM media_cleanup WHERE storage_key = ?", Long.class, avatarKey))
                .as("the avatar is not revoked by a deletion that did not happen")
                .isZero();
        given().basePath("").when().get(avatarUrl).then().statusCode(200);
    }
}
