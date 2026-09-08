/**
 * The only place an English enum value becomes French.
 *
 * See docs/NAMING.md. Enum values are identifiers and stay English everywhere —
 * schema, API, TypeScript. They become French exactly here, on the way to a
 * screen. A label written inline at a call site is how one concept ends up with
 * three slightly different French words across three screens.
 *
 * Every map is typed as an exhaustive `Record`, so adding an enum value breaks
 * the build until its label exists. The compiler catches the missing
 * translation, not a reviewer, and not a user.
 *
 * Numbers, money and dates do not belong here — those go through format.ts,
 * which owns the thin-space thousands, the decimal comma and the date forms.
 */

import type { AvailabilityState, ListingRoomType, ListingStatus, PropertyType, ReportReason, ReportTargetType, RoomType, UserAccountStatus, VerificationTier } from '@/types/api';

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  APARTMENT: 'Appartement',
  HOUSE: 'Maison',
  STUDIO: 'Studio',
};

/** Whether the room itself is exclusive or shared — independent of the property type above. */
export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  PRIVATE: 'Chambre privée',
  SHARED: 'Chambre partagée',
};

/** What kind of room, physically — independent of RoomType above (private/shared for the offered room). */
export const LISTING_ROOM_TYPE_LABELS: Record<ListingRoomType, string> = {
  BEDROOM: 'Chambre',
  SALON: 'Salon',
  KITCHEN: 'Cuisine',
  BATHROOM: 'Salle de bain',
  TERRACE: 'Terrasse',
  STORAGE: 'Rangement',
};

/** Shown to the owner. Seekers never see a status — they only see what is published. */
export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: 'Brouillon',
  PENDING_REVIEW: 'En cours de vérification',
  PUBLISHED: 'Publiée',
  REJECTED: 'Non publiée',
  SUSPENDED: 'Suspendue',
  EXPIRED: 'Expirée',
};

/**
 * REJECTED reads as "Non publiée", not "Rejetée".
 *
 * The copy rules call for plain and non-blaming: the owner is told the outcome
 * and given the reason separately. "Rejetée" adds a verdict to a fact.
 */

export const AVAILABILITY_LABELS: Record<AvailabilityState, string> = {
  AVAILABLE: 'Disponible',
  ROOM_FOUND: 'Chambre trouvée',
  CLOSED: 'Annonce fermée',
};

export const VERIFICATION_LABELS: Record<VerificationTier, string> = {
  NONE: 'Non vérifié',
  EMAIL: 'Email vérifié',
  EMAIL_PHONE: 'Email et téléphone vérifiés',
};

/**
 * Why a favorited listing is no longer available.
 *
 * Deliberately not the same strings as AVAILABILITY_LABELS: on the favorites
 * screen the user needs to know what happened to a room they saved, which is a
 * different sentence from a badge on a live listing. Two contexts, two labels —
 * that is two entries, never one function with a flag.
 */
export const UNAVAILABLE_REASON_LABELS = {
  ROOM_FOUND: 'Chambre trouvée',
  CLOSED: 'Annonce retirée',
  SUSPENDED: 'Annonce suspendue',
  EXPIRED: 'Annonce expirée',
} as const;

/** Admin-only — a seeker or owner never sees an account's moderation status directly. */
export const USER_ACCOUNT_STATUS_LABELS: Record<UserAccountStatus, string> = {
  ACTIVE: 'Actif',
  SUSPENDED: 'Suspendu',
  BANNED: 'Banni',
};

/** Admin-only — the closed reason list from design doc §6, shown in the report queue. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  FAKE_LISTING: 'Annonce fictive',
  MISLEADING_PRICE: 'Prix trompeur',
  UNAUTHORISED_BROKER: 'Intermédiaire non autorisé',
  INAPPROPRIATE_BEHAVIOR: 'Comportement inapproprié',
  DISCRIMINATION: 'Discrimination',
  SUSPECTED_SCAM: 'Suspicion d’arnaque',
  OTHER: 'Autre',
};

export const REPORT_TARGET_LABELS: Record<ReportTargetType, string> = {
  LISTING: 'Annonce',
  USER: 'Utilisateur',
};

/**
 * Amenity codes come from the `amenities` table (`GET /amenities`), not a
 * closed TypeScript union — new codes can be seeded without a frontend
 * deploy. Not exhaustive like the Records above; callers fall back to the
 * raw code for anything added after this map was written.
 */
export const AMENITY_LABELS: Record<string, string> = {
  wifi: 'Wi‑Fi',
  parking: 'Parking',
  balcony: 'Balcon',
  kitchen: 'Cuisine',
  laundry: 'Lave-linge',
  air_conditioning: 'Climatisation',
  elevator: 'Ascenseur',
  near_transport: 'Proximité transport',
  furnished: 'Meublé',
  smoke_free: 'Sans fumée',
};
