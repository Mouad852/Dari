import { resolveMediaUrl } from '@/lib/api';

/**
 * A member's photo, or the initial of their display name on the warm gradient
 * when they have none. Decorative (`alt=""`): the name is always printed next
 * to it, so announcing it again would only repeat it.
 */
export function UserAvatar({ displayName, avatarUrl, size }: { displayName: string; avatarUrl: string | null; size: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        flex: '0 0 auto',
        borderRadius: 'var(--radius-avatar)',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, var(--clay-100), var(--sand-100))',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: `var(--weight-extra) ${Math.round(size * 0.36)}px/1 var(--font-display)`,
        color: 'var(--clay-700)',
      }}
    >
      {avatarUrl ? (
        <img
          src={resolveMediaUrl(avatarUrl)}
          alt=""
          decoding="async"
          loading="lazy"
          width={size}
          height={size}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        displayName.charAt(0).toUpperCase()
      )}
    </span>
  );
}
