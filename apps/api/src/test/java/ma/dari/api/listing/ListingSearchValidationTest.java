package ma.dari.api.listing;

import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ListingSearchValidationTest {
    @Test
    void requiresCompleteFiniteBoundedRadiusInputs() {
        assertValidation(() -> ListingSearchValidation.validate(null, null, 1d, null, 100, null, null, null, null, null, null, null));
        assertValidation(() -> ListingSearchValidation.validate(null, null, Double.NaN, 1d, 100, null, null, null, null, null, null, null));
        assertValidation(() -> ListingSearchValidation.validate(null, null, 91d, 1d, 100, null, null, null, null, null, null, null));
        assertValidation(() -> ListingSearchValidation.validate(null, null, 1d, 1d, 0, null, null, null, null, null, null, null));
        assertValidation(() -> ListingSearchValidation.validate("Rabat", null, 1d, 1d, 100, null, null, null, null, null, null, null));
    }

    @Test
    void rejectsUnknownEnumsBeforeNativeSearch() {
        assertValidation(() -> ListingSearchValidation.validate(null, null, null, null, null, "unknown", new String[]{"castle"}, null, null, null, null, null));
        assertValidation(() -> ListingSearchValidation.validate(null, null, null, null, null, null, null, new String[]{"loft"}, null, null, null, null));
        assertValidation(() -> ListingSearchValidation.validate(null, null, null, null, null, null, null, null, null, new String[]{"unknown-amenity"}, null, null));
    }

    private static void assertValidation(Runnable action) {
        assertThatThrownBy(() -> action.run()).isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).code())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }
}
