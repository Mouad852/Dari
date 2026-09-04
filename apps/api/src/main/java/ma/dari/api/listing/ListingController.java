package ma.dari.api.listing;

import jakarta.validation.Valid;
import ma.dari.api.common.auth.AuthenticatedUser;
import ma.dari.api.common.auth.CurrentUser;
import ma.dari.api.common.error.NotImplementedYetException;
import ma.dari.api.common.pagination.CursorPage;
import ma.dari.api.listing.dto.CreateListingRequest;
import ma.dari.api.listing.dto.ListingPhotoResponse;
import ma.dari.api.listing.dto.ListingResponse;
import ma.dari.api.listing.dto.UpdateListingPhotoRequest;
import ma.dari.api.listing.dto.UpdateListingRequest;
import ma.dari.api.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Listings — design doc §7. Skeleton: routes are real, bodies land in phases
 * 02, 05 and 07.
 *
 * <p>Note what is deliberately absent: there is no endpoint that sets
 * {@code status} directly. Every transition goes through a named action
 * ({@code /submit}, {@code /mark-room-found}, {@code /reopen}) or through
 * moderation, so the state machine cannot be bypassed by a {@code PATCH}.
 */
@RestController
@RequestMapping("/api/v1/listings")
public class ListingController {

    private final ListingSearchService listingSearchService;
    private final ListingService listingService;
    private final ListingCovers covers;

    public ListingController(ListingSearchService listingSearchService, ListingService listingService,
                            ListingCovers covers) {
        this.listingSearchService = listingSearchService;
        this.listingService = listingService;
        this.covers = covers;
    }

    // --- public read (phase 02, extended 07) ---------------------------------

    /**
     * Search and browse. The busiest and most complex query in the system.
     *
     * <p>Reads through the {@code published_listings} view, so the
     * PUBLISHED + AVAILABLE invariant cannot be forgotten. Coordinates in the
     * response are fuzzed; the reference point for a distance sort travels in
     * the cursor, not in the query string — a client re-sending a slightly
     * different origin would shift the ordering and silently drop rows.
     */
    @GetMapping
    public CursorPage<PublicListingResponse> search(@RequestParam(required = false) String city,
                                                 @RequestParam(required = false) String neighborhood,
                                                 @RequestParam(required = false) String[] propertyType,
                                                 @RequestParam(required = false) String[] roomType,
                                                 @RequestParam(required = false) String[] furnishing,
                                                 @RequestParam(required = false) String[] amenities,
                                                 @RequestParam(required = false) LocalDate availableFrom,
                                                 @RequestParam(required = false) Integer priceMin,
                                                 @RequestParam(required = false) Integer priceMax,
                                                 @RequestParam(required = false) Double lat,
                                                 @RequestParam(required = false) Double lng,
                                                 @RequestParam(required = false) Integer radiusM,
                                                 @RequestParam(required = false) String sort,
                                                 @RequestParam(required = false) String cursor) {
        return listingSearchService.search(city, neighborhood, propertyType, roomType, furnishing, amenities, availableFrom,
                priceMin, priceMax, lat, lng, radiusM, sort, cursor);
    }

    /**
     * How many listings the current filters match, capped.
     *
     * <p>Separate from the search itself because it belongs to a filter set
     * rather than a page: the client asks once when filters change, not while
     * paginating.
     */
    @GetMapping("/count")
    public SearchCountResponse count(@RequestParam(required = false) String city,
                                     @RequestParam(required = false) String neighborhood,
                                     @RequestParam(required = false) String[] propertyType,
                                     @RequestParam(required = false) String[] roomType,
                                     @RequestParam(required = false) String[] furnishing,
                                     @RequestParam(required = false) String[] amenities,
                                     @RequestParam(required = false) LocalDate availableFrom,
                                     @RequestParam(required = false) Integer priceMin,
                                     @RequestParam(required = false) Integer priceMax,
                                     @RequestParam(required = false) Double lat,
                                     @RequestParam(required = false) Double lng,
                                     @RequestParam(required = false) Integer radiusM) {
        return listingSearchService.count(city, neighborhood, propertyType, roomType, furnishing,
                amenities, availableFrom, priceMin, priceMax, lat, lng, radiusM);
    }

    /** Map pins for a city or radius search. Exact coordinates are never returned. */
    @GetMapping("/map")
    public java.util.List<MapPinResponse> map(@RequestParam(required = false) String city,
                                            @RequestParam(required = false) String neighborhood,
                                            @RequestParam(required = false) String[] propertyType,
                                            @RequestParam(required = false) String[] roomType,
                                            @RequestParam(required = false) String[] furnishing,
                                            @RequestParam(required = false) String[] amenities,
                                            @RequestParam(required = false) Integer priceMin,
                                            @RequestParam(required = false) Integer priceMax,
                                            @RequestParam(required = false) LocalDate availableFrom,
                                            @RequestParam(required = false) Double lat,
                                            @RequestParam(required = false) Double lng,
                                            @RequestParam(required = false) Integer radiusM) {
        return listingSearchService.mapPins(city, neighborhood, propertyType, roomType, furnishing, amenities,
                priceMin, priceMax, availableFrom, lat, lng, radiusM);
    }

    /** Homepage grid (phase 08). Uses a simple published-and-recent ranking until a full recommendation model exists. */
    @GetMapping("/featured")
    public java.util.List<PublicListingResponse> featured(@RequestParam(defaultValue = "6") int limit) {
        return listingSearchService.featured(limit);
    }

