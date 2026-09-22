import { Skeleton, SkeletonCard, SkeletonRegion } from '@/components/Skeleton';

/** The account dashboard's header, stat row and section cards, unfilled. */
export default function LoadingAccount() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, var(--bg-page) 0%, var(--sable-50) 100%)',
        padding: 'var(--space-6) var(--gutter-mobile) var(--space-8)',
      }}
    >
      <SkeletonRegion
        label="Chargement de votre compte…"
        style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gap: 'var(--space-5)' }}
      >
        {/* Percentage widths and minWidth:0, so a 360px column shrinks the
            header instead of being widened by it. */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <span style={{ display: 'grid', gap: '0.35rem', flex: 1, minWidth: 0 }}>
            <Skeleton width="30%" height={12} />
            <Skeleton width="75%" height={30} />
          </span>
          <Skeleton width={110} height={36} radius="var(--radius-pill)" style={{ flexShrink: 0 }} />
        </header>

        <SkeletonCard style={{ gap: 'var(--space-4)' }}>
          <Skeleton width="45%" height={18} />
          <Skeleton height={10} radius="var(--radius-pill)" />
        </SkeletonCard>

        {/* The same three equal tracks the loaded page uses; minmax(0,…) is what keeps it inside 360px. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-3)' }}>
          {[0, 1, 2].map((tile) => (
            <SkeletonCard key={tile}>
              <Skeleton width={70} height={26} />
              <Skeleton width="60%" height={14} />
            </SkeletonCard>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {[0, 1, 2, 3].map((row) => (
            <SkeletonCard key={row} style={{ gridTemplateColumns: '1fr auto', alignItems: 'center', gridAutoFlow: 'column' }}>
              <Skeleton width="50%" height={16} />
              <Skeleton width={20} height={20} radius="var(--radius-pill)" />
            </SkeletonCard>
          ))}
        </div>
      </SkeletonRegion>
    </main>
  );
}
