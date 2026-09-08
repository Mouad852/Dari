package ma.dari.api.listing;

/**
 * What kind of room a {@link ListingRoom} physically is.
 *
 * <p>Distinct from {@link RoomType}, which says whether the room being offered
 * is private or shared. A listing has one {@code RoomType} and many
 * {@code ListingRoomType} rows.
 */
public enum ListingRoomType {
    BEDROOM,
    SALON,
    KITCHEN,
    BATHROOM,
    TERRACE,
    STORAGE
}
