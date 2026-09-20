package ma.dari.api.listing;

import java.util.UUID;

/** The database's exact geography distance, paired with a public listing id. */
public interface RadiusListingProjection {
    UUID getListingId();
    Double getDistanceMetres();
}
