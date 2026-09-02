package ma.dari.api.listing.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Null;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import ma.dari.api.listing.ChargeInclusion;
import ma.dari.api.listing.PropertyType;
import ma.dari.api.listing.RoomFurnishing;
import ma.dari.api.listing.RoomType;
import ma.dari.api.listing.validation.ValidRoommatesCount;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

@JsonIgnoreProperties(ignoreUnknown = true)
@ValidRoommatesCount
public record UpdateListingRequest(
        @Pattern(regexp = ".*\\S.*", message = "Titre requis")
        @Size(max = 120, message = "120 caractères maximum")
        String title,

        @Pattern(regexp = ".*\\S.*", message = "Ville requise")
        @Size(max = 80, message = "80 caractères maximum")
        String city,

        @Pattern(regexp = ".*\\S.*", message = "Quartier requis")
        @Size(max = 80, message = "80 caractères maximum")
        String neighborhood,

        @Min(-90) @Max(90)
        Double latitude,

        @Min(-180) @Max(180)
        Double longitude,

        @DecimalMin(value = "0.00", inclusive = true, message = "Le loyer doit être positif")
        @Digits(integer = 8, fraction = 2, message = "Le loyer doit comporter au maximum 8 chiffres entiers et 2 décimales")
        BigDecimal priceRent,

        @DecimalMin(value = "0.00", inclusive = true, message = "La caution doit être positive")
        @Digits(integer = 8, fraction = 2, message = "La caution doit comporter au maximum 8 chiffres entiers et 2 décimales")
        BigDecimal priceDeposit,

        @Size(max = 2000, message = "2000 caractères maximum")
        String description,

        ChargeInclusion wifiIncluded,
        ChargeInclusion electricityIncluded,
        ChargeInclusion waterIncluded,
        PropertyType propertyType,
        @Min(value = 0, message = "Le nombre de chambres doit être compris entre 0 et 20")
        @Max(value = 20, message = "Le nombre de chambres doit être compris entre 0 et 20")
        Short numBedrooms,
        @Min(value = 0, message = "Le nombre de salles de bain doit être compris entre 0 et 20")
        @Max(value = 20, message = "Le nombre de salles de bain doit être compris entre 0 et 20")
        Short numBathrooms,
        RoomType roomType,
        RoomFurnishing roomFurnishing,
        Boolean commonAreasFurnished,
        @Min(value = 0, message = "Le nombre actuel de colocataires doit être compris entre 0 et 20")
        @Max(value = 20, message = "Le nombre actuel de colocataires doit être compris entre 0 et 20")
        Short currentRoommatesCount,
        @Min(value = 1, message = "Le nombre maximal de colocataires doit être compris entre 1 et 20")
        @Max(value = 20, message = "Le nombre maximal de colocataires doit être compris entre 1 et 20")
        Short maxRoommates,
        @FutureOrPresent(message = "La date de disponibilité doit être aujourd'hui ou ultérieure")
        LocalDate availableFrom,

        @Min(value = 1, message = "La durée minimale doit être d'au moins 1 mois")
        @Max(value = 36, message = "La durée minimale ne peut pas dépasser 36 mois")
        Short minStayMonths,
        @Null(message = "La raison du rejet est réservée à la modération")
        String rejectionReason,
        Set<String> amenityCodes
) {
}
