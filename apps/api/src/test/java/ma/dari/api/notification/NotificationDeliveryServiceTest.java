package ma.dari.api.notification;

import ma.dari.api.user.User;
import ma.dari.api.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.env.MockEnvironment;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class NotificationDeliveryServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-05T12:00:00Z");
    private NotificationOutboxClaimService claims;
    private NotificationOutboxRepository outbox;
    private UserRepository users;
    private NotificationSender sender;
    private NotificationDeliveryService service;

    @BeforeEach
    void setUp() {
        claims = mock(NotificationOutboxClaimService.class);
        outbox = mock(NotificationOutboxRepository.class);
        users = mock(UserRepository.class);
        sender = mock(NotificationSender.class);
        service = new NotificationDeliveryService(claims, outbox, users, sender,
                Clock.fixed(NOW, ZoneOffset.UTC), new MockEnvironment());
    }

    @Test
    void deliversPendingEventAndMarksItSent() {
        UUID recipientId = UUID.randomUUID();
        NotificationOutbox event = event("LISTING_APPROVED", recipientId, "Votre annonce a été approuvée");
        event.markSending(NOW);
        User user = mock(User.class);
        when(user.getEmail()).thenReturn("owner@example.com");
        when(claims.claim(50, NOW, NOW.minusSeconds(900))).thenReturn(List.of(event));
        when(users.findById(recipientId)).thenReturn(Optional.of(user));

        service.deliverPending();

        verify(sender).send(event, "owner@example.com");
        assertThat(event.getStatus()).isEqualTo(NotificationOutboxStatus.SENT);
        verify(outbox).save(event);
    }

    @Test
    void retriesTransientTransportFailure() {
        UUID recipientId = UUID.randomUUID();
        NotificationOutbox event = event("LISTING_EXPIRED", recipientId, "Votre annonce a expiré et doit être renouvelée");
        event.markSending(NOW);
        User user = mock(User.class);
        when(user.getEmail()).thenReturn("owner@example.com");
        when(claims.claim(50, NOW, NOW.minusSeconds(900))).thenReturn(List.of(event));
        when(users.findById(recipientId)).thenReturn(Optional.of(user));
        doThrow(new RuntimeException("SMTP unavailable")).when(sender).send(event, "owner@example.com");

        service.deliverPending();

        assertThat(event.getStatus()).isEqualTo(NotificationOutboxStatus.PENDING);
        assertThat(event.getNextAttemptAt()).isEqualTo(NOW.plusSeconds(60));
        assertThat(event.getLastError()).isEqualTo("SMTP unavailable");
        verify(outbox).save(event);
    }

    @Test
    void quarantinesMalformedEventWithoutSending() {
        NotificationOutbox event = event("UNKNOWN", UUID.randomUUID(), "Message");
        event.markSending(NOW);
        when(claims.claim(50, NOW, NOW.minusSeconds(900))).thenReturn(List.of(event));

        service.deliverPending();

        assertThat(event.getStatus()).isEqualTo(NotificationOutboxStatus.DEAD);
        assertThat(event.getLastError()).isEqualTo("Unsupported notification event type");
        verifyNoInteractions(users, sender);
        verify(outbox).save(event);
    }

    private NotificationOutbox event(String type, UUID recipientId, String payload) {
        return new NotificationOutbox(type, recipientId, null, payload);
    }
}
