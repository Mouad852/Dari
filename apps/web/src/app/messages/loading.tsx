import { Skeleton, SkeletonRegion } from '@/components/Skeleton';

/** The inbox's own gradient, measure and row height, minus the content. */
export default function LoadingInbox() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, var(--bg-page) 0%, var(--sable-50) 100%)',
        padding: 'var(--space-6) var(--gutter-mobile) var(--space-8)',
      }}
    >
      <SkeletonRegion
        label="Chargement de vos conversations…"
        style={{ maxWidth: 'var(--container-prose)', margin: '0 auto', display: 'grid', gap: 'var(--space-5)' }}
      >
        <header style={{ display: 'grid', gap: '0.35rem' }}>
          <Skeleton width={90} height={12} />
          <Skeleton width={240} height={30} />
        </header>

        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {[0, 1, 2, 3].map((row) => (
            <div
              key={row}
              style={{
                display: 'flex',
                gap: 'var(--space-4)',
                alignItems: 'center',
                padding: 'var(--card-pad)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-card)',
                background: 'var(--surface-card)',
              }}
            >
              <Skeleton width={48} height={48} radius="var(--radius-avatar)" shade="strong" />
              <span style={{ display: 'grid', gap: 'var(--space-2)', flex: 1, minWidth: 0 }}>
                <Skeleton width="40%" height={16} />
                <Skeleton width="75%" height={14} />
              </span>
            </div>
          ))}
        </div>
      </SkeletonRegion>
    </main>
  );
}
