package ma.dari.api.common.pagination;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.UUID;

/** Endpoint-owned cursor decoders. Cursor payloads remain opaque on the wire. */
public final class TypedCursors {

    private TypedCursors() {
    }

    public static ConversationCursor conversation(String encoded) {
        ObjectNode payload = requiredPayload(encoded);
        requireText(payload, "mode", "conversations");
        return new ConversationCursor(requiredInstant(payload, "lastCreatedAt"), requiredUuid(payload, "lastId"));
    }

    public static MessageCursor message(String encoded) {
        return message(encoded, null);
    }

    public static MessageCursor message(String encoded, UUID expectedConversationId) {
        ObjectNode payload = requiredPayload(encoded);
        if (expectedConversationId != null) requireText(payload, "conversationId", expectedConversationId.toString());
        requireText(payload, "mode", "messages");
        return new MessageCursor(requiredInstant(payload, "lastSentAt"), requiredUuid(payload, "lastId"));
    }

    public static FavoriteCursor favorite(String encoded) {
        ObjectNode payload = requiredPayload(encoded);
        requireText(payload, "mode", "favorites");
        return new FavoriteCursor(requiredInstant(payload, "lastCreatedAt"), requiredUuid(payload, "lastListingId"));
    }

    public static AdminCursor admin(String encoded) {
        return admin(encoded, null);
    }

    public static AdminCursor admin(String encoded, String expectedQueryKey) {
        ObjectNode payload = requiredPayload(encoded);
        requireText(payload, "mode", "admin-users");
        if (expectedQueryKey != null) requireText(payload, "queryKey", expectedQueryKey);
        return new AdminCursor(requiredInstant(payload, "lastCreatedAt"), requiredUuid(payload, "lastId"));
    }

    public static OwnerCursor ownerListing(String encoded) {
        ObjectNode payload = requiredPayload(encoded);
        requireText(payload, "mode", "owner-listings");
        return new OwnerCursor(requiredInstant(payload, "lastCreatedAt"), requiredUuid(payload, "lastId"));
    }

    public static SearchCursor search(String encoded, String expectedQueryKey, String expectedSort, boolean radius) {
        ObjectNode payload = requiredPayload(encoded);
        String expectedMode = radius ? "radius" : "location";
        requireText(payload, "mode", expectedMode);
        requireText(payload, "sort", expectedSort);
        requireText(payload, "queryKey", expectedQueryKey);
        UUID lastId = requiredUuid(payload, "lastId");
        if (radius) {
            return new SearchCursor(payload.get("queryKey").asText(), expectedMode, expectedSort, lastId,
                    requiredDecimal(payload, "lastDistance"), null, null, null);
        }
        BigDecimal lastPrice = optionalDecimal(payload, "lastPrice");
        Instant lastCreatedAt = optionalInstant(payload, "lastCreatedAt");
        Instant lastUpdatedAt = optionalInstant(payload, "lastUpdatedAt");
        if ("priceasc".equals(expectedSort) || "pricedesc".equals(expectedSort)) {
            if (lastPrice == null) throw invalid("lastPrice");
        } else if ("updated".equals(expectedSort)) {
            if (lastUpdatedAt == null) throw invalid("lastUpdatedAt");
        } else if (lastCreatedAt == null) {
            throw invalid("lastCreatedAt");
        }
        return new SearchCursor(payload.get("queryKey").asText(), expectedMode, expectedSort, lastId,
                null, lastPrice, lastCreatedAt, lastUpdatedAt);
    }

    public static ObjectNode requiredPayload(String encoded) {
        if (encoded == null || encoded.isBlank()) throw invalid("cursor");
        return Cursor.decode(encoded);
    }

    public static String requiredText(ObjectNode payload, String field) {
        JsonNode value = payload.get(field);
        if (value == null || !value.isTextual() || value.asText().isBlank()) throw invalid(field);
        return value.asText();
    }

    private static void requireText(ObjectNode payload, String field, String expected) {
        if (!expected.equals(requiredText(payload, field))) throw invalid(field);
    }

    public static UUID requiredUuid(ObjectNode payload, String field) {
        String value = requiredText(payload, field);
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            throw invalid(field);
        }
    }

    public static Instant requiredInstant(ObjectNode payload, String field) {
        String value = requiredText(payload, field);
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException e) {
            throw invalid(field);
        }
    }

    private static Instant optionalInstant(ObjectNode payload, String field) {
        JsonNode value = payload.get(field);
        if (value == null || value.isNull()) return null;
        if (!value.isTextual()) throw invalid(field);
        try {
            return Instant.parse(value.asText());
        } catch (DateTimeParseException e) {
            throw invalid(field);
        }
    }

    public static BigDecimal requiredDecimal(ObjectNode payload, String field) {
        String value = requiredText(payload, field);
        try {
            BigDecimal decimal = new BigDecimal(value);
            if (!decimal.toString().equals(value) && !decimal.stripTrailingZeros().toPlainString().equals(value)) {
                throw invalid(field);
            }
            return decimal;
        } catch (NumberFormatException e) {
            throw invalid(field);
        }
    }

    private static BigDecimal optionalDecimal(ObjectNode payload, String field) {
        JsonNode value = payload.get(field);
        if (value == null || value.isNull()) return null;
        if (!value.isTextual()) throw invalid(field);
        try {
            return new BigDecimal(value.asText());
        } catch (NumberFormatException e) {
            throw invalid(field);
        }
    }

    private static ApiException invalid(String field) {
        return new ApiException(400, ErrorCode.INVALID_CURSOR, "Pagination invalide");
    }

    public record ConversationCursor(Instant lastCreatedAt, UUID lastId) {
    }

    public record MessageCursor(Instant lastSentAt, UUID lastId) {
    }

    public record FavoriteCursor(Instant lastCreatedAt, UUID lastListingId) {
    }

    public record AdminCursor(Instant lastCreatedAt, UUID lastId) {
    }

    public record OwnerCursor(Instant lastCreatedAt, UUID lastId) {
    }

    public record SearchCursor(String queryKey, String mode, String sort, UUID lastId,
                               BigDecimal lastDistance, BigDecimal lastPrice,
                               Instant lastCreatedAt, Instant lastUpdatedAt) {
    }
}
