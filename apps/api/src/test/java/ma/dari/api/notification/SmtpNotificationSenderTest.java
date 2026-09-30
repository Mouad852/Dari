package ma.dari.api.notification;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mock.env.MockEnvironment;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class SmtpNotificationSenderTest {

    private final JavaMailSender mail = mock(JavaMailSender.class);
    private final SmtpNotificationSender sender = new SmtpNotificationSender(mail,
            new MockEnvironment().withProperty("dari.notifications.from", "no-reply@dari.ma"));

    @Test
    void sendsTheSubjectAndBodyWrittenAtEnqueueTime() {
        sender.send(new NotificationOutbox("LISTING_REJECTED", UUID.randomUUID(), UUID.randomUUID(),
                "Votre annonce « Studio » n’a pas été validée", "Bonjour,\n\nMotif : Photos floues\n"), "owner@example.com");

        SimpleMailMessage message = sent();
        assertThat(message.getSubject()).isEqualTo("Votre annonce « Studio » n’a pas été validée");
        assertThat(message.getText()).isEqualTo("Bonjour,\n\nMotif : Photos floues\n");
        assertThat(message.getTo()).containsExactly("owner@example.com");
        assertThat(message.getFrom()).isEqualTo("no-reply@dari.ma");
    }

    @Test
    void aRowQueuedBeforeSubjectsExistedKeepsTheGenericSubject() {
        sender.send(new NotificationOutbox("LISTING_APPROVED", UUID.randomUUID(), UUID.randomUUID(),
                "Votre annonce a été approuvée"), "owner@example.com");

        assertThat(sent().getSubject()).isEqualTo("Notification Dari");
    }

    private SimpleMailMessage sent() {
        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mail).send(captor.capture());
        return captor.getValue();
    }
}