    /**
     * Two responses behind one path: the owner sees their own draft or
     * suspended listing, everyone else gets 404 unless it is published and
     * available. Phase 08 depends on that 404 to keep delisted rooms from
     * staying indexed.
     */
    @GetMapping("/{id}")
    public PublicListingDetailResponse get(@PathVariable UUID id, Authentication authentication) {
       User viewer = null;
       if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser principal && principal.hasProfile()) {
           viewer = principal.internalUser();
       }
       return listingSearchService.getPublicOrOwnerListingDetail(id, viewer);
    }

    // --- owner write (phase 05) ----------------------------------------------

    /** The "my listings" dashboard: every status the owner has, not just what search would show. */
    @GetMapping("/mine")
    public CursorPage<ListingResponse> mine(@CurrentUser User owner, @RequestParam(required = false) String cursor) {
        return listingService.listMine(owner, cursor);
    }

    /** Returns the owner's latest active draft so the publish wizard can resume it. */
    /** One owned listing, with true coordinates, for the edit form. */
    @GetMapping("/mine/{id}")
    public ListingResponse mineById(@CurrentUser User owner, @PathVariable UUID id) {
        return ListingResponse.from(listingService.getOwned(owner, id),
                listingService.amenityCodesFor(id), covers.forListing(id));
    }

    @GetMapping("/draft")
    public ListingResponse draft(@CurrentUser User owner) {
        Listing listing = listingService.getDraft(owner);
        // A resumed draft carries its cover so the wizard's Photos step and the
        // owner's list agree about whether a photo exists.
        return ListingResponse.from(listing, listingService.amenityCodesFor(listing.getId()),
                covers.forListing(listing.getId()));
    }

    /** Creates a DRAFT. The wizard persists server-side from step one. */
    @PostMapping
    public ResponseEntity<ListingResponse> create(@CurrentUser User owner,
                                                @Valid @RequestBody CreateListingRequest request) {
        Listing listing = listingService.create(owner, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                // A listing one request old has no photo yet; null is the honest answer.
                .body(ListingResponse.from(listing, listingService.amenityCodesFor(listing.getId()), null));
    }

    /** Owner edit. Does not re-enter review (§7) and does not reset the expiry clock. */
    @PatchMapping("/{id}")
    public ListingResponse update(@CurrentUser User owner,
                                 @PathVariable UUID id,
                                 @Valid @RequestBody UpdateListingRequest request) {
        Listing listing = listingService.update(owner, id, request);
        return ListingResponse.from(listing, listingService.amenityCodesFor(listing.getId()),
                covers.forListing(listing.getId()));
    }

    /** Soft delete. Every read path filters deleted_at IS NULL. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@CurrentUser User owner, @PathVariable UUID id) {
        listingService.delete(owner, id);
        return ResponseEntity.noContent().build();
    }

    // --- lifecycle actions (phase 02 machine, wired in 05) -------------------

    /** DRAFT | REJECTED -> PENDING_REVIEW. Full validation runs here, not per step. */
    @PostMapping("/{id}/submit")
    public PublicListingResponse submit(@CurrentUser User owner, @PathVariable UUID id) {
        return listingSearchService.submit(id, owner);
    }

    /** AVAILABLE -> ROOM_FOUND. Touches availability only; status is untouched. */
    @PostMapping("/{id}/mark-room-found")
    public PublicListingResponse markRoomFound(@CurrentUser User owner, @PathVariable UUID id) {
        return listingSearchService.markRoomFound(id, owner);
    }

    /** ROOM_FOUND -> AVAILABLE. Legal only while status is still PUBLISHED. */
    @PostMapping("/{id}/reopen")
    public PublicListingResponse reopen(@CurrentUser User owner, @PathVariable UUID id) {
        return listingSearchService.reopen(id, owner);
    }

    /** EXPIRED -> PENDING_REVIEW (phase 10). Re-review is deliberate, not a formality. */
    @PostMapping("/{id}/renew")
    public Object renew(@CurrentUser User owner, @PathVariable UUID id) {
        throw new NotImplementedYetException("phase 10");
    }

    // --- photos (phase 05) ---------------------------------------------------

    /** Owner-scoped read, in display order. Public callers get photos embedded in GET /listings/{id}. */
    @GetMapping("/{id}/photos")
    public java.util.List<ListingPhotoResponse> photos(@CurrentUser User owner, @PathVariable UUID id) {
        return listingService.listPhotos(owner, id).stream()
                .map(ListingPhotoResponse::from)
                .toList();
    }

    /** Uploads are re-encoded, which strips EXIF. A listing photo carries GPS. */
    @PostMapping("/{id}/photos")
    public ResponseEntity<ListingPhotoResponse> addPhoto(@CurrentUser User owner,
                                                      @PathVariable UUID id,
                                                      @RequestParam("file") MultipartFile file) {
        ListingPhoto photo = listingService.addPhoto(owner, id, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(ListingPhotoResponse.from(photo));
    }

    /** Reorder, or set the cover. Exactly one cover, enforced by a partial unique index. */
    @PatchMapping("/{id}/photos/{photoId}")
    public ListingPhotoResponse updatePhoto(@CurrentUser User owner,
                                         @PathVariable UUID id,
                                         @PathVariable UUID photoId,
                                         @Valid @ModelAttribute UpdateListingPhotoRequest request) {
        return ListingPhotoResponse.from(listingService.updatePhoto(
                owner, id, photoId, request.sortOrder(), request.isCover()));
    }

    @DeleteMapping("/{id}/photos/{photoId}")
    public ResponseEntity<Void> deletePhoto(@CurrentUser User owner,
                                          @PathVariable UUID id,
                                          @PathVariable UUID photoId) {
        listingService.deletePhoto(owner, id, photoId);
        return ResponseEntity.noContent().build();
    }
}
