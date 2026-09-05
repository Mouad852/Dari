package ma.dari.api.listing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

/**
 * Reference row for one real neighborhood in one of the four launch cities.
 * Read-only lookup data from the {@code V20} migration seed, not user input.
 *
 * <p>Not yet a foreign key from {@code listings.neighborhood}, which stays free
 * text: rejecting a listing whose typed neighborhood isn't in this table is a
 * separate decision (a launch-week gap in the list would lock out a real
 * owner), tracked in the listing-creation and search-filters plans.
 */
@Entity
@Table(name = "neighborhoods")
@IdClass(Neighborhood.NeighborhoodId.class)
public class Neighborhood {

    @Id
    private String city;

    @Id
    private String name;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Neighborhood() {
        // JPA
    }

    public String getCity() {
        return city;
    }

    public String getName() {
        return name;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    /** Mirrors the entity's {@code @Id} fields by name, per the {@code @IdClass} contract. */
    public static class NeighborhoodId implements Serializable {

        private String city;
        private String name;

        public NeighborhoodId() {
            // JPA
        }

        public NeighborhoodId(String city, String name) {
            this.city = city;
            this.name = name;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) {
                return true;
            }
            if (!(o instanceof NeighborhoodId that)) {
                return false;
            }
            return Objects.equals(city, that.city) && Objects.equals(name, that.name);
        }

        @Override
        public int hashCode() {
            return Objects.hash(city, name);
        }
    }
}
