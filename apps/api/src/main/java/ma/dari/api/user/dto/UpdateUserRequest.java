package ma.dari.api.user.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record UpdateUserRequest(

        @Size(min = 2, max = 60, message = "Entre 2 et 60 caractères")
        String displayName,

        @Size(max = 60)
        String firstName,

        @Size(max = 60)
        String city,

        @Size(max = 600, message = "600 caractères maximum")
        String bio) {
}
