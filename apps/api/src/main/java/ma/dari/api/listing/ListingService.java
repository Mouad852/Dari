package ma.dari.api.listing;

import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import ma.dari.api.common.pagination.Cursor;
import ma.dari.api.common.pagination.CursorPage;
import ma.dari.api.listing.dto.CreateListingRequest;
import ma.dari.api.listing.dto.ListingResponse;
import ma.dari.api.listing.dto.UpdateListingRequest;
import ma.dari.api.media.ImageStore;
import ma.dari.api.user.User;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class ListingService {

    private static final int PAGE_SIZE = 20;

    private final ListingRepository listings;
    private final ListingPhotoRepository listingPhotos;
    private final ImageStore imageStore;
    private final AmenityRepository amenities;
    private final ListingAmenityRepository listingAmenities;
    private final ListingCovers covers;

    public ListingService(ListingRepository listings, ListingPhotoRepository listingPhotos, ImageStore imageStore,
                           AmenityRepository amenities, ListingAmenityRepository listingAmenities,
                           ListingCovers covers) {
        this.listings = listings;
        this.listingPhotos = listingPhotos;
        this.imageStore = imageStore;
        this.amenities = amenities;
        this.listingAmenities = listingAmenities;
        this.covers = covers;
    }

    /** The owner's dashboard: every status, not just what search would show. */
    @Transactional(readOnly = true)
    public CursorPage<ListingResponse> listMine(User owner, String cursor) {
        var payload = cursor == null ? null : Cursor.decode(cursor);
        Instant lastCreatedAt = payload == null || !payload.has("lastCreatedAt") || payload.get("lastCreatedAt").isNull()
                ? null : Instant.parse(payload.get("lastCreatedAt").asText());
        UUID lastId = payload == null || !payload.has("lastId") || payload.get("lastId").isNull()
                ? null : UUID.fromString(payload.get("lastId").asText());

        List<Listing> rows = lastCreatedAt == null && lastId == null
                ? listings.findVisibleByOwner(owner.getId(), PageRequest.of(0, PAGE_SIZE + 1))
                : listings.findVisibleByOwnerAfter(owner.getId(), lastCreatedAt, lastId, PageRequest.of(0, PAGE_SIZE + 1));

        boolean hasMore = rows.size() > PAGE_SIZE;
        List<Listing> pageRows = hasMore ? rows.subList(0, PAGE_SIZE) : rows;
        // One query for the page's covers rather than one per listing.
        java.util.Map<UUID, String> coverUrls = covers.forEach(pageRows);
        List<ListingResponse> items = pageRows.stream()
                .map(listing -> ListingResponse.from(listing, amenityCodesFor(listing.getId()),
                        coverUrls.get(listing.getId())))
                .toList();

        String nextCursor = null;
        if (hasMore && !pageRows.isEmpty()) {
            Listing last = pageRows.get(pageRows.size() - 1);
            var payloadOut = Cursor.newPayload();
            payloadOut.put("lastCreatedAt", last.getCreatedAt().toString());
            payloadOut.put("lastId", last.getId().toString());
            nextCursor = Cursor.encode(payloadOut);
        }

        return CursorPage.of(items, nextCursor);
    }

    @Transactional(readOnly = true)
    public Listing getDraft(User owner) {
        return listings.findFirstByOwnerIdAndStatusAndDeletedAtIsNullOrderByUpdatedAtDesc(
                        owner.getId(), ListingStatus.DRAFT)
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Brouillon introuvable"));
    }

    /**
     * One of the owner's own listings, with **true** coordinates.
     *
     * <p>Deliberately not served by {@code GET /listings/{id}}: that path runs
     * every response through {@link LocationFuzzer}, including for the owner. An
     * edit form loaded from it would round-trip fuzzed coordinates straight back
     * through PATCH and walk the listing's real location by up to the fuzz
     * radius on every single save — silent, cumulative, and invisible until
     * someone tried to find the place.
     */
    @Transactional(readOnly = true)
    public Listing getOwned(User owner, UUID listingId) {
        return listings.findByIdAndOwnerIdAndDeletedAtIsNull(listingId, owner.getId())
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));
    }

    @Transactional
    public Listing create(User owner, CreateListingRequest request) {
        validateRoommatesCount(request.currentRoommatesCount(), request.maxRoommates());
        Listing listing = new Listing(
                owner,
                request.title(),
                request.city(),
                request.neighborhood(),
                request.latitude(),
                request.longitude(),
                request.priceRent(),
                ListingStatus.DRAFT,
                AvailabilityState.AVAILABLE
        );

        applyCreate(request, listing);
        listing = listings.save(listing);

        if (request.amenityCodes() != null) {
            replaceAmenities(listing, request.amenityCodes());
        }
        return listing;
    }

    @Transactional
    public Listing update(User owner, UUID listingId, UpdateListingRequest request) {
        Listing listing = listings.findByIdAndOwnerIdAndDeletedAtIsNull(listingId, owner.getId())
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));

        validateRoommatesCount(
                request.currentRoommatesCount() != null ? request.currentRoommatesCount() : listing.getCurrentRoommatesCount(),
                request.maxRoommates() != null ? request.maxRoommates() : listing.getMaxRoommates()
        );
        applyUpdate(request, listing);

        // Editing a live listing returns it to the moderation queue.
        //
        // This reverses the original design-doc §4 rule ("editing a PUBLISHED
        // listing does not send it back to review", mitigated by reporting) at
        // the product owner's explicit direction. The trade-off it accepts: a
        // published listing leaves public search the moment its owner touches
        // it, including for a typo, and only returns once a moderator approves
        // it again.
        //
        // Only PUBLISHED moves. A DRAFT stays a DRAFT -- the create wizard
        // PATCHes on every step, and sending drafts to review would submit them
        // before the owner ever pressed publish.
        if (listing.getStatus() == ListingStatus.PUBLISHED) {
            listing.setStatus(ListingStatus.PENDING_REVIEW);
        }

        listing = listings.save(listing);

        if (request.amenityCodes() != null) {
            replaceAmenities(listing, request.amenityCodes());
        }
        return listing;
    }

    private void validateRoommatesCount(Short current, Short maximum) {
        if (current != null && maximum != null && current > maximum) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED,
                    "Le nombre actuel de colocataires ne peut pas dépasser le nombre maximal");
        }
    }

    /** The set of amenity codes currently attached to a listing, for responses. */
    @Transactional(readOnly = true)
    public Set<String> amenityCodesFor(UUID listingId) {
        return new HashSet<>(listingAmenities.findAmenityCodesByListingId(listingId));
    }

    /** Full replace: simplest correct semantics for a checkbox-list UI. */
    private void replaceAmenities(Listing listing, Set<String> requestedCodes) {
        for (String code : requestedCodes) {
            if (!amenities.existsById(code)) {
                throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Équipement inconnu : " + code);
            }
        }

        listingAmenities.deleteByListingId(listing.getId());
        for (String code : requestedCodes) {
            listingAmenities.save(new ListingAmenity(listing, code));
        }
    }

    @Transactional
    public void delete(User owner, UUID listingId) {
        Listing listing = listings.findByIdAndOwnerIdAndDeletedAtIsNull(listingId, owner.getId())
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));

        listing.setDeletedAt(Instant.now());
        listings.save(listing);
    }

    /**
     * The owner's own view of a listing's photos, in display order.
     *
     * <p>Separate from the public detail response on purpose: the wizard needs to
     * render what has already been uploaded to a DRAFT, and a draft is by
     * definition not publicly visible, so there was previously no way to read
     * photos back at all — only POST, PATCH and DELETE existed.
     */
    @Transactional(readOnly = true)
    public List<ListingPhoto> listPhotos(User owner, UUID listingId) {
        listings.findByIdAndOwnerIdAndDeletedAtIsNull(listingId, owner.getId())
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));

        return listingPhotos.findByListingIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAsc(listingId);
    }

    @Transactional
    public ListingPhoto addPhoto(User owner, UUID listingId, MultipartFile file) {
        Listing listing = listings.findByIdAndOwnerIdAndDeletedAtIsNull(listingId, owner.getId())
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));

        List<ListingPhoto> existingPhotos = listingPhotos.findByListingIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAsc(listingId);
        ImageStore.StoredImage storedImage = imageStore.store(ImageStore.LISTINGS, listingId, file);
        int nextSortOrder = existingPhotos.isEmpty() ? 0 : existingPhotos.get(existingPhotos.size() - 1).getSortOrder() + 1;
        boolean isCover = existingPhotos.stream().noneMatch(ListingPhoto::isCover);

        ListingPhoto photo = new ListingPhoto(
                listing,
                storedImage.storageKey(),
                storedImage.mimeType(),
                storedImage.width(),
                storedImage.height(),
                nextSortOrder,
                isCover
        );
        return listingPhotos.save(photo);
    }

    @Transactional
    public ListingPhoto updatePhoto(User owner, UUID listingId, UUID photoId, Integer sortOrder, Boolean isCover) {
        Listing listing = listings.findByIdAndOwnerIdAndDeletedAtIsNull(listingId, owner.getId())
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));

        ListingPhoto photo = listingPhotos.findByIdAndListingIdAndDeletedAtIsNull(photoId, listingId)
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Photo introuvable"));

        if (sortOrder != null) {
            if (sortOrder < 0) {
                throw new ApiException(400, ErrorCode.VALIDATION_FAILED,
                        "L'ordre de tri doit être positif ou nul");
            }
            photo.setSortOrder(sortOrder);
        }
        if (isCover != null) {
            if (Boolean.TRUE.equals(isCover)) {
                listingPhotos.findByListingIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAsc(listingId)
                        .stream()
                        .filter(p -> !p.getId().equals(photoId))
                        .forEach(p -> p.setCover(false));
                photo.setCover(true);
            } else if (photo.isCover()) {
                List<ListingPhoto> others = listingPhotos.findByListingIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAsc(listingId)
                        .stream()
                        .filter(p -> !p.getId().equals(photoId))
                        .toList();
                if (others.isEmpty()) {
                    throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Une annonce doit conserver une photo de couverture");
                }
                photo.setCover(false);
                ListingPhoto replacement = others.stream()
                        .sorted(Comparator.comparingInt(ListingPhoto::getSortOrder).thenComparing(ListingPhoto::getCreatedAt))
                        .findFirst()
                        .orElseThrow(() -> new ApiException(400, ErrorCode.VALIDATION_FAILED, "Une annonce doit conserver une photo de couverture"));
                replacement.setCover(true);
                listingPhotos.save(replacement);
            }
        }

        return listingPhotos.save(photo);
    }

    @Transactional
    public void deletePhoto(User owner, UUID listingId, UUID photoId) {
        Listing listing = listings.findByIdAndOwnerIdAndDeletedAtIsNull(listingId, owner.getId())
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));

        ListingPhoto photo = listingPhotos.findByIdAndListingIdAndDeletedAtIsNull(photoId, listingId)
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Photo introuvable"));

        photo.setDeletedAt(Instant.now());
        listingPhotos.save(photo);
        imageStore.delete(photo.getStorageKey());

        if (photo.isCover()) {
            List<ListingPhoto> remaining = listingPhotos.findByListingIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAsc(listingId)
                    .stream()
                    .filter(p -> !p.getId().equals(photoId))
                    .sorted(Comparator.comparingInt(ListingPhoto::getSortOrder).thenComparing(ListingPhoto::getCreatedAt))
                    .toList();
            if (!remaining.isEmpty()) {
                ListingPhoto replacement = remaining.get(0);
                replacement.setCover(true);
                listingPhotos.save(replacement);
            }
        }
    }

    private void applyCreate(CreateListingRequest request, Listing listing) {
        if (request.priceDeposit() != null) {
            listing.setPriceDeposit(request.priceDeposit());
        }
        if (request.description() != null) {
            listing.setDescription(request.description());
        }
        if (request.wifiIncluded() != null) {
            listing.setWifiIncluded(request.wifiIncluded());
        }
        if (request.electricityIncluded() != null) {
            listing.setElectricityIncluded(request.electricityIncluded());
        }
        if (request.waterIncluded() != null) {
            listing.setWaterIncluded(request.waterIncluded());
        }
        if (request.propertyType() != null) {
            listing.setPropertyType(request.propertyType());
        }
        if (request.numBedrooms() != null) {
            listing.setNumBedrooms(request.numBedrooms());
        }
        if (request.numBathrooms() != null) {
            listing.setNumBathrooms(request.numBathrooms());
        }
        if (request.roomType() != null) {
            listing.setRoomType(request.roomType());
        }
        if (request.roomFurnishing() != null) {
            listing.setRoomFurnishing(request.roomFurnishing());
        }
        if (request.commonAreasFurnished() != null) {
            listing.setCommonAreasFurnished(request.commonAreasFurnished());
        }
        if (request.currentRoommatesCount() != null) {
            listing.setCurrentRoommatesCount(request.currentRoommatesCount());
        }
        if (request.maxRoommates() != null) {
            listing.setMaxRoommates(request.maxRoommates());
        }
        if (request.availableFrom() != null) {
            listing.setAvailableFrom(request.availableFrom());
        }
        if (request.minStayMonths() != null) {
            listing.setMinStayMonths(request.minStayMonths());
        }
    }

    private void applyUpdate(UpdateListingRequest request, Listing listing) {
        if (request.title() != null) {
            listing.setTitle(request.title());
        }
        if (request.city() != null) {
            listing.setCity(request.city());
        }
        if (request.neighborhood() != null) {
            listing.setNeighborhood(request.neighborhood());
        }
        if (request.latitude() != null) {
            listing.setLatitude(request.latitude());
        }
        if (request.longitude() != null) {
            listing.setLongitude(request.longitude());
        }
        if (request.priceRent() != null) {
            listing.setPriceRent(request.priceRent());
        }
        if (request.priceDeposit() != null) {
            listing.setPriceDeposit(request.priceDeposit());
        }
        if (request.description() != null) {
            listing.setDescription(request.description());
        }
        if (request.wifiIncluded() != null) {
            listing.setWifiIncluded(request.wifiIncluded());
        }
        if (request.electricityIncluded() != null) {
            listing.setElectricityIncluded(request.electricityIncluded());
        }
        if (request.waterIncluded() != null) {
            listing.setWaterIncluded(request.waterIncluded());
        }
        if (request.propertyType() != null) {
            listing.setPropertyType(request.propertyType());
        }
        if (request.numBedrooms() != null) {
            listing.setNumBedrooms(request.numBedrooms());
        }
        if (request.numBathrooms() != null) {
            listing.setNumBathrooms(request.numBathrooms());
        }
        if (request.roomType() != null) {
            listing.setRoomType(request.roomType());
        }
        if (request.roomFurnishing() != null) {
            listing.setRoomFurnishing(request.roomFurnishing());
        }
        if (request.commonAreasFurnished() != null) {
            listing.setCommonAreasFurnished(request.commonAreasFurnished());
        }
        if (request.currentRoommatesCount() != null) {
            listing.setCurrentRoommatesCount(request.currentRoommatesCount());
        }
        if (request.maxRoommates() != null) {
            listing.setMaxRoommates(request.maxRoommates());
        }
        if (request.availableFrom() != null) {
            listing.setAvailableFrom(request.availableFrom());
        }
        if (request.minStayMonths() != null) {
            listing.setMinStayMonths(request.minStayMonths());
        }
    }
}
