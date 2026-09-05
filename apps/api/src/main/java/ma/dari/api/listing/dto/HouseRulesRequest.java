package ma.dari.api.listing.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Size;

import java.time.LocalTime;

/**
 * House rules submitted with a listing create or patch (§5).
 *
 * <p>Omitting the whole object leaves existing rules untouched; sending it
 * replaces all six answers with exactly what was sent, nulls included. That is
 * the same full-replace rule {@code amenityCodes} uses, and for the same
 * reason: the wizard step is a form that always submits every field, so a
 * per-field merge would make "clear this answer" impossible to express.
 *
 * <p>A null answer inside a submitted object is meaningful, not missing — it
 * is an owner who saw the question and chose not to answer. §5's rule is that
 * silence is not a promise, so it must stay distinguishable from {@code false}.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record HouseRulesRequest(
        Boolean smokingAllowed,
        Boolean petsAllowed,
        Boolean guestsAllowed,
        LocalTime quietHoursStart,
        LocalTime quietHoursEnd,

        @Size(max = 2000, message = "2000 caractères maximum")
        String otherRules) {
}
