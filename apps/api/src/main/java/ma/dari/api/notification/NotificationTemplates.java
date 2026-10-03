package ma.dari.api.notification;

import ma.dari.api.listing.Listing;
import ma.dari.api.user.User;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Subject and plain-text body for each notification email (audit P1-10).
 *
 * <p>Every email used to be titled "Notification Dari" with a body of one
 * phrase -- for a rejection, only the moderator's reason -- so an owner could
 * not tell which listing it concerned, and it read like phishing. Each body
 * now says who it is for, what happened, the reason when there is one, what
 * to do next with a link, and who sent it.
 *
 * <p>Copy rules from {@link NotificationService}: French, <em>vous</em>,
 * sentence case, plain and non-blaming, no emoji, no exclamation marks. Built
 * at enqueue time, so a listing renamed later does not change an email
 * already queued about it.
 */
@Component
public class NotificationTemplates {

    private final String siteUrl;

    public NotificationTemplates(Environment environment) {
        this.siteUrl = siteUrl(environment);
    }

    /**
     * {@code dari.public-site-url}, or else the first {@code dari.web-origins}
     * entry: in every deployment so far that is the public site, so production
     * does not need one more variable to start.
     */
    static String siteUrl(Environment environment) {
        String configured = environment.getProperty("dari.public-site-url", "");
        String url = configured.isBlank()
                ? environment.getProperty("dari.web-origins", "http://localhost:3000").split(",")[0]
                : configured;
        url = url.trim();
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    public record Email(String subject, String body) {
    }

    Email listingApproved(Listing listing) {
        return email(listing.getOwner(),
                "Votre annonce « " + title(listing) + " » est en ligne",
                "Votre annonce « " + title(listing) + " » a été validée par la modération. "
                        + "Elle est désormais visible dans les résultats de recherche.",
                null,
                "Voir l’annonce : " + siteUrl + "/listings/" + listing.getId() + "\n"
                        + "Gérer vos annonces : " + manageListings());
    }

    Email listingRejected(Listing listing, String reason) {
        return email(listing.getOwner(),
                "Votre annonce « " + title(listing) + " » n’a pas été validée",
                "Votre annonce « " + title(listing) + " » n’a pas été validée par la modération.",
                reason,
                "Vous pouvez la modifier depuis votre espace, puis la soumettre à nouveau : " + manageListings());
    }

    Email listingSuspended(Listing listing) {
        return email(listing.getOwner(),
                "Votre annonce « " + title(listing) + " » a été suspendue",
                "Votre annonce « " + title(listing) + " » a été suspendue par la modération. "
                        + "Elle n’apparaît plus dans les résultats de recherche.",
                null,
                "Vous pouvez suivre son état depuis votre espace : " + manageListings());
    }

    Email listingReinstated(Listing listing) {
        return email(listing.getOwner(),
                "Votre annonce « " + title(listing) + " » a été rétablie",
                "La suspension de votre annonce « " + title(listing) + " » a été levée. "
                        + "Elle retrouve l’état qu’elle avait avant la suspension.",
                null,
                "Vous pouvez suivre son état depuis votre espace : " + manageListings());
    }

    Email listingExpiringSoon(Listing listing, int daysRemaining) {
        String delay = daysRemaining + (daysRemaining == 1 ? " jour" : " jours");
        return email(listing.getOwner(),
                "Votre annonce « " + title(listing) + " » expire dans " + delay,
                "Votre annonce « " + title(listing) + " » expire dans " + delay + ". "
                        + "Elle n’apparaîtra alors plus dans les résultats de recherche.",
                null,
                "Une fois expirée, vous pourrez la renouveler depuis votre espace ; elle sera de nouveau "
                        + "vérifiée par la modération avant de réapparaître. Si la chambre a trouvé preneur, "
                        + "vous pouvez aussi l’indiquer dès maintenant : " + manageListings());
    }

    Email listingExpired(Listing listing) {
        return email(listing.getOwner(),
                "Votre annonce « " + title(listing) + " » a expiré",
                "Votre annonce « " + title(listing) + " » a expiré : elle n’apparaît plus dans les résultats "
                        + "de recherche.",
                null,
                "Pour la remettre en ligne, choisissez « Renouveler » dans votre espace. Elle sera vérifiée "
                        + "par la modération avant de réapparaître : " + manageListings());
    }

    /**
     * Receipt only: no target, no outcome, no link to what was reported. See
     * {@link NotificationService#reportAcknowledged}.
     */
    Email reportAcknowledged(User reporter) {
        return email(reporter,
                "Votre signalement a bien été reçu",
                "Nous avons bien reçu votre signalement. L’équipe de modération va l’examiner.",
                null,
                "Pour protéger les personnes concernées, nous ne communiquons pas la suite donnée "
                        + "aux signalements. Merci de contribuer à la sécurité de Dari.");
    }

    Email userWarned(User user, String reason) {
        return email(user,
                "Un avertissement concernant votre compte Dari",
                "La modération de Dari vous adresse un avertissement au sujet de votre activité. "
                        + "Votre compte reste actif.",
                reason,
                "Nous vous invitons à vérifier vos annonces et vos échanges : " + siteUrl + "/account");
    }

    Email userSuspended(User user, String reason) {
        return email(user,
                "Votre compte Dari est suspendu",
                "Votre compte Dari a été suspendu par la modération. Vous pouvez toujours vous connecter "
                        + "et consulter Dari, mais vous ne pouvez plus publier ni modifier d’annonce, "
                        + "ni envoyer de message.",
                reason,
                "Votre espace reste consultable : " + siteUrl + "/account");
    }

    Email userBanned(User user, String reason) {
        return email(user,
                "Votre compte Dari a été fermé",
                "Votre compte Dari a été fermé par la modération. Vous ne pouvez plus vous y connecter.",
                reason,
                null);
    }

    /**
     * Who wrote and about which listing, and a link to the thread. Never the
     * message itself: an email is forwarded, previewed on lock screens and
     * kept by mail providers, and a message is often an address or a phone
     * number (tracker 4.3c).
     */
    Email newMessage(User recipient, User sender, UUID conversationId, String listingTitle) {
        String from = name(sender);
        String about = listingTitle == null || oneLine(listingTitle).isEmpty()
                ? ""
                : " à propos de « " + oneLine(listingTitle) + " »";
        return email(recipient,
                "Nouveau message de " + from + about,
                from + " vous a envoyé un message" + about + ".",
                null,
                "Pour le lire et répondre : " + siteUrl + "/messages/" + conversationId + "\n\n"
                        + "Pour protéger vos échanges, le contenu des messages n’est jamais envoyé par e-mail. "
                        + "Tant que vous n’avez pas lu cette conversation, nous vous écrivons au plus une fois "
                        + "toutes les 30 minutes à son sujet.");
    }

    /** Owner-typed, and it goes into the Subject header: one line, whatever an API client sent. */
    private static String title(Listing listing) {
        return listing.getTitle() == null ? "" : oneLine(listing.getTitle());
    }

    private static String oneLine(String text) {
        return text.replaceAll("\\s+", " ").trim();
    }

    /** First name, else the display name; also user-typed, so one line as well. */
    private static String name(User user) {
        String name = user.getFirstName();
        if (name == null || name.isBlank()) name = user.getDisplayName();
        return name == null || name.isBlank() ? "Un membre de Dari" : oneLine(name);
    }

    private String manageListings() {
        return siteUrl + "/account/listings";
    }

    private Email email(User recipient, String subject, String whatHappened, String reason, String nextStep) {
        StringBuilder body = new StringBuilder()
                .append(greeting(recipient)).append("\n\n")
                .append(whatHappened).append("\n\n");
        if (reason != null && !reason.isBlank()) body.append("Motif : ").append(reason.trim()).append("\n\n");
        if (nextStep != null) body.append(nextStep).append("\n\n");
        body.append("L’équipe Dari\n")
                .append("--\n")
                .append("Vous recevez cet e-mail parce qu’il concerne votre compte Dari.\n")
                .append("Conditions d’utilisation : ").append(siteUrl).append("/legal/terms\n");
        return new Email(subject, body.toString());
    }

    private static String greeting(User recipient) {
        String name = recipient.getFirstName();
        if (name == null || name.isBlank()) name = recipient.getDisplayName();
        return name == null || name.isBlank() ? "Bonjour," : "Bonjour " + name.trim() + ",";
    }
}
