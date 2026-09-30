package ma.dari.api.notification;

import ma.dari.api.listing.Listing;
import ma.dari.api.user.User;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

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

    /** Owner-typed, and it goes into the Subject header: one line, whatever an API client sent. */
    private static String title(Listing listing) {
        return listing.getTitle() == null ? "" : listing.getTitle().replaceAll("\\s+", " ").trim();
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
