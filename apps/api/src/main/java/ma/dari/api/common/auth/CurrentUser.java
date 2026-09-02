package ma.dari.api.common.auth;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Injects the resolved internal {@link ma.dari.api.user.User}.
 *
 * <p>Using it asserts that the endpoint requires a profile: the resolver throws
 * 401 when unauthenticated and 404 when the profile is missing, so that contract
 * lives in exactly one place instead of being re-checked in every controller.
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
public @interface CurrentUser {
}
