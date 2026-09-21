package ma.dari.api.listing;

import ma.dari.api.support.AbstractIntegrationTest;
import ma.dari.api.user.User;
import ma.dari.api.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

class ReferenceDataApiTest extends AbstractIntegrationTest {

    @Autowired
    ListingRepository listings;

    @Autowired
    UserRepository users;

    @Test
    void cityCountsReadOnlyThePublishedListingsView() {
        User owner = users.save(new User("uid-city-counts", "city.counts@example.ma", true, "Owner"));
        listings.saveAndFlush(listing(owner, "Ville agr\u00e9g\u00e9e", ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE));
        listings.saveAndFlush(listing(owner, "Brouillon absent", ListingStatus.DRAFT, AvailabilityState.AVAILABLE));
        listings.saveAndFlush(listing(owner, "Chambre trouv\u00e9e absente", ListingStatus.PUBLISHED, AvailabilityState.ROOM_FOUND));

        given().when().get("/cities")
                .then().statusCode(200)
                .body("find { it.city == 'Ville agr\u00e9g\u00e9e' }.count", equalTo(1));
    }

    private Listing listing(User owner, String title, ListingStatus status, AvailabilityState availability) {
        return new Listing(owner, title, "Ville agr\u00e9g\u00e9e", "Quartier", 33.9716, -6.8498,
                new BigDecimal("2000.00"), status, availability);
    }
}
