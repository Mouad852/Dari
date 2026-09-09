/**
 * Response shapes from the Dari API.
 *
 * Hand-written and kept deliberately incomplete: only what the skeleton needs
 * plus the enums, which are contract. Fields are added as endpoints are built,
 * not guessed ahead of them — a type that promises a field the server does not
 * send is worse than no type.
 *
 * If this file grows past a few hundred lines, generate it from an OpenAPI
 * document instead of maintaining two sources of truth by hand.
 */

// --- listing lifecycle (design doc §4) ---------------------------------------

export type PropertyType = 'APARTMENT' | 'HOUSE' | 'STUDIO';

/** Whether the offered room is exclusive to the tenant or shared with another. */
export type RoomType = 'PRIVATE' | 'SHARED';

/** The moderation axis. */
export type ListingStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'EXPIRED';

/** The owner's axis. Independent of status — never collapse the two. */
export type AvailabilityState = 'AVAILABLE' | 'ROOM_FOUND' | 'CLOSED';

// --- users --------------------------------------------------------------------

export type VerificationTier = 'NONE' | 'EMAIL' | 'EMAIL_PHONE';

/** The caller's own profile, from /users/me. Private fields are legitimate here. */
export interface Me {
  id: string;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  firstName: string | null;
  displayName: string;
  city: string | null;
  bio: string | null;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
  verification: VerificationTier;
  createdAt: string;
}

/**
 * Someone else's profile, from /users/{id}.
 *
 * A deliberately different type from {@link Me}, not a Partial of it. Sharing
 * one type between the two would make it possible to render a private field by
 * accident and have it typecheck.
 */
export interface PublicProfile {
  id: string;
  displayName: string;
  city: string | null;
  bio: string | null;
  avatarUrl: string | null;
  verification: VerificationTier;
  memberSince: string;
  activeListingCount: number;
}

// --- listings ------------------------------------------------------------------

/**
 * A listing as the public sees it.
 *
 * Coordinates are fuzzed within ~200m at the server's DTO layer. Moderation
 * status is intentionally absent; public callers only need availability.
 */
export interface PublicListing {
  id: string;
  title: string;
  city: string;
  neighborhood: string;
  priceRent: number;
  latitude: number;
  longitude: number;
  availabilityState: AvailabilityState;
  createdAt: string;
  /**
   * Root-relative cover photo URL, or null when the listing has none. Prefix
   * with `apiOrigin` — it is served by the API, not the web app.
   */
  coverPhotoUrl: string | null;
  /** Present only on proximity searches. */
  distanceMetres?: number;
}

/** Mirrors HouseRulesResponse. Every field is independently nullable — an owner may answer some questions and leave others unset. */
export interface HouseRules {
  smokingAllowed: boolean | null;
  petsAllowed: boolean | null;
  guestsAllowed: boolean | null;
  /** "HH:mm:ss", e.g. "22:00:00". Always both-set or both-null. */
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  otherRules: string | null;
}

export type ListingRoomType = 'BEDROOM' | 'SALON' | 'KITCHEN' | 'BATHROOM' | 'TERRACE' | 'STORAGE';

/** Mirrors ListingRoomResponse. One physical room in the listing's apartment (§3). */
export interface ListingRoom {
  id: string;
  roomType: ListingRoomType;
  isRentable: boolean;
  isShared: boolean;
  description: string | null;
}

export interface PublicListingDetail extends PublicListing {
  priceDeposit: number | null;
  description: string | null;
  wifiIncluded: 'INCLUDED' | 'NOT_INCLUDED' | 'NA';
  electricityIncluded: 'INCLUDED' | 'NOT_INCLUDED' | 'NA';
  waterIncluded: 'INCLUDED' | 'NOT_INCLUDED' | 'NA';
  propertyType: PropertyType | null;
  numBedrooms: number | null;
  numBathrooms: number | null;
  roomType: RoomType | null;
  roomFurnishing: 'FULLY_FURNISHED' | 'PARTIALLY_FURNISHED' | 'UNFURNISHED' | null;
  commonAreasFurnished: boolean | null;
  availableFrom: string | null;
  minStayMonths: number | null;
  amenityCodes: string[];
  photos: ListingPhoto[];
  houseRules: HouseRules | null;
  rooms: ListingRoom[];
}

