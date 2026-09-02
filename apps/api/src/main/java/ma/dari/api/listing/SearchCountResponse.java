package ma.dari.api.listing;

/**
 * How many listings a filter set matches, counted up to a cap.
 *
 * <p>Counting is more expensive than the page it describes: a page stops at
 * twenty-one rows, a count cannot stop at all. Measured against 50,000 seeded
 * listings, an exact count on a filtered search took 85 ms against roughly 35 ms
 * for the page itself, and that gap widens with the catalogue. Capping bounds it
 * to a constant.
 *
 * <p>The number stops being decision-useful well before the cap anyway. A seeker
 * refines their filters differently for three results than for three hundred;
 * nobody behaves differently at four hundred than at nine hundred.
 *
 * @param count   matches found, never above {@code CAP}
 * @param capped  true when there are more than {@code CAP} matches, so the UI
 *                says "plus de 200" rather than claiming an exact figure
 */
public record SearchCountResponse(int count, boolean capped) {

    /** Above this, the exact number is neither cheap nor useful. */
    public static final int CAP = 200;

    static SearchCountResponse of(int rowsFound) {
        return rowsFound > CAP
                ? new SearchCountResponse(CAP, true)
                : new SearchCountResponse(rowsFound, false);
    }
}
