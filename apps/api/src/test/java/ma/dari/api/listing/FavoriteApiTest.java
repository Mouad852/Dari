package ma.dari.api.listing;

import com.google.firebase.auth.FirebaseToken;
import ma.dari.api.support.AbstractIntegrationTest;
import ma.dari.api.user.User;
import ma.dari.api.user.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.Instant;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;

class FavoriteApiTest extends AbstractIntegrationTest {

    @Autowired
    UserRepository users;

    @Autowired
    ListingRepository listings;

    @Autowired
    FavoriteRepository favorites;

    @Autowired
    FavoriteService favoriteService;

    private void stubToken(String uid, String email, boolean emailVerified) throws Exception {
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn(uid);
        Mockito.when(token.getEmail()).thenReturn(email);
        Mockito.when(token.isEmailVerified()).thenReturn(emailVerified);
        Mockito.when(firebaseAuth.verifyIdToken(Mockito.anyString())).thenReturn(token);
    }

    private Listing publishedListing(User owner, String title) {
        return listings.saveAndFlush(new Listing(
                owner,
                title,
                "Rabat",
                "Agdal",
                33.9716,
                -6.8498,
                new BigDecimal("2600.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        ));
    }

    @Test
    @DisplayName("a listing can be favorited, listed and unfavorited")
    void addListAndRemoveFavorite() throws Exception {
        User owner = users.save(new User("uid-owner-fav", "owner.fav@example.ma", true, "Owner"));
        users.save(new User("uid-seeker-fav", "seeker.fav@example.ma", true, "Seeker"));
        Listing listing = publishedListing(owner, "Studio Agdal");

        stubToken("uid-seeker-fav", "seeker.fav@example.ma", true);

        given().header("Authorization", "Bearer test-token")
                .when().post("/favorites/" + listing.getId())
                .then().statusCode(204);

        var favoritesResponse = given().header("Authorization", "Bearer test-token")
                .when().get("/favorites")
                .then().statusCode(200)
                .body("items.size()", equalTo(1))
                .body("items[0].id", equalTo(listing.getId().toString()))
                .extract();

        assertThat(favoritesResponse.asString())
                .doesNotContain("\"status\"")
                .doesNotContain("owner.fav@example.ma")
                .doesNotContain("uid-owner-fav");

        // Numeric, not a substring of the stored value -- see the same note in
        // ListingApiTest.publicDetailIsVisibleForPublishedListing.
        double[] fuzzed = LocationFuzzer.fuzz(listing.getId(), 33.9716, -6.8498);
        var coordinates = favoritesResponse.jsonPath(exactNumbers());
        assertThat(coordinates.getDouble("items[0].latitude")).isEqualTo(fuzzed[0]);
        assertThat(coordinates.getDouble("items[0].longitude")).isEqualTo(fuzzed[1]);

        given().header("Authorization", "Bearer test-token")
                .when().delete("/favorites/" + listing.getId())
                .then().statusCode(204);

        given().header("Authorization", "Bearer test-token")
                .when().get("/favorites")
                .then().statusCode(200)
                .body("items.size()", equalTo(0));
    }

    @Test
    @DisplayName("GET /favorites/ids returns just the favorited listing ids, for membership checks")
    void idsEndpointReturnsFavoritedListingIds() throws Exception {
        User owner = users.save(new User("uid-owner-fav6", "owner.fav6@example.ma", true, "Owner"));
        users.save(new User("uid-seeker-fav6", "seeker.fav6@example.ma", true, "Seeker"));
        Listing favorited = publishedListing(owner, "Studio Favorited");
        Listing notFavorited = publishedListing(owner, "Studio Not Favorited");

        stubToken("uid-seeker-fav6", "seeker.fav6@example.ma", true);

        given().header("Authorization", "Bearer test-token")
                .when().get("/favorites/ids")
                .then().statusCode(200)
                .body("size()", equalTo(0));

        given().header("Authorization", "Bearer test-token")
                .when().post("/favorites/" + favorited.getId())
                .then().statusCode(204);

        given().header("Authorization", "Bearer test-token")
                .when().get("/favorites/ids")
                .then().statusCode(200)
                .body("size()", equalTo(1))
                .body("[0]", equalTo(favorited.getId().toString()))
                .body("", not(hasItem(notFavorited.getId().toString())));
    }

    @Test
    @DisplayName("favoriting the same listing twice is idempotent, not a conflict")
    void addingTwiceIsIdempotent() throws Exception {
        User owner = users.save(new User("uid-owner-fav2", "owner.fav2@example.ma", true, "Owner"));
        users.save(new User("uid-seeker-fav2", "seeker.fav2@example.ma", true, "Seeker"));
        Listing listing = publishedListing(owner, "Chambre Hassan");

        stubToken("uid-seeker-fav2", "seeker.fav2@example.ma", true);

        given().header("Authorization", "Bearer test-token")
                .when().post("/favorites/" + listing.getId())
                .then().statusCode(204);

        given().header("Authorization", "Bearer test-token")
                .when().post("/favorites/" + listing.getId())
                .then().statusCode(204);

        given().header("Authorization", "Bearer test-token")
                .when().get("/favorites")
                .then().statusCode(200)
                .body("items.size()", equalTo(1));
    }

    @Test
    @DisplayName("removing a favorite that was never added is a no-op, not a 404")
    void removingUnfavoritedListingIsNoop() throws Exception {
        User owner = users.save(new User("uid-owner-fav3", "owner.fav3@example.ma", true, "Owner"));
        users.save(new User("uid-seeker-fav3", "seeker.fav3@example.ma", true, "Seeker"));
        Listing listing = publishedListing(owner, "Appartement Souissi");

        stubToken("uid-seeker-fav3", "seeker.fav3@example.ma", true);

        given().header("Authorization", "Bearer test-token")
                .when().delete("/favorites/" + listing.getId())
                .then().statusCode(204);
    }

    @Test
    @DisplayName("one user cannot remove another user's favorite")
    void favoriteRemovalIsUserScoped() throws Exception {
        /*
        User owner = users.save(new User("uid-owner-fav-owner-scope", "owner.fav.owner.scope@example.ma", true, "Owner"));
        users.save(new User("uid-seeker-fav-owner-scope", "seeker.fav.owner.scope@example.ma", true, "Seeker"));
        users.save(new User("uid-outsider-fav-owner-scope", "outsider.fav.owner.scope@example.ma", true, "Outsider"));
        Listing listing = publishedListing(owner, "Studio protégé");
        UUID listingId = listing.getId();

        stubToken("uid-seeker-fav-owner-scope", "seeker.fav.owner.scope@example.ma", true);
        given().header("Authorization", "Bearer uid-seeker-fav-owner-scope")
                .when().post("/favorites/" + listing.getId())
                .then().statusCode(204);

        stubToken("uid-outsider-fav-owner-scope", "outsider.fav.owner.scope@example.ma", true);
        given().header("Authorization", "Bearer uid-outsider-fav-owner-scope")
                .when().delete("/favorites/" + listing.getId())
                .then().statusCode(204);

        stubToken("uid-seeker-fav-owner-scope", "seeker.fav.owner.scope@example.ma", true);
        given().header("Authorization", "Bearer uid-seeker-fav-owner-scope")
                .when().get("/favorites/ids")
                .then().statusCode(200)
                .body("[0]", equalTo(listing.getId().toString()));
        */

        User owner = users.save(new User("uid-owner-fav-owner-scope", "owner.fav.owner.scope@example.ma", true, "Owner"));
        User seeker = users.save(new User("uid-seeker-fav-owner-scope", "seeker.fav.owner.scope@example.ma", true, "Seeker"));
        User outsider = users.save(new User("uid-outsider-fav-owner-scope", "outsider.fav.owner.scope@example.ma", true, "Outsider"));
        Listing listing = publishedListing(owner, "Studio protégé");
        favorites.saveAndFlush(new Favorite(seeker, listing));

        favoriteService.remove(outsider, listing.getId());

        assertThat(favorites.findByUserIdAndListingId(seeker.getId(), listing.getId())).isPresent();
    }
    @Test
    @DisplayName("a favorited listing that leaves AVAILABLE stays in the list, marked unavailable")
    void favoritedListingStaysWhenNoLongerAvailable() throws Exception {
        User owner = users.save(new User("uid-owner-fav4", "owner.fav4@example.ma", true, "Owner"));
        users.save(new User("uid-seeker-fav4", "seeker.fav4@example.ma", true, "Seeker"));
        Listing listing = publishedListing(owner, "Studio Souissi");

        stubToken("uid-seeker-fav4", "seeker.fav4@example.ma", true);
        given().header("Authorization", "Bearer test-token")
                .when().post("/favorites/" + listing.getId())
                .then().statusCode(204);

        listing.setAvailabilityState(AvailabilityState.ROOM_FOUND);
        listings.saveAndFlush(listing);

        given().header("Authorization", "Bearer test-token")
                .when().get("/favorites")
                .then().statusCode(200)
                .body("items.size()", equalTo(1))
                .body("items[0].availabilityState", equalTo("ROOM_FOUND"));
    }

    @Test
    @DisplayName("a favorited listing that is soft-deleted drops out of the list")
    void softDeletedListingDropsOut() throws Exception {
        User owner = users.save(new User("uid-owner-fav5", "owner.fav5@example.ma", true, "Owner"));
        users.save(new User("uid-seeker-fav5", "seeker.fav5@example.ma", true, "Seeker"));
        Listing listing = publishedListing(owner, "Loft Hassan");

        stubToken("uid-seeker-fav5", "seeker.fav5@example.ma", true);
        given().header("Authorization", "Bearer test-token")
                .when().post("/favorites/" + listing.getId())
                .then().statusCode(204);

        listing.setDeletedAt(Instant.now());
        listings.saveAndFlush(listing);

        given().header("Authorization", "Bearer test-token")
                .when().get("/favorites")
                .then().statusCode(200)
                .body("items.size()", equalTo(0));
    }
}
