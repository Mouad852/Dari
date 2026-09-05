package ma.dari.api.user;

import jakarta.validation.Valid;
import ma.dari.api.common.auth.AuthenticatedUser;
import ma.dari.api.common.auth.CurrentUser;
import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import ma.dari.api.common.error.NotImplementedYetException;
import ma.dari.api.common.ratelimit.RateLimited;
import ma.dari.api.common.ratelimit.RateLimitType;
import ma.dari.api.user.dto.CreateUserRequest;
import ma.dari.api.user.dto.PublicProfileResponse;
import ma.dari.api.user.dto.UpdateUserRequest;
import ma.dari.api.user.dto.UserResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

/**
 * There is no login or signup endpoint here, and there should never be one.
 * Credentials are Firebase's problem; this API only ever sees a verified token.
 */
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    /** First launch, and the client's retry after any PROFILE_NOT_FOUND. */
    @PostMapping
    @RateLimited(RateLimitType.SIGNUP)
    public ResponseEntity<UserResponse> create(Authentication authentication,
                                               @Valid @RequestBody CreateUserRequest request) {

        if (!(authentication.getPrincipal() instanceof AuthenticatedUser principal)) {
            throw new ApiException(401, ErrorCode.UNAUTHENTICATED, "Connexion requise");
        }

        boolean existed = userService.existsByFirebaseUid(principal.firebaseUid());
        User created = userService.create(principal, request);

        HttpStatus status = existed ? HttpStatus.OK : HttpStatus.CREATED;
        return ResponseEntity.status(status).body(UserResponse.from(created));
    }

    /** 404 with PROFILE_NOT_FOUND when the token is valid but no profile exists. */
    @GetMapping("/me")
    public UserResponse me(@CurrentUser User user) {
        return UserResponse.from(user);
    }

    @PatchMapping("/me")
    public UserResponse updateMe(@CurrentUser User user,
                                 @Valid @RequestBody UpdateUserRequest request) {
        return UserResponse.from(userService.update(user, request));
    }

    /** Public, unauthenticated. Deliberately a different shape from /me. */
    @GetMapping("/{id}")
    public PublicProfileResponse publicProfile(@PathVariable UUID id) {
        return userService.publicProfile(id);
    }

    /** Reuses the listing photo pipeline, EXIF stripping included — a profile
     *  photo is as likely to have been taken at home as a listing photo. */
    @PostMapping("/me/avatar")
    @RateLimited(RateLimitType.UPLOAD)
    public UserResponse uploadAvatar(@CurrentUser User user,
                                     @RequestParam("file") MultipartFile file) {
        return UserResponse.from(userService.uploadAvatar(user, file));
    }

    /**
     * Deletes the Firebase identity, soft-deletes the row and the owner's
     * listings, retains messages. A conversation is two people's data, and one
     * party cannot unilaterally erase the other's history.
     */
    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMe(@CurrentUser User user) {
        userService.deleteAccount(user);
    }

    /** Reserved by §7 for fast-follow phone verification. */
    @PostMapping("/me/phone-verification")
    public Object startPhoneVerification(@CurrentUser User user) {
        throw new NotImplementedYetException("post-MVP");
    }
}
