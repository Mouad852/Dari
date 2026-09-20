package ma.dari.api.common.pagination;

import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TypedCursorsTest {
    @Test
    void rejectsInvalidUuidAndDateFields() {
        var payload = Cursor.newPayload();
        payload.put("mode", "location");
        payload.put("sort", "recommended");
        payload.put("queryKey", "q");
        payload.put("lastId", "not-a-uuid");
        payload.put("lastCreatedAt", "not-a-date");
        assertInvalid(() -> TypedCursors.search(Cursor.encode(payload), "q", "recommended", false));

        payload.put("lastId", UUID.randomUUID().toString());
        assertInvalid(() -> TypedCursors.search(Cursor.encode(payload), "q", "recommended", false));
    }

    @Test
    void rejectsInvalidPriceDistanceAndChangedSearch() {
        var location = Cursor.newPayload();
        location.put("mode", "location");
        location.put("sort", "priceasc");
        location.put("queryKey", "q");
        location.put("lastId", UUID.randomUUID().toString());
        location.put("lastPrice", "not-a-price");
        assertInvalid(() -> TypedCursors.search(Cursor.encode(location), "q", "priceasc", false));

        var radius = Cursor.newPayload();
        radius.put("mode", "radius");
        radius.put("sort", "closest");
        radius.put("queryKey", "q");
        radius.put("lastId", UUID.randomUUID().toString());
        radius.put("lastDistance", "not-a-distance");
        assertInvalid(() -> TypedCursors.search(Cursor.encode(radius), "q", "closest", true));
        assertInvalid(() -> TypedCursors.search(Cursor.encode(radius), "different", "closest", true));
    }

    private static void assertInvalid(Runnable action) {
        assertThatThrownBy(() -> action.run()).isInstanceOf(ApiException.class)
                .satisfies(error -> {
                    ApiException api = (ApiException) error;
                    assertThat(api.status()).isEqualTo(400);
                    assertThat(api.code()).isEqualTo(ErrorCode.INVALID_CURSOR);
                });
    }
}
