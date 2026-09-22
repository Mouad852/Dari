import { Skeleton, SkeletonRegion } from '@/components/Skeleton';

/**
 * A listing while its detail is fetched. The gallery block is the 360px
 * ListingGallery renders, and the column below copies that page's padding and
 * 900px measure, so the title lands where the skeleton's title was.
 */
export default function LoadingListingDetail() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      <SkeletonRegion label="Chargement de l’annonce…">
        <Skeleton height={360} radius="0" shade="strong" />

        <div style={{ padding: 'var(--space-6) var(--gutter-mobile)', display: 'grid', gap: 'var(--space-6)', maxWidth: 900, margin: '0 auto' }}>
          <section style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <Skeleton width="70%" height={34} />
            <Skeleton width={200} height={16} />
            <Skeleton width={150} height={26} />
          </section>

          <section style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <Skeleton width={220} height={20} />
            <Skeleton height={14} />
            <Skeleton height={14} />
            <Skeleton width="60%" height={14} />
          </section>

          <section style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <Skeleton width={180} height={20} />
            <Skeleton height={120} radius="var(--radius-card)" />
          </section>
        </div>
      </SkeletonRegion>
    </main>
  );
}
