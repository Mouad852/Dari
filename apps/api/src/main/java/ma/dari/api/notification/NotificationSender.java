package ma.dari.api.notification;

public interface NotificationSender {

    void send(NotificationOutbox event, String recipientEmail);
}
