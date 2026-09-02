package ma.dari.api.listing.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.TYPE;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

@Documented
@Constraint(validatedBy = RoommatesCountValidator.class)
@Target(TYPE)
@Retention(RUNTIME)
public @interface ValidRoommatesCount {

    String message() default "Le nombre actuel de colocataires ne peut pas dépasser le nombre maximal";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
