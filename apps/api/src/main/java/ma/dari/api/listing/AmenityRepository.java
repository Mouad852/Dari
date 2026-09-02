package ma.dari.api.listing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AmenityRepository extends JpaRepository<Amenity, String> {

    List<Amenity> findAllByOrderBySortOrderAsc();
}
