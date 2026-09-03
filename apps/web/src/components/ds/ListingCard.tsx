'use client';

import { useState, type CSSProperties } from 'react';

import { Badge, type BadgeProps } from './Badge';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { useFocusRing } from './useFocusRing';

/**
 * The product's signature card: photo, price, location, flatmate meta.
 * `vertical` in feeds and grids, `horizontal` in saved and search lists.
 *
 * Ported from `design-system/components/listings/ListingCard.jsx`. Every token,
 * radius, shadow and dimension is as written — this is the object a visitor
 * looks at more than any other, so drift here is drift everywhere.
 *
 * Three deliberate departures:
 *
 * - **No `rating`.** The source's own example passes `rating="4,8"`, and nothing
 *   in Dari records a rating: no schema, no endpoint, no way for anyone to leave
 *   one. That is the same invented figure already removed from the homepage. A
 *   design system's examples are a visual language, not a product spec.
 * - **It is a link.** The source is a `div` with `onClick`: not keyboard
 *   reachable, no middle-click, no open-in-new-tab, and invisible to a crawler —
 *   on the pages this product most needs indexed. `href` renders a real anchor
 *   whose hit area covers the card, with the save button layered above it so a
 *   control is never nested inside a link.
 * - **A real `<img>`,** not a CSS background: `loading="lazy"` and decoding off
 *   the main thread matter on a feed of twenty cards over a mobile connection.
 *   `alt=""` because the adjacent link already names the listing.
 */
export interface ListingCardProps {
  /** Photo URL. Renders the warm placeholder when absent. */
  image?: string;
  title?: string;
  city?: string;
  /** Neighbourhood, shown before the city. */
  district?: string;
  /** Formatted by the caller, e.g. "3 200" — the card does not do currency. */
  price?: string | number;
  /** Rent period label. Default "mois". */
  period?: string;
  /** Corner flag, e.g. "Nouveau". */
  badge?: string;
  badgeTone?: BadgeProps['tone'];
  /** Flatmate summary, e.g. "2 colocataires". */
  flatmates?: string;
  saved?: boolean;
  onSave?: () => void;
  /** Where the card goes. Omit only for a card that is genuinely not a link. */
  href?: string;
  onClick?: () => void;
  layout?: 'vertical' | 'horizontal';
  style?: CSSProperties;
}

export function ListingCard({
  image,
  title,
  city,
  district,
  price,
  period = 'mois',
  badge,
  badgeTone = 'brand',
  flatmates,
  saved = false,
  onSave,
  href,
  onClick,
  layout = 'vertical',
  style,
}: ListingCardProps) {
  const [hovered, setHovered] = useState(false);
  const { focusVisible, focusProps } = useFocusRing();
  const row = layout === 'horizontal';
  const lifted = hovered || focusVisible;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: row ? 'row' : 'column',
        gap: row ? 'var(--space-4)' : 0,
        background: 'var(--surface-card)',
        border: '1px solid var(--border-hairline)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: focusVisible ? 'var(--focus-ring)' : lifted ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transform: lifted ? 'translateY(-2px)' : 'none',
        transition:
          'box-shadow var(--dur-med) var(--ease-standard),transform var(--dur-med) var(--ease-standard)',
        ...style,
      }}
    >
      <div
        style={{
          position: 'relative',
          flex: row ? '0 0 116px' : 'none',
          aspectRatio: row ? '1 / 1' : '4 / 3',
          background: 'var(--sable-200)',
          borderRadius: row ? 'var(--radius-card-inner)' : 0,
          margin: row ? 'var(--space-4) 0 var(--space-4) var(--space-4)' : 0,
          overflow: 'hidden',
        }}
      >
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // Source used --sable-400: 1.82:1 on --sable-200. It is real text
              // telling the reader a photo is missing, not decoration.
              color: 'var(--text-muted)',
              font: 'var(--type-caption)',
              letterSpacing: 'var(--ls-caps)',
              textTransform: 'uppercase',
            }}
          >
            Photo
          </span>
        )}
        {!row && <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim-image)' }} />}
        {badge && (
          <Badge
            tone={badgeTone}
            size="sm"
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              background: 'var(--surface-glass)',
              backdropFilter: 'var(--blur-glass)',
              border: 'none',
            }}
          >
            {badge}
          </Badge>
        )}
        {!row && onSave && (
          // Above the card link, and outside it: a button inside an anchor is
          // invalid markup and ambiguous to assistive technology.
          <IconButton
            icon="heart"
            variant="glass"
            size="sm"
            active={saved}
            label={saved ? 'Retirer des favoris' : 'Enregistrer'}
            onClick={(event) => {
              event.stopPropagation();
              onSave();
            }}
            style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}
          />
        )}
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: row ? 'var(--space-4) var(--space-4) var(--space-4) 0' : 'var(--card-pad)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
          <h3
            style={{
              flex: 1,
              minWidth: 0,
              margin: 0,
              font: 'var(--type-h3)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {href ? (
              <a
                href={href}
                {...focusProps}
                // The card paints the focus ring; without this the anchor also
                // draws the global outline, ringing the title inside the ring.
                style={{ color: 'inherit', textDecoration: 'none', outline: 'none' }}
              >
                {title}
                {/* Stretches the link over the whole card. Positioned against
                    the card, which is the only positioned ancestor. */}
                <span style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
              </a>
            ) : (
              title
            )}
          </h3>
        </div>
        <p
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            margin: '4px 0 0',
            font: 'var(--type-caption)',
            color: 'var(--text-muted)',
          }}
        >
          <Icon name="map-pin" size={13} />
          {district ? `${district}, ${city}` : city}
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
            marginTop: 'var(--space-4)',
          }}
        >
          <span style={{ font: 'var(--type-price)', color: 'var(--text-price)' }}>
            {price}
            <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', marginLeft: 4 }}>
              MAD/{period}
            </span>
          </span>
          {flatmates && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                font: 'var(--type-caption)',
                color: 'var(--text-muted)',
              }}
            >
              <Icon name="users-round" size={13} />
              {flatmates}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
