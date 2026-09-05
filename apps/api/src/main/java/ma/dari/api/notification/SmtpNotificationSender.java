package ma.dari.api.notification;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "dari.notifications.enabled", havingValue = "true")
public class SmtpNotificationSender implements NotificationSender {

    private final JavaMailSender mailSender;
    private final String from;

    public SmtpNotificationSender(JavaMailSender mailSender,
                                  org.springframework.core.env.Environment environment) {
        this.mailSender = mailSender;
        this.from = environment.getRequiredProperty("dari.notifications.from");
    }

    @Override
    public void send(NotificationOutbox event, String recipientEmail) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(recipientEmail);
        message.setSubject(subject(event.getEventType()));
        message.setText(event.getPayload());
        mailSender.send(message);
    }

    private String subject(String eventType) {
        return switch (eventType) {
            case "REPORT_ACKNOWLEDGED" -> "Votre signalement Dari";
            default -> "Notification Dari";
        };
    }
}
