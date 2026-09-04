import { apiOrigin } from '@/lib/api';

/**
 * A listing's cover photo, on the two dashboards that are not yet built on the
 * design system's `ListingCard`.
 *
 * Both `/account/listings` and `/admin/listings` hand-rolled a gradient box with
 * the word "Photo" in it and rendered it unconditionally — including for
 * listings that had a real photograph. On the owner's own list that was
 * cosmetic; in the moderation queue it meant deciding approve-or-reject without
 * ever seeing the picture.
 *
 * The empty state says "Sans photo", not "Photo". "Photo" reads as a caption for
 * an image that failed to load; "Sans photo" is a statement about the listing,
 * which is what a moderator actually needs to know — a submission with no
 * photograph cannot be approved, because `submit()` refuses it.
 *
 * Deliberately not `ListingCard`: these two screens are dashboards with their
 * own status chips and action rows, and swapping the whole card is the job of
 * the rebuild those screens are still queued for. This is the photo only.
 */
export function ListingThumb({
  coverPhotoUrl,
  alt,
  minHeight = 180,
}: {
  coverPhotoUrl: string | null;
  /** What the photo shows, for a screen reader. Usually the listing title. */
  alt: string;
  minHeight?: number;
}) {
  if (coverPhotoUrl) {
    return (
      <div style={{ minHeight, background: 'var(--sable-100)', position: 'relative' }}>
        <img
          src={`${apiOrigin}${coverPhotoUrl}`}
          alt={alt}
          loading="lazy"
          decoding="async"
          style={{ display: 'block', width: '100%', height: minHeight, objectFit: 'cover' }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight,
        background: 'var(--sable-100)',
        color: 'var(--text-body)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: 'var(--type-caption)',
        letterSpacing: 'var(--ls-caps)',
        textTransform: 'uppercase',
      }}
    >
      Sans photo
    </div>
  );
}
