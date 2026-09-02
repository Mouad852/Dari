package ma.dari.api.listing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Reference row for one amenity code. Read-mostly: rows come from the phase 05
 * migration seed, not from user input.
 */
@Entity
@Table(name = "amenities")
public class Amenity {

    @Id
    private String code;

    @Column(name = "label_fr", nullable = false)
    private String labelFr;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Amenity() {
        // JPA
    }

    public String getCode() {
        return code;
    }

    public String getLabelFr() {
        return labelFr;
    }

    public int getSortOrder() {
        return sortOrder;
    }
}
