package ma.dari.api.notification;

import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface NotificationOutboxRepository extends JpaRepository<NotificationOutbox, UUID> {

	    @Lock(LockModeType.PESSIMISTIC_WRITE)
	    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2"))
	    @Query("""
		    select o from NotificationOutbox o
		    where (o.status = ma.dari.api.notification.NotificationOutboxStatus.PENDING
			   and o.nextAttemptAt <= :now)
		       or (o.status = ma.dari.api.notification.NotificationOutboxStatus.SENDING
			   and o.lockedAt < :staleBefore)
		    order by o.createdAt, o.id
		    """)
	    List<NotificationOutbox> findClaimable(Instant now, Instant staleBefore, Pageable pageable);
}
