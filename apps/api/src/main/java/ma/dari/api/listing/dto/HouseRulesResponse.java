package ma.dari.api.listing.dto;

import ma.dari.api.listing.HouseRules;

import java.time.LocalTime;

/**
 * The house rules for one listing (§5), or {@code null} on the parent
 * response when the listing has no {@code house_rules} row at all.
 *
 * <p>That "row missing entirely" case is distinct from "row present, every
 * field null" — the latter is an owner who saw every question and chose not
 * to answer any of them; the former is a listing created before this feature
 * existed, or one whose owner never opened the step at all. Both currently
 * happen to look identical on the wire (nothing to show either way), but the
 * distinction is real and the two must not be collapsed into one "just
 * default everything to null" representation prematurely — see the write
 * path (a later step) for where it will matter.
 */
public record HouseRulesResponse(
        Boolean smokingAllowed,
        Boolean petsAllowed,
        Boolean guestsAllowed,
        LocalTime quietHoursStart,
        LocalTime quietHoursEnd,
        String otherRules) {

    public static HouseRulesResponse from(HouseRules houseRules) {
        return new HouseRulesResponse(
                houseRules.getSmokingAllowed(),
                houseRules.getPetsAllowed(),
                houseRules.getGuestsAllowed(),
                houseRules.getQuietHoursStart(),
                houseRules.getQuietHoursEnd(),
                houseRules.getOtherRules());
    }
}