/**
 * A stored listing photo. Mirrors ListingPhotoResponse on the server.
 *
 * `url` is root-relative (/uploads/...) and served by the API, not the web app —
 * prefix it with `apiOrigin` from lib/api before putting it in a src.
 */
export interface ListingPhoto {
  id: string;
  url: string;
  mimeType: string;
  width: number;
  height: number;
  sortOrder: number;
  isCover: boolean;
  createdAt: string;
}

/** Fuzzed map pin response returned by /listings/map. */
export interface MapPin {
  id: string;
  title: string;
  city: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
}

/**
 * The owner's own view of a listing, from /listings/mine and /admin/listings —
 * unfuzzed, every status, with the fields a dashboard needs that the public
 * `PublicListing` deliberately omits (rejectionReason, updatedAt).
 */
export interface ListingDetail {
  id: string;
  title: string;
  city: string;
  neighborhood: string;
  priceRent: number;
  /**
   * The owner's own words. Present on the wire all along; declared late, because
   * the moderation queue needed it — a moderator judging a submission has to be
   * able to read the description without leaving the queue, since a scam, a
   * phone number, or discriminatory wording lives there and nowhere else.
   */
  description: string | null;
  status: ListingStatus;
  availabilityState: AvailabilityState;
  createdAt: string;
  updatedAt: string;
  rejectionReason: string | null;
  amenityCodes: string[];
  /**
   * Root-relative cover photo URL, or null when the listing has none. Prefix
   * with `apiOrigin` — it is served by the API, not the web app.
   *
   * Added late: only PublicListing carried a cover, so the owner's list and the
   * moderation queue both drew the design system's placeholder for listings that
   * had a real photograph. In the queue that meant approving without seeing it.
   */
  coverPhotoUrl: string | null;
  houseRules: HouseRules | null;
  rooms: ListingRoom[];
}

// --- moderation and admin (design doc §6, admin console gated on role) --------

export type UserAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export type ReportTargetType = 'LISTING' | 'USER';

export type ReportReason =
  | 'FAKE_LISTING'
  | 'MISLEADING_PRICE'
  | 'UNAUTHORISED_BROKER'
  | 'INAPPROPRIATE_BEHAVIOR'
  | 'DISCRIMINATION'
  | 'SUSPECTED_SCAM'
  | 'OTHER';

/** One row per target, not per report — five reports on one listing is one decision. */
export interface AdminReportQueueItem {
  targetType: ReportTargetType;
  targetId: string;
  reportCount: number;
  reporterCount: number;
  firstReportedAt: string;
  reasons: ReportReason[];
  /** Each report's free-text context, in the order reported. Empty strings are already filtered out server-side. */
  details: string[];
  autoFlagged: boolean;
  /** Reports these same reporters have had dismissed before. Context, not a verdict. */
  priorDismissedReports: number;
  /** Listing title or user display name, resolved server-side. Null if the target is gone. */
  targetLabel: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  firstName: string | null;
  city: string | null;
  role: 'USER' | 'ADMIN';
  status: UserAccountStatus;
  reportCount: number;
  createdAt: string;
}

// --- messaging (design doc §7, REST-only for MVP) ------------------------------

/** The inbox row and the thread header — same shape, from /conversations and /conversations/{id}. */
export interface Conversation {
  id: string;
  listingId: string | null;
  participantAId: string;
  participantBId: string;
  otherUserId: string;
  otherUserDisplayName: string;
  createdAt: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  sentAt: string;
  readAt: string | null;
}




// --- pagination ----------------------------------------------------------------

/**
 * Mirrors CursorPage on the server. No total count, by design.
 *
 * `nextCursor` is opaque: pass it back verbatim and read nothing out of it. Its
 * payload differs per sort, and anything decoded from it here would break the
 * first time a sort is added.
 */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
