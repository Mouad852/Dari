package ma.dari.api.listing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NeighborhoodRepository extends JpaRepository<Neighborhood, Neighborhood.NeighborhoodId> {

    List<Neighborhood> findByCityOrderBySortOrderAsc(String city);
}
