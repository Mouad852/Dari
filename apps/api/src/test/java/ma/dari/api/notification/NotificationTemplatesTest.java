package ma.dari.api.notification;

import ma.dari.api.listing.Listing;
import ma.dari.api.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.util.List;
import java.util.UUID;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NotificationTemplatesTest {

    private static final UUID LISTING_ID = UUID.fromString("0f8e6c1a-9a4b-4f55-8d2e-2b7c6a1d9e01");
    private final NotificationTemplates templates = new NotificationTemplates(new MockEnvironment()
            .withProperty("dari.public-site-url", "https://dari.ma/"));

    @Test
    void everyListingModerationEmailNamesTheListingAndLinksToTheOwnersListings() {
        Listing listing = listing("Chambre lumineuse à Agdal", owner("Salma", "Salma B."));
        List<Function<Listing, NotificationTemplates.Email>> events = List.of(
                templates::listingApproved,
                l -> templates.listingRejected(l, "Photos floues"),
                templates::listingSuspended,
                templates::listingReinstated);

        for (var event : events) {
            NotificationTemplates.Email email = event.apply(listing);
            assertThat(email.subject()).contains("« Chambre lumineuse à Agdal »").doesNotContain("Notification Dari");
            assertThat(email.body())
                    .startsWith("Bonjour Salma,\n\n")
                    .contains("« Chambre lumineuse à Agdal »")
                    .contains("https://dari.ma/account/listings")
                    .contains("L’équipe Dari")
                    .contains("Conditions d’utilisation : https://dari.ma/legal/terms")
                    .doesNotContain("!");
        }
    }

    @Test
    void approvalLinksToThePublicListing() {
        NotificationTemplates.Email email = templates.listingApproved(listing("Studio", owner("Salma", null)));

        assertThat(email.subject()).isEqualTo("Votre annonce « Studio » est en ligne");
        assertThat(email.body()).contains("Voir l’annonce : https://dari.ma/listings/" + LISTING_ID);
    }

    @Test
    void rejectionCarriesTheModeratorsReasonAndTheWayBack() {
        NotificationTemplates.Email email = templates.listingRejected(listing("Studio", owner(null, "Karim")), "  Photos floues ");

        assertThat(email.subject()).isEqualTo("Votre annonce « Studio » n’a pas été validée");
        assertThat(email.body())
                .startsWith("Bonjour Karim,")
                .contains("Motif : Photos floues\n")
                .contains("la soumettre à nouveau : https://dari.ma/account/listings");
    }

    @Test
    void accountEmailsStateTheConsequenceAndOmitABlankReason() {
        User user = owner(null, null);

        NotificationTemplates.Email warned = templates.userWarned(user, " ");
        assertThat(warned.subject()).isEqualTo("Un avertissement concernant votre compte Dari");
        assertThat(warned.body()).startsWith("Bonjour,\n\n").contains("Votre compte reste actif.")
                .contains("https://dari.ma/account").doesNotContain("Motif");

        NotificationTemplates.Email suspended = templates.userSuspended(user, "Annonces en double");
        assertThat(suspended.subject()).isEqualTo("Votre compte Dari est suspendu");
        assertThat(suspended.body()).contains("ne pouvez plus publier").contains("Motif : Annonces en double");

        NotificationTemplates.Email banned = templates.userBanned(user, null);
        assertThat(banned.subject()).isEqualTo("Votre compte Dari a été fermé");
        assertThat(banned.body()).contains("Vous ne pouvez plus vous y connecter.").doesNotContain("Motif");
    }

    @Test
    void aTitleWithLineBreaksBecomesOneLineInTheSubject() {
        NotificationTemplates.Email email = templates.listingSuspended(listing("Studio\r\nBcc: x@example.com", owner("Salma", null)));

        assertThat(email.subject()).isEqualTo("Votre annonce « Studio Bcc: x@example.com » a été suspendue");
    }

    @Test
    void linksDefaultToTheFirstWebOrigin() {
        assertThat(NotificationTemplates.siteUrl(new MockEnvironment()
                .withProperty("dari.web-origins", "https://dari.ma, https://www.dari.ma"))).isEqualTo("https://dari.ma");
        assertThat(NotificationTemplates.siteUrl(new MockEnvironment()
                .withProperty("dari.public-site-url", "")
                .withProperty("dari.web-origins", "https://www.dari.ma"))).isEqualTo("https://www.dari.ma");
    }

    private static Listing listing(String title, User owner) {
        Listing listing = mock(Listing.class);
        when(listing.getId()).thenReturn(LISTING_ID);
        when(listing.getTitle()).thenReturn(title);
        when(listing.getOwner()).thenReturn(owner);
        return listing;
    }

    private static User owner(String firstName, String displayName) {
        User user = mock(User.class);
        when(user.getFirstName()).thenReturn(firstName);
        when(user.getDisplayName()).thenReturn(displayName);
        return user;
    }
}
