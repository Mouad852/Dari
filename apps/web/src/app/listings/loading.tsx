import { Skeleton, SkeletonCard, SkeletonRegion } from '@/components/Skeleton';

/**
 * The search page's shape while its shell is fetched: the same <main> padding,
 * the same .search-layout grid (filter rail plus results), and cards at the
 * height ListingCard renders, so the results do not jump into place.
 */
export default function LoadingSearch() {
  return (
    <main style={{ padding: 'var(--space-7) var(--gutter-desktop) var(--space-10)' }}>
      <SkeletonRegion
        label="Chargement des annonces…"
        style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gap: 'var(--space-6)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Skeleton width={110} height={36} radius="var(--radius-pill)" />
          <Skeleton width={180} height={14} />
        </div>

        <div className="search-layout">
          <aside className="search-filters">
            <SkeletonCard style={{ gap: 'var(--space-4)' }}>
              <Skeleton width="55%" height={18} />
              {[0, 1, 2, 3].map((row) => (
                <Skeleton key={row} height={44} radius="var(--radius-control)" />
              ))}
              <Skeleton height={44} radius="var(--radius-pill)" />
            </SkeletonCard>
          </aside>

          <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
            <Skeleton width={220} height={22} />
            <div className="results-grid">
              {[0, 1, 2, 3, 4, 5].map((card) => (
                <SkeletonCard key={card} style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
                  <Skeleton height={190} radius="0" shade="strong" />
                  <span style={{ display: 'grid', gap: 'var(--space-2)', padding: 'var(--card-pad)' }}>
                    <Skeleton width="80%" height={18} />
                    <Skeleton width="45%" height={14} />
                    <Skeleton width="35%" height={20} />
                  </span>
                </SkeletonCard>
              ))}
            </div>
          </div>
        </div>
      </SkeletonRegion>
    </main>
  );
}
