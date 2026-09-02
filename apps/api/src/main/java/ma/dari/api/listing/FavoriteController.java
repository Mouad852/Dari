package ma.dari.api.listing;

import ma.dari.api.common.auth.CurrentUser;
import ma.dari.api.common.pagination.CursorPage;
import ma.dari.api.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Favorites (phase 09). Lives in the listing package because it is a projection
 * of listings, not a feature of its own.
 */
@RestController
@RequestMapping("/api/v1/favorites")
public class FavoriteController {

    private final FavoriteService favoriteService;

    public FavoriteController(FavoriteService favoriteService) {
        this.favoriteService = favoriteService;
    }

    /**
     * Reads the {@code listings} table rather than the {@code published_listings}
     * view — one of only two legitimate exceptions, alongside conversation
     * context. A favorite that becomes ROOM_FOUND, SUSPENDED or EXPIRED stays
     * in the list marked unavailable; soft-deleted ones are dropped entirely.
     */
    @GetMapping
    public CursorPage<PublicListingResponse> list(@CurrentUser User user,
                                                @RequestParam(required = false) String cursor) {
        return favoriteService.list(user, cursor);
    }

    /**
     * Just the ids, unpaginated — for a client that needs to know "is this one
     * favorited?" across a page of results or a single listing, without paying
     * for the full {@link PublicListingResponse} shape or a cursor.
     */
    @GetMapping("/ids")
    public List<UUID> ids(@CurrentUser User user) {
        return favoriteService.favoritedListingIds(user);
    }

    /** Idempotent: the composite primary key makes a double-tap harmless. */
    @PostMapping("/{listingId}")
    public ResponseEntity<Void> add(@CurrentUser User user, @PathVariable UUID listingId) {
        favoriteService.add(user, listingId);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @DeleteMapping("/{listingId}")
    public ResponseEntity<Void> remove(@CurrentUser User user, @PathVariable UUID listingId) {
        favoriteService.remove(user, listingId);
        return ResponseEntity.noContent().build();
    }
}
