package ma.dari.api.common.pagination;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Opaque keyset cursor.
 *
 * <p>Keyset, never OFFSET: listings are inserted constantly, and offset paging
 * silently duplicates and drops rows while the user scrolls.
 *
 * <p>The payload is opaque to clients on purpose — its shape differs per sort
 * (a timestamp for recency, a distance plus a reference point for proximity),
 * and freezing it into the public API would make adding a sort a breaking
 * change. Clients pass it back verbatim and read nothing out of it.
 *
 * <p>It is Base64URL of JSON, not encrypted. Assume anyone can read it, and
 * therefore never put a private value — an exact coordinate above all — inside.
 */
public final class Cursor {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private Cursor() {
    }

    public static String encode(ObjectNode payload) {
        try {
            byte[] json = MAPPER.writeValueAsBytes(payload);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(json);
        } catch (Exception e) {
            throw new IllegalStateException("Cursor encoding failed", e);
        }
    }

    /** Malformed cursors are a 400, not a 500 — they arrive from the open internet. */
    public static ObjectNode decode(String cursor) {
        try {
            byte[] json = Base64.getUrlDecoder().decode(cursor);
            return (ObjectNode) MAPPER.readTree(new String(json, StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new ApiException(400, ErrorCode.INVALID_CURSOR, "Pagination invalide");
        }
    }

    public static ObjectNode newPayload() {
        return MAPPER.createObjectNode();
    }
}
