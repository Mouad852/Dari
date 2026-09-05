package ma.dari.api.listing;

import com.google.firebase.auth.FirebaseToken;
import jakarta.validation.Validator;
import ma.dari.api.support.AbstractIntegrationTest;
import ma.dari.api.listing.dto.UpdateListingPhotoRequest;
import ma.dari.api.user.User;
import ma.dari.api.user.UserRepository;
import ma.dari.api.user.UserRole;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.equalTo;

class ListingApiTest extends AbstractIntegrationTest {

    @Autowired
    ListingRepository listings;

    @Autowired
    UserRepository users;

    @Autowired
    ListingPhotoRepository listingPhotos;

    @Autowired
    ListingAmenityRepository listingAmenities;

    @Autowired
    ListingSearchService listingSearchService;

    @Autowired
    Validator validator;

    private void stubToken(String uid, String email, boolean emailVerified) throws Exception {
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn(uid);
        Mockito.when(token.getEmail()).thenReturn(email);
        Mockito.when(token.isEmailVerified()).thenReturn(emailVerified);
        Mockito.when(firebaseAuth.verifyIdToken(Mockito.anyString())).thenReturn(token);
    }

    @Test
    @DisplayName("listing persists with independent status and availability state")
    void listingPersists() {
        User owner = new User("uid-owner", "owner@example.ma", true, "Owner");
        owner = users.save(owner);

        Listing listing = new Listing(
                owner,
                "Studio calme Agdal",
                "Rabat",
                "Agdal",
                33.9716,
                -6.8498,
                new BigDecimal("2500.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        );

        Listing saved = listings.saveAndFlush(listing);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getStatus()).isEqualTo(ListingStatus.PUBLISHED);
        assertThat(saved.getAvailabilityState()).isEqualTo(AvailabilityState.AVAILABLE);
        assertThat(saved.getLatitude()).isEqualTo(33.9716);
        assertThat(saved.getLongitude()).isEqualTo(-6.8498);
    }

    @Test
    @DisplayName("owner can mark room found without changing moderation status")
    void availabilityStateIsIndependent() {
        User owner = new User("uid-owner-2", "owner2@example.ma", true, "Owner 2");
        owner = users.save(owner);

        Listing listing = new Listing(
                owner,
                "Chambre cosy",
                "Casablanca",
                "Maarif",
                33.5731,
                -7.5898,
                new BigDecimal("1800.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        );

        listing.setAvailabilityState(AvailabilityState.ROOM_FOUND);
        Listing saved = listings.saveAndFlush(listing);

        assertThat(saved.getStatus()).isEqualTo(ListingStatus.PUBLISHED);
        assertThat(saved.getAvailabilityState()).isEqualTo(AvailabilityState.ROOM_FOUND);
    }

    @Test
    @DisplayName("public search returns published listings with fuzzed coordinates")
    void publicSearchReturnsPublishedListings() {
        User owner = new User("uid-search-owner", "search-owner@example.ma", true, "Owner Search");
        owner = users.save(owner);

        Listing listing = new Listing(
                owner,
                "Studio view Rabat",
                "Rabat",
                "Agdal",
                33.9716,
                -6.8498,
                new BigDecimal("2600.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        );
        listings.saveAndFlush(listing);

        var response = given()
                .when()
                .get("/listings?city=Rabat&sort=recent")
                .then()
                .statusCode(200)
                .extract()
                .jsonPath();

        // The Testcontainers database is shared across the whole suite (see
        // ARCHITECTURE.md §7), and several other test classes also publish
        // Rabat/Agdal listings, so this asserts the created listing is present
        // and correct rather than assuming it is the only Rabat result.
        java.util.List<java.util.Map> items = response.getList("items", java.util.Map.class);
        java.util.Map match = items.stream()
                .filter(item -> "Studio view Rabat".equals(item.get("title")))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Studio view Rabat not found in search results: " + items));

        assertThat(match.get("city")).isEqualTo("Rabat");
        assertThat(match).doesNotContainKey("status");
        assertThat(match.get("availabilityState")).isEqualTo("AVAILABLE");
        assertThat((Number) match.get("latitude")).isNotEqualTo(33.9716);
        assertThat((Number) match.get("longitude")).isNotEqualTo(-6.8498);
    }

    @Test
    @DisplayName("multi-select filters and map pins work for published listings")
    void filtersAndMapPinsAreApplied() {
        User owner = users.save(new User("uid-filter-owner", "filter-owner@example.ma", true, "Filter Owner"));

        Listing matching = new Listing(
                owner,
                "Studio Rabat filtré",
                "Rabat",
                "Agdal",
                33.9716,
                -6.8498,
                new BigDecimal("2700.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        );
        matching.setPropertyType(PropertyType.STUDIO);
        matching.setRoomType(RoomType.PRIVATE);
        matching.setRoomFurnishing(RoomFurnishing.FULLY_FURNISHED);
        listingSaveAndFlush(matching);

        Listing other = new Listing(
                owner,
                "Maison Casablanca",
                "Casablanca",
                "Maarif",
                33.5731,
                -7.5898,
                new BigDecimal("3200.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        );
        other.setPropertyType(PropertyType.HOUSE);
        other.setRoomType(RoomType.SHARED);
        other.setRoomFurnishing(RoomFurnishing.PARTIALLY_FURNISHED);
        listingSaveAndFlush(other);

        var searchResponse = given()
                .when()
                .get("/listings?city=Rabat&propertyType=STUDIO&roomType=PRIVATE&furnishing=FULLY_FURNISHED&sort=priceAsc")
                .then()
                .statusCode(200)
                .extract()
                .jsonPath();

        assertThat(searchResponse.getList("items.title")).contains("Studio Rabat filtré");

        var mapResponse = given()
                .when()
                .get("/listings/map?city=Rabat")
                .then()
                .statusCode(200)
                .extract()
                .jsonPath();

        assertThat(mapResponse.getList("title")).contains("Studio Rabat filtré");

        given()
                .when()
                .get("/listings/map?city=Rabat&lat=33.9716&lng=-6.8498&radiusM=250")
                .then()
                .statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("availability and amenity filters require every requested condition")
    void availabilityAndAmenityFiltersAreComposed() {
        User owner = users.save(new User("uid-filter-composition", "filter-composition@example.ma", true,
                "Filter Composition Owner"));

        Listing matching = new Listing(owner, "Annonce avec wifi et parking", "Rabat", "Agdal",
                33.9716, -6.8498, new BigDecimal("2400.00"), ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE);
        matching.setAvailableFrom(java.time.LocalDate.of(2026, 9, 1));
        matching = listings.saveAndFlush(matching);
        listingAmenities.saveAndFlush(new ListingAmenity(matching, "wifi"));
        listingAmenities.saveAndFlush(new ListingAmenity(matching, "parking"));

        Listing missingAmenity = new Listing(owner, "Annonce avec wifi seulement", "Rabat", "Agdal",
                33.9717, -6.8499, new BigDecimal("2400.00"), ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE);
        missingAmenity.setAvailableFrom(java.time.LocalDate.of(2026, 9, 1));
        missingAmenity = listings.saveAndFlush(missingAmenity);
        listingAmenities.saveAndFlush(new ListingAmenity(missingAmenity, "wifi"));

        Listing undated = new Listing(owner, "Annonce sans date", "Rabat", "Agdal",
                33.9718, -6.8500, new BigDecimal("2400.00"), ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE);
        listings.saveAndFlush(undated);

        var response = given()
                .queryParam("city", "Rabat")
                .queryParam("availableFrom", "2026-09-02")
                .queryParam("amenities", "wifi")
                .queryParam("amenities", "parking")
                .queryParam("amenities", "wifi")
                .when()
                .get("/listings")
                .then()
                .statusCode(200)
                .extract()
                .jsonPath();

        assertThat(response.getList("items.title"))
                .contains("Annonce avec wifi et parking")
                .doesNotContain("Annonce avec wifi seulement", "Annonce sans date");
    }

    private void listingSaveAndFlush(Listing listing) {
        listings.saveAndFlush(listing);
    }

    @Test
    @DisplayName("featured listings and public reference data are exposed")
    void featuredListingsAndReferenceDataArePublic() {
        User owner = users.save(new User("uid-featured-owner", "featured-owner@example.ma", true, "Featured Owner"));

        Listing rabat = listings.saveAndFlush(new Listing(
                owner,
                "Studio Rabat vedette",
                "Rabat",
                "Agdal",
                33.9716,
                -6.8498,
                new BigDecimal("2800.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        ));

        Listing casablanca = listings.saveAndFlush(new Listing(
                owner,
                "Studio Casablanca",
                "Casablanca",
                "Maarif",
                33.5731,
                -7.5898,
                new BigDecimal("3000.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        ));

        var featured = given()
                .when()
                .get("/listings/featured?limit=2")
                .then()
                .statusCode(200)
                .extract()
                .jsonPath();

        assertThat(featured.getList("title")).contains(rabat.getTitle(), casablanca.getTitle());

        var cities = given()
                .when()
                .get("/cities")
                .then()
                .statusCode(200)
                .extract()
                .jsonPath();

        assertThat(cities.getList("city")).contains("Rabat", "Casablanca");

        given()
                .when()
                .get("/amenities")
                .then()
                .statusCode(200)
                .body("findAll { it == 'wifi' }.size()", equalTo(1));
    }

    @Test
    @DisplayName("owner can fetch a published listing by id")
    void publicDetailIsVisibleForPublishedListing() throws Exception {
        User owner = users.save(new User("uid-public-detail", "public-detail@example.ma", true, "Owner Detail"));
        Listing listing = listings.saveAndFlush(new Listing(
                owner,
                "Petit studio central",
                "Casablanca",
                "Sidi Belyout",
                33.5652,
                -7.5923,
                new BigDecimal("2200.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        ));

        String body = given().when()
                .get("/listings/{id}", listing.getId())
                .then().statusCode(200)
                .body("id", equalTo(listing.getId().toString()))
                .extract().asString();

        assertThat(body)
                .doesNotContain("\"status\"")
                .doesNotContain("\"email\"")
                .doesNotContain("\"phone\"")
                .doesNotContain("\"firebaseUid\"")
                .doesNotContain("\"latitude\":33.5652")
                .doesNotContain("\"longitude\":-7.5923");
    }

    @Test
    @DisplayName("all public listing surfaces omit moderation status and fuzz exact coordinates")
    void publicListingSurfacesArePrivacySafe() {
        User owner = users.saveAndFlush(new User(
                "uid-public-audit", "public-audit@example.ma", true, "Public Audit Owner"));
        String city = "AuditVille" + System.nanoTime();
        double latitude = 33.9716;
        double longitude = -6.8498;
        Listing listing = listings.saveAndFlush(new Listing(
                owner, "Annonce audit public", city, "Centre", latitude, longitude,
                new BigDecimal("2500.00"), ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE));

        String search = given().queryParam("city", city).when().get("/listings")
                .then().statusCode(200).extract().asString();
        String map = given().queryParam("city", city).when().get("/listings/map")
                .then().statusCode(200).extract().asString();
        String featured = given().when().get("/listings/featured?limit=12")
                .then().statusCode(200).extract().asString();

        for (String response : new String[] {search, map, featured}) {
            assertThat(response)
                    .doesNotContain("\"status\"")
                    .doesNotContain("public-audit@example.ma")
                    .doesNotContain("uid-public-audit")
                    .doesNotContain("\"latitude\":" + latitude)
                    .doesNotContain("\"longitude\":" + longitude);
        }

        assertThat(search).contains(listing.getId().toString());
        assertThat(map).contains(listing.getId().toString());
    }

    @Test
    @DisplayName("owner can mark a published listing as room found and reopen it")
    void lifecycleTransitionsAreEnforced() throws Exception {
        stubToken("uid-transition-owner", "transition-owner@example.ma", true);
        User owner = users.save(new User("uid-transition-owner", "transition-owner@example.ma", true, "Transition Owner"));

        Listing listing = listings.saveAndFlush(new Listing(
                owner,
                "Chambre disponible",
                "Rabat",
                "Hassan",
                33.9710,
                -6.8500,
                new BigDecimal("1800.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        ));

        given().header("Authorization", "Bearer test-token")
                .when().post("/listings/{id}/mark-room-found", listing.getId())
                .then().statusCode(200)
                .body("availabilityState", equalTo("ROOM_FOUND"));

        given().header("Authorization", "Bearer test-token")
                .when().post("/listings/{id}/reopen", listing.getId())
                .then().statusCode(200)
                .body("availabilityState", equalTo("AVAILABLE"));
    }

    @Test
    @DisplayName("owner can renew an expired listing into review, but cannot renew another lifecycle state")
    void expiredListingCanBeRenewedIntoReview() throws Exception {
        stubToken("uid-renew-owner", "renew-owner@example.ma", true);
        User owner = users.saveAndFlush(new User("uid-renew-owner", "renew-owner@example.ma", true, "Renew Owner"));

        Listing expired = new Listing(
                owner, "Chambre expirée", "Rabat", "Agdal", 33.9716, -6.8498,
                new BigDecimal("2100.00"), ListingStatus.EXPIRED, AvailabilityState.AVAILABLE);
        expired.setRejectionReason("ancienne raison");
        expired = listings.saveAndFlush(expired);

        given().header("Authorization", "Bearer renew-token")
                .when().post("/listings/{id}/renew", expired.getId())
                .then().statusCode(200)
                .body("status", equalTo("PENDING_REVIEW"));

        Listing renewed = listings.findById(expired.getId()).orElseThrow();
        assertThat(renewed.getStatus()).isEqualTo(ListingStatus.PENDING_REVIEW);
        assertThat(renewed.getRejectionReason()).isNull();

        given().header("Authorization", "Bearer renew-token")
                .when().post("/listings/{id}/renew", expired.getId())
                .then().statusCode(409)
                .body("code", equalTo("ILLEGAL_TRANSITION"));
    }

    @Test
    @DisplayName("owner can create a draft listing")
    void createDraftListing() throws Exception {
        stubToken("uid-create-draft", "create-draft@example.ma", true);
        users.save(new User("uid-create-draft", "create-draft@example.ma", true, "Create Draft"));

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"title\":\"Studio Rabat\",\"city\":\"Rabat\",\"neighborhood\":\"Agdal\",\"latitude\":33.9716,\"longitude\":-6.8498,\"priceRent\":2500.00}")
                .when().post("/listings")
                .then().statusCode(201)
                .body("title", equalTo("Studio Rabat"))
                .body("status", equalTo("DRAFT"));

        String draftId = listings.findByOwnerId(users.findByFirebaseUid("uid-create-draft").orElseThrow().getId())
                .stream().findFirst().orElseThrow().getId().toString();
        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"title\":\"Studio Rabat repris\",\"description\":\"Description sauvegardée\"}")
                .when().patch("/listings/{id}", draftId)
                .then().statusCode(200)
                .body("title", equalTo("Studio Rabat repris"))
                .body("description", equalTo("Description sauvegardée"));

        given().header("Authorization", "Bearer test-token")
                .when().get("/listings/draft")
                .then().statusCode(200)
                .body("id", equalTo(draftId))
                .body("title", equalTo("Studio Rabat repris"))
                .body("status", equalTo("DRAFT"));
    }

    @Test
    @DisplayName("create validates availability date and minimum stay range")
    void createValidatesAvailabilityFields() throws Exception {
        stubToken("uid-create-validation", "create-validation@example.ma", true);
        users.save(new User("uid-create-validation", "create-validation@example.ma", true, "Create Validation"));

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"title\":\"Studio invalide\",\"city\":\"Rabat\",\"neighborhood\":\"Agdal\",\"latitude\":33.9716,\"longitude\":-6.8498,\"priceRent\":100000000.00,\"priceDeposit\":2500.001,\"availableFrom\":\"2020-01-01\",\"minStayMonths\":37,\"numBedrooms\":-1,\"numBathrooms\":21,\"maxRoommates\":21}")
                .when().post("/listings")
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"))
                .body("message", equalTo("Données invalides"))
                .body("fields.availableFrom", equalTo("La date de disponibilité doit être aujourd'hui ou ultérieure"))
                .body("fields.minStayMonths", equalTo("La durée minimale ne peut pas dépasser 36 mois"))
                .body("fields.priceRent", equalTo("Le loyer doit comporter au maximum 8 chiffres entiers et 2 décimales"))
                .body("fields.priceDeposit", equalTo("La caution doit comporter au maximum 8 chiffres entiers et 2 décimales"))
                .body("fields.numBedrooms", equalTo("Le nombre de chambres doit être compris entre 0 et 20"))
                .body("fields.numBathrooms", equalTo("Le nombre de salles de bain doit être compris entre 0 et 20"))
                .body("fields.maxRoommates", equalTo("Le nombre maximal de colocataires doit être compris entre 1 et 20"));
    }

    @Test
    @DisplayName("create and patch reject prices outside the database precision")
    void monetaryPrecisionIsValidated() throws Exception {
        var invalidCreate = new ma.dari.api.listing.dto.CreateListingRequest(
                null, null, null, null, null, new BigDecimal("100000000.00"), null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null);
        assertThat(validator.validate(invalidCreate))
                .anyMatch(error -> error.getPropertyPath().toString().equals("priceRent")
                        && error.getMessage().equals("Le loyer doit comporter au maximum 8 chiffres entiers et 2 décimales"));

        var invalidUpdate = new ma.dari.api.listing.dto.UpdateListingRequest(
                null, null, null, null, null, null, new BigDecimal("2500.001"), null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null);
        assertThat(validator.validate(invalidUpdate))
                .anyMatch(error -> error.getPropertyPath().toString().equals("priceDeposit")
                        && error.getMessage().equals("La caution doit comporter au maximum 8 chiffres entiers et 2 décimales"));
    }

    @Test
    @DisplayName("patch keeps required location fields non-blank while allowing omitted fields")
    void patchValidatesRequiredTextFields() {
        var validPartialPatch = new ma.dari.api.listing.dto.UpdateListingRequest(
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null);
        var invalidPatch = new ma.dari.api.listing.dto.UpdateListingRequest(
                " ", "", "\t", null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null);

        assertThat(validator.validate(validPartialPatch))
                .noneMatch(error -> error.getPropertyPath().toString().equals("title")
                        || error.getPropertyPath().toString().equals("city")
                        || error.getPropertyPath().toString().equals("neighborhood"));
        assertThat(validator.validate(invalidPatch))
                .extracting(error -> error.getPropertyPath().toString())
                .contains("title", "city", "neighborhood");
    }

    @Test
    @DisplayName("patch validates availability date, minimum stay, and roommate bounds")
    void patchValidatesAvailabilityFields() throws Exception {
        String uid = "uid-patch-validation-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email, true);
        users.save(new User(uid, email, true, "Patch Validation"));

        String id = given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"title\":\"Studio à modifier\",\"city\":\"Rabat\",\"neighborhood\":\"Agdal\",\"latitude\":33.9716,\"longitude\":-6.8498,\"priceRent\":2500.00}")
                .when().post("/listings")
                .then().statusCode(201)
                .extract().path("id");

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"title\":\" \",\"city\":\"\",\"neighborhood\":\"\\t\",\"availableFrom\":\"2020-01-01\",\"minStayMonths\":0,\"numBedrooms\":-1,\"numBathrooms\":21,\"currentRoommatesCount\":-1}")
                .when().patch("/listings/{id}", id)
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"))
                .body("message", equalTo("Données invalides"))
                .body("fields.availableFrom", equalTo("La date de disponibilité doit être aujourd'hui ou ultérieure"))
                .body("fields.minStayMonths", equalTo("La durée minimale doit être d'au moins 1 mois"))
                .body("fields.title", equalTo("Titre requis"))
                .body("fields.city", equalTo("Ville requise"))
                .body("fields.neighborhood", equalTo("Quartier requis"))
                .body("fields.numBedrooms", equalTo("Le nombre de chambres doit être compris entre 0 et 20"))
                .body("fields.numBathrooms", equalTo("Le nombre de salles de bain doit être compris entre 0 et 20"))
                .body("fields.currentRoommatesCount", equalTo("Le nombre actuel de colocataires doit être compris entre 0 et 20"));

    }

    @Test
    @DisplayName("listing DTOs validate current roommates count against maximum")
    void listingDtosValidateRoommatesCount() {
        var create = new ma.dari.api.listing.dto.CreateListingRequest(
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, (short) 3, (short) 2, null, null, null, null);
        var update = new ma.dari.api.listing.dto.UpdateListingRequest(
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, (short) 3, (short) 2, null, null, null, null);

        assertThat(validator.validate(create)).anyMatch(error ->
                error.getPropertyPath().toString().equals("maxRoommates"));
        assertThat(validator.validate(update)).anyMatch(error ->
                error.getPropertyPath().toString().equals("maxRoommates"));

        var validBounds = new ma.dari.api.listing.dto.CreateListingRequest(
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, (short) 0, (short) 20, null, null, null, null);
        var invalidBounds = new ma.dari.api.listing.dto.UpdateListingRequest(
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, (short) -1, (short) 21, null, null, null, null);

        assertThat(validator.validate(validBounds))
                .noneMatch(error -> error.getPropertyPath().toString().equals("currentRoommatesCount")
                        || error.getPropertyPath().toString().equals("maxRoommates"));
        assertThat(validator.validate(invalidBounds))
                .extracting(error -> error.getPropertyPath().toString())
                .contains("currentRoommatesCount", "maxRoommates");

        var validRoomCounts = new ma.dari.api.listing.dto.CreateListingRequest(
                null, null, null, null, null, null, null, null, null, null, null, null,
                (short) 0, (short) 20, null, null, null, null, null, null, null, null, null);
        var invalidRoomCounts = new ma.dari.api.listing.dto.UpdateListingRequest(
                null, null, null, null, null, null, null, null, null, null, null, null,
                (short) -1, (short) 21, null, null, null, null, null, null, null, null, null);

        assertThat(validator.validate(validRoomCounts))
                .noneMatch(error -> error.getPropertyPath().toString().equals("numBedrooms")
                        || error.getPropertyPath().toString().equals("numBathrooms"));
        assertThat(validator.validate(invalidRoomCounts))
                .extracting(error -> error.getPropertyPath().toString())
                .contains("numBedrooms", "numBathrooms");
    }

    @Test
    @DisplayName("listing DTOs keep draft property and room types nullable")
    void listingDtosKeepDraftTypesNullable() {
        var request = new ma.dari.api.listing.dto.CreateListingRequest(
                "Studio", "Rabat", "Agdal", 33.9716, -6.8498, new BigDecimal("2500.00"),
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null);

        assertThat(validator.validate(request))
                .noneMatch(error -> error.getPropertyPath().toString().equals("propertyType")
                        || error.getPropertyPath().toString().equals("roomType"));
    }

    @Test
    @DisplayName("listing DTOs reserve rejection reasons for moderation")
    void listingDtosRejectOwnerRejectionReasons() {
        var create = new ma.dari.api.listing.dto.CreateListingRequest(
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, "reason", null);
        var update = new ma.dari.api.listing.dto.UpdateListingRequest(
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, "reason", null);

        assertThat(validator.validate(create))
                .anyMatch(error -> error.getPropertyPath().toString().equals("rejectionReason"));
        assertThat(validator.validate(update))
                .anyMatch(error -> error.getPropertyPath().toString().equals("rejectionReason"));
    }

    @Test
    @DisplayName("create and patch reject unknown listing enum values as validation errors")
    void invalidListingEnumsAreValidationErrors() throws Exception {
        String uid = "uid-invalid-enums-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email, true);
        users.save(new User(uid, email, true, "Invalid Enums"));

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"title\":\"Studio invalide\",\"city\":\"Rabat\",\"neighborhood\":\"Agdal\","
                        + "\"latitude\":33.9716,\"longitude\":-6.8498,\"priceRent\":2500.00,"
                        + "\"propertyType\":\"PALACE\"}")
                .when().post("/listings")
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"))
                .body("message", equalTo("Données invalides"))
                .body("fields.propertyType", equalTo("Valeur invalide"));

        String id = given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"title\":\"Studio valide\",\"city\":\"Rabat\",\"neighborhood\":\"Agdal\","
                        + "\"latitude\":33.9716,\"longitude\":-6.8498,\"priceRent\":2500.00}")
                .when().post("/listings")
                .then().statusCode(201)
                .extract().path("id");

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"roomType\":\"DORMITORY\"}")
                .when().patch("/listings/{id}", id)
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"))
                .body("message", equalTo("Données invalides"))
                .body("fields.roomType", equalTo("Valeur invalide"));
    }

    @Test
    @DisplayName("owner PATCH cannot overwrite a moderation rejection reason")
    void ownerCannotPatchRejectionReason() throws Exception {
        String uid = "uid-rejection-owner-" + java.util.UUID.randomUUID();
        String email = uid + "@example.ma";
        stubToken(uid, email, true);
        users.saveAndFlush(new User(uid, email, true, "Rejection Owner"));
        String listingId = given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"title\":\"Studio rejeté\",\"city\":\"Rabat\",\"neighborhood\":\"Agdal\","
                        + "\"latitude\":33.9716,\"longitude\":-6.8498,\"priceRent\":2500.00}")
                .when().post("/listings")
                .then().statusCode(201)
                .extract().path("id");
        Listing listing = listings.findById(java.util.UUID.fromString(listingId)).orElseThrow();
        listing.setRejectionReason("Motif admin");
        listing = listings.saveAndFlush(listing);

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"rejectionReason\":\"Motif propriétaire\"}")
                .when().patch("/listings/{id}", listingId)
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"))
                .body("fields.rejectionReason", equalTo("La raison du rejet est réservée à la modération"));

        assertThat(listings.findById(listing.getId()).orElseThrow().getRejectionReason())
                .isEqualTo("Motif admin");
    }


    @Test
    @DisplayName("owner can update and soft-delete a draft listing")
    void updateAndDeleteDraftListing() throws Exception {
        stubToken("uid-update-delete", "update-delete@example.ma", true);
        users.save(new User("uid-update-delete", "update-delete@example.ma", true, "Update Delete"));

        String id = given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"title\":\"Studio initial\",\"city\":\"Casablanca\",\"neighborhood\":\"Maarif\",\"latitude\":33.5731,\"longitude\":-7.5898,\"priceRent\":2200.00}")
                .when().post("/listings")
                .then().statusCode(201)
                .extract().path("id");

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"title\":\"Studio modifié\",\"priceRent\":2600.00}")
                .when().patch("/listings/{id}", id)
                .then().statusCode(200)
                .body("title", equalTo("Studio modifié"))
                .body("priceRent", equalTo(2600.00f));
        given().header("Authorization", "Bearer test-token")
                .when().delete("/listings/{id}", id)
                .then().statusCode(204);

        given().header("Authorization", "Bearer test-token")
                .when().get("/listings/{id}", id)
                .then().statusCode(404);
    }

    @Test
    @DisplayName("deleted listings cannot be submitted")
    void deletedListingCannotBeSubmitted() throws Exception {
        String uid = "uid-submit-deleted-" + System.nanoTime();
        String email = uid + "@example.ma";
        User owner = users.saveAndFlush(new User(uid, email, true, "Submit Deleted"));
        Listing listing = listings.saveAndFlush(new Listing(
                owner, "Studio supprime", "Rabat", "Agdal", 33.9716, -6.8498,
                new BigDecimal("2500.00"), ListingStatus.DRAFT, AvailabilityState.AVAILABLE));
        listing.setDeletedAt(java.time.Instant.now());
        listings.saveAndFlush(listing);
        stubToken(uid, email, true);

        given()
                .when().get("/listings/{id}", listing.getId())
                .then().statusCode(404)
                .body("code", equalTo("NOT_FOUND"));

        assertThatThrownBy(() -> listingSearchService.submit(listing.getId(), owner))
                .isInstanceOf(ma.dari.api.common.error.ApiException.class)
                .hasMessage("Annonce introuvable");
    }

    @Test
    @DisplayName("illegal transitions are rejected with 409")
    void illegalTransitionIsRejected() throws Exception {
        stubToken("uid-illegal-owner", "illegal-owner@example.ma", true);
        User owner = users.save(new User("uid-illegal-owner", "illegal-owner@example.ma", true, "Illegal Owner"));

        Listing listing = listings.saveAndFlush(new Listing(
                owner,
                "Studio ancien",
                "Marrakech",
                "Gueliz",
                31.6300,
                -8.0100,
                new BigDecimal("1500.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        ));

        given().header("Authorization", "Bearer test-token")
                .when().post("/listings/{id}/reopen", listing.getId())
                .then().statusCode(409)
                .body("code", equalTo("ILLEGAL_TRANSITION"));
    }

    @Test
    @DisplayName("submission requires a non-blank description")
    void submissionRequiresDescription() throws Exception {
        stubToken("uid-submit-description", "submit-description@example.ma", true);
        User owner = users.save(new User("uid-submit-description", "submit-description@example.ma", true, "Submit Description"));
        Listing listing = listings.saveAndFlush(new Listing(
                owner, "Studio à décrire", "Rabat", "Agdal", 33.9716, -6.8498,
                new BigDecimal("2500.00"), ListingStatus.DRAFT, AvailabilityState.AVAILABLE));
        listing.setPropertyType(PropertyType.STUDIO);
        listing.setRoomType(RoomType.PRIVATE);
        listing = listings.saveAndFlush(listing);
        listingPhotos.saveAndFlush(new ListingPhoto(listing, "submit-description.jpg", "image/jpeg", 320, 240, 0, true));

        given().header("Authorization", "Bearer submit-description-token")
                .when().post("/listings/{id}/submit", listing.getId())
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"))
                .body("message", equalTo("Description requise"));
    }

    @Test
    @DisplayName("submission requires at least one active photo")
    void submissionRequiresActivePhoto() throws Exception {
        stubToken("uid-submit-photo", "submit-photo@example.ma", true);
        User owner = users.save(new User("uid-submit-photo", "submit-photo@example.ma", true, "Submit Photo"));
        Listing listing = new Listing(
                owner, "Studio avec description", "Rabat", "Agdal", 33.9716, -6.8498,
                new BigDecimal("2500.00"), ListingStatus.DRAFT, AvailabilityState.AVAILABLE);
        listing.setDescription("Une description complète.");
        listing.setPropertyType(PropertyType.STUDIO);
        listing.setRoomType(RoomType.PRIVATE);
        listing = listings.saveAndFlush(listing);

        given().header("Authorization", "Bearer submit-photo-token")
                .when().post("/listings/{id}/submit", listing.getId())
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"))
                .body("message", equalTo("Au moins une photo est requise"));
    }

    @Test
    @DisplayName("valid DRAFT and REJECTED listings enter pending review")
    void draftAndRejectedListingsCanBeSubmitted() throws Exception {
        stubToken("uid-submit-lifecycle", "submit-lifecycle@example.ma", true);
        User owner = users.save(new User("uid-submit-lifecycle", "submit-lifecycle@example.ma", true, "Submit Lifecycle"));

        Listing draft = new Listing(
                owner, "Studio brouillon", "Rabat", "Agdal", 33.9716, -6.8498,
                new BigDecimal("2500.00"), ListingStatus.DRAFT, AvailabilityState.AVAILABLE);
        draft.setDescription("Description du brouillon.");
        draft.setPropertyType(PropertyType.STUDIO);
        draft.setRoomType(RoomType.PRIVATE);
        draft = listings.saveAndFlush(draft);
        listingPhotos.saveAndFlush(new ListingPhoto(draft, "submit-draft.jpg", "image/jpeg", 320, 240, 0, true));

        Listing rejected = new Listing(
                owner, "Studio rejeté", "Rabat", "Agdal", 33.9716, -6.8498,
                new BigDecimal("2500.00"), ListingStatus.REJECTED, AvailabilityState.AVAILABLE);
        rejected.setDescription("Description corrigée.");
        rejected.setPropertyType(PropertyType.STUDIO);
        rejected.setRoomType(RoomType.PRIVATE);
        rejected = listings.saveAndFlush(rejected);
        listingPhotos.saveAndFlush(new ListingPhoto(rejected, "submit-rejected.jpg", "image/jpeg", 320, 240, 0, true));

        given().header("Authorization", "Bearer submit-lifecycle-token")
                .when().post("/listings/{id}/submit", draft.getId())
                .then().statusCode(200)
                .body("status", equalTo("PENDING_REVIEW"));

        given().header("Authorization", "Bearer submit-lifecycle-token")
                .when().post("/listings/{id}/submit", rejected.getId())
                .then().statusCode(200)
                .body("status", equalTo("PENDING_REVIEW"));
    }

    @Test
    @DisplayName("submission requires property and room types")
    void submissionRequiresPropertyAndRoomTypes() throws Exception {
        String uid = "uid-submit-types-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email, true);
        User owner = users.saveAndFlush(new User(uid, email, true, "Submit Types"));
        Listing listing = new Listing(
                owner, "Studio sans type", "Rabat", "Agdal", 33.9716, -6.8498,
                new BigDecimal("2500.00"), ListingStatus.DRAFT, AvailabilityState.AVAILABLE);
        listing.setDescription("Une description complète.");
        listing = listings.saveAndFlush(listing);
        listingPhotos.saveAndFlush(new ListingPhoto(listing, "submit-types.jpg", "image/jpeg", 320, 240, 0, true));

        given().header("Authorization", "Bearer ******")
                .when().post("/listings/{id}/submit", listing.getId())
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"))
                .body("message", equalTo("Type de logement requis"));

        listing.setPropertyType(PropertyType.STUDIO);
        listings.saveAndFlush(listing);

        given().header("Authorization", "Bearer ******")
                .when().post("/listings/{id}/submit", listing.getId())
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"))
                .body("message", equalTo("Type de chambre requis"));
    }

    @Test
    @DisplayName("owner can upload, reorder and delete listing photos")
    void listingPhotoLifecycleWorks() throws Exception {
        String uid = "uid-photo-owner-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email, true);
        User owner = users.save(new User(uid, email, true, "Photo Owner"));

        String listingId = given().header("Authorization", "Bearer fake-token")
                .contentType("application/json")
                .body("{\"title\":\"Studio photo\",\"city\":\"Rabat\",\"neighborhood\":\"Agdal\",\"latitude\":33.9716,\"longitude\":-6.8498,\"priceRent\":2500.00}")
                .when().post("/listings")
                .then().statusCode(201)
                .extract().path("id");

        byte[] imageBytes = generateJpeg(320, 240);
        String photoId = given().header("Authorization", "Bearer fake-token")
                .multiPart("file", "cover.jpg", imageBytes, "image/jpeg")
                .when().post("/listings/{id}/photos", listingId)
                .then().statusCode(201)
                .body("isCover", equalTo(true))
                .body("sortOrder", equalTo(0))
                .extract().path("id");

        given().header("Authorization", "Bearer fake-token")
                .queryParam("sortOrder", 7)
                .when().patch("/listings/{id}/photos/{photoId}", listingId, photoId)
                .then().statusCode(200)
                .body("sortOrder", equalTo(7));

        given().header("Authorization", "Bearer fake-token")
                .when().delete("/listings/{id}/photos/{photoId}", listingId, photoId)
                .then().statusCode(204);
    }

    @Test
    @DisplayName("owner reads their listing photos back in display order")
    void ownerCanReadListingPhotos() throws Exception {
        String uid = "uid-photo-read-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email, true);
        users.save(new User(uid, email, true, "Photo Reader"));

        String listingId = given().header("Authorization", "Bearer fake-token")
                .contentType("application/json")
                .body("{\"title\":\"Studio lecture\",\"city\":\"Rabat\",\"neighborhood\":\"Agdal\",\"latitude\":33.9716,\"longitude\":-6.8498,\"priceRent\":2500.00}")
                .when().post("/listings")
                .then().statusCode(201)
                .extract().path("id");

        // A draft has no public detail response to read photos out of, which is
        // the whole reason this endpoint exists.
        given().header("Authorization", "Bearer fake-token")
                .when().get("/listings/{id}/photos", listingId)
                .then().statusCode(200)
                .body("size()", equalTo(0));

        given().header("Authorization", "Bearer fake-token")
                .multiPart("file", "first.jpg", generateJpeg(320, 240), "image/jpeg")
                .when().post("/listings/{id}/photos", listingId)
                .then().statusCode(201);

        given().header("Authorization", "Bearer fake-token")
                .multiPart("file", "second.jpg", generateJpeg(320, 240), "image/jpeg")
                .when().post("/listings/{id}/photos", listingId)
                .then().statusCode(201);

        given().header("Authorization", "Bearer fake-token")
                .when().get("/listings/{id}/photos", listingId)
                .then().statusCode(200)
                .body("size()", equalTo(2))
                .body("[0].sortOrder", equalTo(0))
                .body("[0].isCover", equalTo(true))
                .body("[1].sortOrder", equalTo(1))
                .body("[1].isCover", equalTo(false))
                .body("[0].url", org.hamcrest.Matchers.startsWith("/uploads/listings/" + listingId));
    }

    @Test
    @DisplayName("an oversized upload returns the French envelope, not a bare 500")
    void oversizedPhotoUploadIsValidationError() throws Exception {
        String uid = "uid-photo-big-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email, true);
        users.save(new User(uid, email, true, "Photo Big"));

        String listingId = given().header("Authorization", "Bearer fake-token")
                .contentType("application/json")
                .body("{\"title\":\"Studio lourd\",\"city\":\"Rabat\",\"neighborhood\":\"Agdal\",\"latitude\":33.9716,\"longitude\":-6.8498,\"priceRent\":2500.00}")
                .when().post("/listings")
                .then().statusCode(201)
                .extract().path("id");

        // Past spring.servlet.multipart.max-file-size, so the container rejects
        // this before any controller runs. The content is deliberately not a real
        // JPEG: the point is that the size guard fires first, and that the owner
        // still gets the documented message instead of INTERNAL_ERROR.
        byte[] tooBig = new byte[7 * 1024 * 1024];

        given().header("Authorization", "Bearer fake-token")
                .multiPart("file", "huge.jpg", tooBig, "image/jpeg")
                .when().post("/listings/{id}/photos", listingId)
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"))
                .body("message", equalTo("La photo doit faire moins de 5 Mo"));
    }

    @Test
    @DisplayName("owner-scoped listing reads are gated by the security chain, not only by @CurrentUser")
    void ownerScopedListingReadsRejectAnonymousCallers() {
        // These sit under the public GET /api/v1/listings/** rule. Before the
        // matcher order was fixed they were reachable by the chain and stopped
        // only by the argument resolver, so the project's "role checks are
        // doubled" invariant held on paper but not on these routes.
        // The WWW-Authenticate header is the discriminator: only the chain's
        // entry point sets it. CurrentUserArgumentResolver returns a 401 with an
        // identical body, so asserting the status and code alone would pass with
        // the matcher fix reverted -- verified by doing exactly that.
        for (String path : new String[] {"/listings/mine", "/listings/draft"}) {
            given().when().get(path)
                    .then().statusCode(401)
                    .header("WWW-Authenticate", "Bearer")
                    .body("code", equalTo("UNAUTHENTICATED"));
        }

        given().when().get("/listings/{id}/photos", UUID.randomUUID())
                .then().statusCode(401)
                .header("WWW-Authenticate", "Bearer")
                .body("code", equalTo("UNAUTHENTICATED"));
    }

    @Test
    @DisplayName("the public read surface stays anonymous after the matcher reorder")
    void publicListingReadsRemainAnonymous() {
        // The regression that would matter more than the bug being fixed: search
        // and listing detail must stay crawlable without a token.
        given().when().get("/listings").then().statusCode(200);
        given().when().get("/listings/map").then().statusCode(200);
        given().when().get("/listings/featured").then().statusCode(200);
        given().when().get("/amenities").then().statusCode(200);
        given().when().get("/cities").then().statusCode(200);

        // A detail read for an unknown id is a 404 from the service, not a 401
        // from the chain -- which is what proves it was let through.
        given().when().get("/listings/{id}", UUID.randomUUID()).then().statusCode(404);
    }

    @Test
    @DisplayName("the owner edit read returns true coordinates, unlike the fuzzed public detail")
    void ownerEditReadReturnsTrueCoordinates() throws Exception {
        String uid = "uid-edit-read-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email, true);
        User owner = users.saveAndFlush(new User(uid, email, true, "Edit Reader"));

        Listing listing = new Listing(
                owner, "Studio à modifier", "Rabat", "Agdal", 33.9716, -6.8498,
                new BigDecimal("2500.00"), ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE);
        listing.setDescription("Description publiée.");
        listing = listings.saveAndFlush(listing);

        // The whole reason this endpoint exists: an edit form fed by the public
        // detail response would PATCH fuzzed coordinates back and move the
        // listing a little further from reality on every save.
        given().header("Authorization", "Bearer edit-read-token")
                .when().get("/listings/mine/{id}", listing.getId())
                .then().statusCode(200)
                .body("latitude", equalTo(33.9716f))
                .body("longitude", equalTo(-6.8498f));

        given().when().get("/listings/{id}", listing.getId())
                .then().statusCode(200)
                .body("latitude", org.hamcrest.Matchers.not(equalTo(33.9716f)));
    }

    @Test
    @DisplayName("a non-owner cannot read someone else's listing through the edit endpoint")
    void ownerEditReadIsScopedToTheOwner() throws Exception {
        String ownerUid = "uid-edit-owner-" + System.nanoTime();
        User owner = users.saveAndFlush(new User(ownerUid, ownerUid + "@example.ma", true, "Owner"));
        Listing listing = listings.saveAndFlush(new Listing(
                owner, "Studio privé", "Rabat", "Agdal", 33.9716, -6.8498,
                new BigDecimal("2500.00"), ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE));

        String otherUid = "uid-edit-other-" + System.nanoTime();
        stubToken(otherUid, otherUid + "@example.ma", true);
        users.saveAndFlush(new User(otherUid, otherUid + "@example.ma", true, "Other"));

        given().header("Authorization", "Bearer other-token")
                .when().get("/listings/mine/{id}", listing.getId())
                .then().statusCode(404);

        given().when().get("/listings/mine/{id}", listing.getId())
                .then().statusCode(401)
                .header("WWW-Authenticate", "Bearer");
    }

    @Test
    @DisplayName("editing a published listing returns it to review; editing a draft does not")
    void editingPublishedListingReturnsItToReview() throws Exception {
        String uid = "uid-edit-review-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email, true);
        User owner = users.saveAndFlush(new User(uid, email, true, "Edit Review"));

        Listing published = new Listing(
                owner, "Studio publié", "Rabat", "Agdal", 33.9716, -6.8498,
                new BigDecimal("2500.00"), ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE);
        published.setDescription("Description initiale.");
        published = listings.saveAndFlush(published);

        given().header("Authorization", "Bearer edit-review-token")
                .contentType("application/json")
                .body("{\"title\":\"Studio publié et corrigé\"}")
                .when().patch("/listings/{id}", published.getId())
                .then().statusCode(200)
                .body("status", equalTo("PENDING_REVIEW"));

        assertThat(listings.findById(published.getId()).orElseThrow().getStatus())
                .isEqualTo(ListingStatus.PENDING_REVIEW);

        // A draft must not be swept into the queue: the create wizard PATCHes on
        // every step, so this would submit listings the owner never published.
        Listing draft = listings.saveAndFlush(new Listing(
                owner, "Studio brouillon", "Rabat", "Agdal", 33.9716, -6.8498,
                new BigDecimal("2500.00"), ListingStatus.DRAFT, AvailabilityState.AVAILABLE));

        given().header("Authorization", "Bearer edit-review-token")
                .contentType("application/json")
                .body("{\"title\":\"Brouillon modifié\"}")
                .when().patch("/listings/{id}", draft.getId())
                .then().statusCode(200)
                .body("status", equalTo("DRAFT"));
    }

    @Test
    @DisplayName("price sorts actually order by price, in both directions")
    void priceSortsOrderByPrice() throws Exception {
        String uid = "uid-sort-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email, true);
        User owner = users.saveAndFlush(new User(uid, email, true, "Sort Owner"));

        // A city of its own, so other test classes' listings cannot interleave.
        String city = "TriVille" + System.nanoTime();
        for (String price : new String[] {"4000.00", "1000.00", "7000.00"}) {
            listings.saveAndFlush(new Listing(
                    owner, "Studio " + price, city, "Centre", 33.9716, -6.8498,
                    new java.math.BigDecimal(price), ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE));
        }

        var ascending = given().queryParam("city", city).queryParam("sort", "priceasc")
                .when().get("/listings")
                .then().statusCode(200)
                .extract().jsonPath().getList("items.priceRent", Float.class);

        var descending = given().queryParam("city", city).queryParam("sort", "pricedesc")
                .when().get("/listings")
                .then().statusCode(200)
                .extract().jsonPath().getList("items.priceRent", Float.class);

        // Before this, sort was parsed and then ignored on the non-radius path:
        // every one of these returned the same recency ordering.
        assertThat(ascending).containsExactly(1000f, 4000f, 7000f);
        assertThat(descending).containsExactly(7000f, 4000f, 1000f);
    }

    @Test
    @DisplayName("a cursor from one sort does not silently corrupt another")
    void cursorIsScopedToItsSort() throws Exception {
        String uid = "uid-cursor-sort-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email, true);
        User owner = users.saveAndFlush(new User(uid, email, true, "Cursor Owner"));

        String city = "CurseurVille" + System.nanoTime();
        for (int i = 0; i < 25; i++) {
            listings.saveAndFlush(new Listing(
                    owner, "Studio " + i, city, "Centre", 33.9716, -6.8498,
                    new java.math.BigDecimal(1000 + i * 100), ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE));
        }

        String cursor = given().queryParam("city", city).queryParam("sort", "priceasc")
                .when().get("/listings")
                .then().statusCode(200)
                .body("hasMore", equalTo(true))
                .extract().path("nextCursor");

        // Same cursor, different sort. Resuming it against a date ordering would
        // skip or repeat rows; the sort travels in the cursor so the mismatch
        // restarts cleanly instead of returning a quietly wrong page.
        var restarted = given().queryParam("city", city).queryParam("sort", "pricedesc")
                .queryParam("cursor", cursor)
                .when().get("/listings")
                .then().statusCode(200)
                .extract().jsonPath().getList("items.priceRent", Float.class);

        assertThat(restarted).isNotEmpty();
        assertThat(restarted.get(0)).isEqualTo(3400f);
    }

    @Test
    @DisplayName("a distance sort without a radius is refused rather than silently ignored")
    void distanceSortRequiresRadius() {
        given().queryParam("city", "Rabat").queryParam("sort", "closest")
                .when().get("/listings")
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("search count is exact below the cap and reports itself capped above it")
    void searchCountIsCapped() throws Exception {
        String uid = "uid-count-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email, true);
        User owner = users.saveAndFlush(new User(uid, email, true, "Count Owner"));

        String smallCity = "PetiteVille" + System.nanoTime();
        for (int i = 0; i < 3; i++) {
            listings.saveAndFlush(new Listing(
                    owner, "Studio " + i, smallCity, "Centre", 33.9716, -6.8498,
                    new java.math.BigDecimal("2500.00"), ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE));
        }

        given().queryParam("city", smallCity)
                .when().get("/listings/count")
                .then().statusCode(200)
                .body("count", equalTo(3))
                .body("capped", equalTo(false));

        // Filters compose the same way they do for the results themselves; a
        // count that disagreed with the list it labels would be worse than none.
        given().queryParam("city", smallCity).queryParam("priceMin", 9000)
                .when().get("/listings/count")
                .then().statusCode(200)
                .body("count", equalTo(0));

        String bigCity = "GrandeVille" + System.nanoTime();
        for (int i = 0; i < 205; i++) {
            listings.saveAndFlush(new Listing(
                    owner, "Studio " + i, bigCity, "Centre", 33.9716, -6.8498,
                    new java.math.BigDecimal("2500.00"), ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE));
        }

        given().queryParam("city", bigCity)
                .when().get("/listings/count")
                .then().statusCode(200)
                .body("count", equalTo(200))
                .body("capped", equalTo(true));
    }

    @Test
    @DisplayName("stored photos are readable without a token, because an img tag sends none")
    void uploadedMediaIsPubliclyReadable() throws Exception {
        String uid = "uid-media-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email, true);
        users.saveAndFlush(new User(uid, email, true, "Media Owner"));

        String listingId = given().header("Authorization", "Bearer media-token")
                .contentType("application/json")
                .body("{\"title\":\"Studio media\",\"city\":\"Rabat\",\"neighborhood\":\"Agdal\",\"latitude\":33.9716,\"longitude\":-6.8498,\"priceRent\":2500.00}")
                .when().post("/listings")
                .then().statusCode(201)
                .extract().path("id");

        String url = given().header("Authorization", "Bearer media-token")
                .multiPart("file", "cover.jpg", generateJpeg(320, 240), "image/jpeg")
                .when().post("/listings/{id}/photos", listingId)
                .then().statusCode(201)
                .extract().path("url");

        // The security chain protects /api/v1/**; the resource handler serving
        // /uploads/** sat behind anyRequest().authenticated(), so every photo on
        // every public listing page returned 401. Browsers do not attach a
        // bearer token to an image request, so this could never have worked.
        given().basePath("").when().get(url)
                .then().statusCode(200);
    }

    @Test
    @DisplayName("search results carry the cover photo, and listings without one return null")
    void searchResultsCarryCoverPhoto() throws Exception {
        String uid = "uid-cover-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email, true);
        User owner = users.saveAndFlush(new User(uid, email, true, "Cover Owner"));

        String city = "CouvertureVille" + System.nanoTime();
        Listing withPhoto = listings.saveAndFlush(new Listing(
                owner, "Avec photo", city, "Centre", 33.9716, -6.8498,
                new BigDecimal("2500.00"), ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE));
        Listing withoutPhoto = listings.saveAndFlush(new Listing(
                owner, "Sans photo", city, "Centre", 33.9716, -6.8498,
                new BigDecimal("2600.00"), ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE));

        listingPhotos.saveAndFlush(new ListingPhoto(withPhoto, "cover-key.jpg", "image/jpeg", 800, 600, 0, true));
        // A non-cover photo must not be picked up as the card image.
        listingPhotos.saveAndFlush(new ListingPhoto(withPhoto, "second.jpg", "image/jpeg", 800, 600, 1, false));

        var byTitle = given().queryParam("city", city)
                .when().get("/listings")
                .then().statusCode(200)
                .extract().jsonPath();

        var titles = byTitle.getList("items.title", String.class);
        var covers = byTitle.getList("items.coverPhotoUrl", String.class);
        int withIdx = titles.indexOf("Avec photo");
        int withoutIdx = titles.indexOf("Sans photo");

        assertThat(withIdx).isGreaterThanOrEqualTo(0);
        assertThat(covers.get(withIdx)).isEqualTo("/uploads/cover-key.jpg");
        // A missing cover is null rather than a fabricated placeholder path.
        assertThat(covers.get(withoutIdx)).isNull();

        assertThat(withoutPhoto.getId()).isNotNull();
    }

    @Test
    @DisplayName("photo PATCH sort order DTO rejects negative values")
    void photoPatchSortOrderDtoRejectsNegativeValues() {
        assertThat(validator.validate(new UpdateListingPhotoRequest(-1, null)))
                .anyMatch(violation -> violation.getPropertyPath().toString().equals("sortOrder"));
    }

    @Test
    @DisplayName("typed query parameters return validation errors instead of 500s")
    void malformedTypedQueryParameterIsValidationError() {
        given()
                .queryParam("limit", "not-a-number")
                .when().get("/listings/featured")
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"))
                .body("message", equalTo("Données invalides"))
                .body("fields.limit", equalTo("Valeur invalide"));
    }

    private byte[] generateJpeg(int width, int height) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, width, height);
            graphics.setColor(new Color(125, 75, 50));
            graphics.fillRect(20, 20, width - 40, height - 40);
        } finally {
            graphics.dispose();
        }

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ImageIO.write(image, "jpg", out);
            return out.toByteArray();
        } catch (Exception ex) {
            throw new IllegalStateException("Could not generate test image", ex);
        }
    }

    @Test
    @DisplayName("GET /listings/mine returns every status the owner has, not just what search would show")
    void mineReturnsAllStatusesForOwner() throws Exception {
        User owner = users.save(new User("uid-owner-mine", "owner.mine@example.ma", true, "Owner"));
        User otherOwner = users.save(new User("uid-owner-mine-2", "owner.mine2@example.ma", true, "Other"));

        listings.saveAndFlush(new Listing(owner, "Brouillon", "Rabat", "Agdal", 33.9716, -6.8498,
                new BigDecimal("2000.00"), ListingStatus.DRAFT, AvailabilityState.AVAILABLE));
        listings.saveAndFlush(new Listing(owner, "Publiée", "Rabat", "Agdal", 33.9716, -6.8498,
                new BigDecimal("2200.00"), ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE));
        listings.saveAndFlush(new Listing(otherOwner, "Annonce d'un autre propriétaire", "Rabat", "Agdal", 33.9716, -6.8498,
                new BigDecimal("2400.00"), ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE));

        stubToken("uid-owner-mine", "owner.mine@example.ma", true);

        given().header("Authorization", "Bearer test-token")
                .when().get("/listings/mine")
                .then().statusCode(200)
                .body("items.size()", equalTo(2))
                .body("items.title", org.hamcrest.Matchers.hasItems("Brouillon", "Publiée"));
    }

    @Test
    @DisplayName("an admin can view someone else's pending-review listing, unlike a regular visitor")
    void adminCanViewNonPublicListingOfAnotherUser() throws Exception {
        User owner = users.save(new User("uid-owner-admin-view", "owner.admin.view@example.ma", true, "Owner"));
        User admin = new User("uid-admin-view", "admin.view@example.ma", true, "Admin");
        admin.setRole(UserRole.ADMIN);
        users.save(admin);

        Listing pending = listings.saveAndFlush(new Listing(owner, "En attente de revue", "Rabat", "Agdal",
                33.9716, -6.8498, new BigDecimal("2100.00"), ListingStatus.PENDING_REVIEW, AvailabilityState.AVAILABLE));

        stubToken("uid-admin-view", "admin.view@example.ma", true);
        given().header("Authorization", "Bearer test-token")
                .when().get("/listings/" + pending.getId())
                .then().statusCode(200)
                .body("title", equalTo("En attente de revue"));

        stubToken("uid-owner-admin-view", "owner.admin.view@example.ma", true);
        given().header("Authorization", "Bearer owner-token")
                .when().get("/listings/" + pending.getId())
                .then().statusCode(200);
    }

    @Test
    @DisplayName("owner can attach amenities on create and replace them on update")
    void amenitiesRoundTripOnCreateAndUpdate() throws Exception {
        stubToken("uid-amenities-owner", "amenities-owner@example.ma", true);
        users.save(new User("uid-amenities-owner", "amenities-owner@example.ma", true, "Amenities Owner"));

        String id = given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"title\":\"Studio équipé\",\"city\":\"Rabat\",\"neighborhood\":\"Agdal\","
                        + "\"latitude\":33.9716,\"longitude\":-6.8498,\"priceRent\":2500.00,"
                        + "\"amenityCodes\":[\"wifi\",\"parking\"]}")
                .when().post("/listings")
                .then().statusCode(201)
                .body("amenityCodes", org.hamcrest.Matchers.containsInAnyOrder("wifi", "parking"))
                .extract().path("id");

        given().header("Authorization", "Bearer test-token")
                .when().get("/listings/mine")
                .then().statusCode(200)
                .body("items.find { it.id == '" + id + "' }.amenityCodes",
                        org.hamcrest.Matchers.containsInAnyOrder("wifi", "parking"));

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"amenityCodes\":[\"balcony\"]}")
                .when().patch("/listings/{id}", id)
                .then().statusCode(200)
                .body("amenityCodes", org.hamcrest.Matchers.contains("balcony"));

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"amenityCodes\":[\"not-a-real-amenity\"]}")
                .when().patch("/listings/{id}", id)
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"));
    }
}
