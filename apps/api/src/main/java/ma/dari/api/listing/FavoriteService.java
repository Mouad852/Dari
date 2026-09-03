package ma.dari.api.listing;

import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import ma.dari.api.common.pagination.Cursor;
import ma.dari.api.common.pagination.CursorPage;
import ma.dari.api.listing.dto.ListingPhotoResponse;
import ma.dari.api.user.User;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class FavoriteService {

    private static final int PAGE_SIZE = 20;

    private final FavoriteRepository favorites;
    private final ListingRepository listings;
    private final ListingPhotoRepository listingPhotos;

    public FavoriteService(FavoriteRepository favorites, ListingRepository listings,
                           ListingPhotoRepository listingPhotos) {
        this.favorites = favorites;
        this.listings = listings;
        this.listingPhotos = listingPhotos;
    }

    /**
     * Reads {@code listings} directly rather than the {@code published_listings}
     * view — a favorite that leaves AVAILABLE stays in the list, marked
     * unavailable, rather than vanishing. Only a soft-deleted listing is dropped.
     */
    @Transactional(readOnly = true)
    public CursorPage<PublicListingResponse> list(User user, String cursor) {
        var payload = cursor == null ? null : Cursor.decode(cursor);
        Instant lastCreatedAt = payload == null || !payload.has("lastCreatedAt") || payload.get("lastCreatedAt").isNull()
                ? null : Instant.parse(payload.get("lastCreatedAt").asText());
        UUID lastListingId = payload == null || !payload.has("lastListingId") || payload.get("lastListingId").isNull()
                ? null : UUID.fromString(payload.get("lastListingId").asText());

        List<Favorite> rows = lastCreatedAt == null && lastListingId == null
                ? favorites.findVisibleByUser(user.getId(), PageRequest.of(0, PAGE_SIZE + 1))
                : favorites.findVisibleByUserAfter(user.getId(), lastCreatedAt, lastListingId, PageRequest.of(0, PAGE_SIZE + 1));

        boolean hasMore = rows.size() > PAGE_SIZE;
        List<Favorite> pageRows = hasMore ? rows.subList(0, PAGE_SIZE) : rows;
        // One query for the whole page's covers, not one per favorite.
        java.util.Map<UUID, String> covers = new java.util.HashMap<>();
        if (!pageRows.isEmpty()) {
            List<UUID> listingIds = pageRows.stream().map(f -> f.getListing().getId()).toList();
            for (ListingPhoto photo : listingPhotos.findByListingIdInAndCoverTrueAndDeletedAtIsNull(listingIds)) {
                covers.put(photo.getListing().getId(), ListingPhotoResponse.from(photo).url());
            }
        }

        List<PublicListingResponse> items = pageRows.stream()
                .map(f -> PublicListingResponse.from(f.getListing(),
                        LocationFuzzer.fuzz(f.getListing().getId(), f.getListing().getLatitude(), f.getListing().getLongitude()),
                        covers.get(f.getListing().getId())))
                .toList();

        String nextCursor = null;
        if (hasMore && !pageRows.isEmpty()) {
            Favorite last = pageRows.get(pageRows.size() - 1);
            var payloadOut = Cursor.newPayload();
            payloadOut.put("lastCreatedAt", last.getCreatedAt().toString());
            payloadOut.put("lastListingId", last.getListing().getId().toString());
            nextCursor = Cursor.encode(payloadOut);
        }

        return CursorPage.of(items, nextCursor);
    }

    /** Unfiltered by listing status: a stale favorite still counts as "favorited" until removed. */
    @Transactional(readOnly = true)
    public List<UUID> favoritedListingIds(User user) {
        return favorites.findListingIdsByUserId(user.getId());
    }

    /**
     * Idempotent: a repeated tap is a no-op, whether caught by the check below
     * or — under a race between two rapid taps — by the composite primary key
     * rejecting the second insert.
     */
    @Transactional
    public void add(User user, UUID listingId) {
        if (favorites.findByUserIdAndListingId(user.getId(), listingId).isPresent()) {
            return;
        }

        Listing listing = listings.findByIdAndDeletedAtIsNull(listingId)
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));

        try {
            favorites.save(new Favorite(user, listing));
        } catch (DataIntegrityViolationException alreadyFavorited) {
            // Lost the race to a concurrent identical request; the row exists, which is the goal.
        }
    }

    /** Idempotent: un-favoriting something that was never favorited is a no-op. */
    @Transactional
    public void remove(User user, UUID listingId) {
        favorites.findByUserIdAndListingId(user.getId(), listingId)
                .ifPresent(favorites::delete);
    }
}
