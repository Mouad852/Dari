package ma.dari.api.notification;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class NotificationOutboxClaimService {

    private final NotificationOutboxRepository outbox;

    public NotificationOutboxClaimService(NotificationOutboxRepository outbox) {
        this.outbox = outbox;
    }

    @Transactional
    public List<NotificationOutbox> claim(int batchSize, Instant now, Instant staleBefore) {
        List<NotificationOutbox> events = outbox.findClaimable(
                now, staleBefore, PageRequest.of(0, batchSize));
        events.forEach(event -> event.markSending(now));
        outbox.saveAll(events);
        return events;
    }
}
