package ma.dari.api.listing;

import com.google.firebase.auth.FirebaseToken;
import io.restassured.path.json.JsonPath;
import ma.dari.api.support.AbstractIntegrationTest;
import ma.dari.api.user.User;
import ma.dari.api.user.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * The owner dashboard loads amenities, house rules and rooms for a whole page
 * in three queries (audit P2-9). What matters is that each listing still gets
 * its own: nothing from a neighbour, and empty extras where it has none.
 */
class ListingExtrasApiTest extends AbstractIntegrationTest {

    @Autowired
    UserRepository users;

    private void create(String body) {
        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"city\":\"Rabat\",\"neighborhood\":\"Agdal\",\"latitude\":33.9716,\"longitude\":-6.8498,"
                        + "\"priceRent\":2500," + body + "}")
                .when().post("/listings")
                .then().statusCode(201);
    }

    @Test
    @DisplayName("each listing on the dashboard keeps its own amenities, house rules and rooms")
    void dashboardExtrasStayWithTheirListing() throws Exception {
        String uid = "uid-extras-" + System.nanoTime();
        users.save(new User(uid, uid + "@example.ma", true, "Extras Owner"));
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn(uid);
        Mockito.when(token.getEmail()).thenReturn(uid + "@example.ma");
        Mockito.when(token.isEmailVerified()).thenReturn(true);
        Mockito.when(firebaseAuth.verifyIdToken(Mockito.anyString())).thenReturn(token);

        create("\"title\":\"Extras A\",\"amenityCodes\":[\"wifi\",\"parking\"],"
                + "\"houseRules\":{\"smokingAllowed\":false},"
                + "\"rooms\":[{\"roomType\":\"BEDROOM\",\"isRentable\":true,\"isShared\":false,\"description\":\"A1\"},"
                + "{\"roomType\":\"SALON\",\"isRentable\":false,\"isShared\":true,\"description\":\"A2\"}]");
        create("\"title\":\"Extras B\",\"amenityCodes\":[\"balcony\"],"
                + "\"rooms\":[{\"roomType\":\"BEDROOM\",\"isRentable\":true,\"isShared\":false,\"description\":\"B1\"}]");
        create("\"title\":\"Extras C\"");

        JsonPath mine = given().header("Authorization", "Bearer test-token")
                .when().get("/listings/mine")
                .then().statusCode(200)
                .extract().jsonPath();
        List<Map<String, Object>> items = mine.getList("items");
        assertThat(items).hasSize(3);

        Map<String, Object> a = byTitle(items, "Extras A");
        assertThat(strings(a.get("amenityCodes"))).containsExactlyInAnyOrder("wifi", "parking");
        assertThat(((Map<?, ?>) a.get("houseRules")).get("smokingAllowed")).isEqualTo(false);
        assertThat(roomDescriptions(a)).containsExactly("A1", "A2");

        Map<String, Object> b = byTitle(items, "Extras B");
        assertThat(strings(b.get("amenityCodes"))).containsExactly("balcony");
        assertThat(b.get("houseRules")).isNull();
        assertThat(roomDescriptions(b)).containsExactly("B1");

        Map<String, Object> c = byTitle(items, "Extras C");
        assertThat(strings(c.get("amenityCodes"))).isEmpty();
        assertThat(c.get("houseRules")).isNull();
        assertThat(strings(c.get("rooms"))).isEmpty();
    }

    private static Map<String, Object> byTitle(List<Map<String, Object>> items, String title) {
        return items.stream().filter(item -> title.equals(item.get("title"))).findFirst().orElseThrow();
    }

    private static List<String> strings(Object list) {
        return ((List<?>) list).stream().map(String::valueOf).toList();
    }

    @SuppressWarnings("unchecked")
    private static List<Object> roomDescriptions(Map<String, Object> item) {
        return ((List<Map<String, Object>>) item.get("rooms")).stream().map(room -> room.get("description")).toList();
    }
}
