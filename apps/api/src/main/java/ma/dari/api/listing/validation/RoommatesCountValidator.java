package ma.dari.api.listing.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import ma.dari.api.listing.dto.CreateListingRequest;
import ma.dari.api.listing.dto.UpdateListingRequest;

public class RoommatesCountValidator implements ConstraintValidator<ValidRoommatesCount, Object> {

    @Override
    public boolean isValid(Object value, ConstraintValidatorContext context) {
        Short current;
        Short maximum;
        if (value instanceof CreateListingRequest request) {
            current = request.currentRoommatesCount();
            maximum = request.maxRoommates();
        } else if (value instanceof UpdateListingRequest request) {
            current = request.currentRoommatesCount();
            maximum = request.maxRoommates();
        } else {
            return true;
        }

        if (current == null || maximum == null || current <= maximum) {
            return true;
        }

        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(context.getDefaultConstraintMessageTemplate())
                .addPropertyNode("maxRoommates")
                .addConstraintViolation();
        return false;
    }
}
