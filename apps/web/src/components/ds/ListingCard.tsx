'use client';

import { useState, type CSSProperties } from 'react';

import { Badge, type BadgeProps } from './Badge';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { useFocusRing } from './useFocusRing';

/**
 * The product's signature card: photo, price, location, flatmate meta.
 * `vertical` is the only layout any page renders today — `favorites/page.tsx`
 * moved off `horizontal` onto the shared `.results-grid` on 2026-09-09, and
 * nothing else ever passed it. `horizontal` stays supported (untested against
 * a real page) for a future compact list view rather than removed outright.
 *
 * Ported from `design-system/components/listings/ListingCard.jsx`. Every token,
 * radius, shadow and dimension is as written — this is the object a visitor
 * looks at more than any other, so drift here is drift everywhere.
 *
 * Deliberate departures, each recorded at the line it affects:
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
 * - **The save button exists in both layouts,** and a saved heart is filled
 *   rather than only tinted — colour alone is not a status cue.
 * - **The badge moves to the price row in `horizontal`,** where the 116px
 *   thumbnail cannot hold it and the title will not share a line with it.
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
  /**
   * True while a save/unsave request for this card is in flight. Disables
   * the button without unmounting it -- a caller that instead passes
   * `onSave={pending ? undefined : () => …}` to hide the button mid-request
   * unmounts whatever had focus and drops it to `<body>`, since the button
   * disappears and a fresh one (with no memory of being focused) takes its
   * place once the request settles.
   */
  savePending?: boolean;
  /** Where the card goes. Omit only for a card that is genuinely not a link. */
  href?: string;
  onClick?: () => void;
  layout?: 'vertical' | 'horizontal';
  /**
   * The title's heading level. Default `3` is correct wherever the grid
   * already sits under a real `h2` (the homepage's "Chambres en vedette",
   * a city page's own section heading) — one level down from it, as
   * intended. Callers with nothing at `h2` between the page's `h1` and this
   * grid (an empty aside/collapsed disclosure with no visible heading of
   * its own, or no intervening heading at all) need `2` instead, or a
   * screen reader's heading navigation skips straight from `h1` to `h3`.
   * Found live via an automated Lighthouse audit, not by reading source —
   * a per-file heading-sequence read cannot see across into this shared
   * component to know what actually renders next to it at runtime.
   */
  headingLevel?: 2 | 3;
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
  savePending = false,
  href,
  onClick,
  layout = 'vertical',
  headingLevel = 3,
  style,
}: ListingCardProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
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
        {/*
          Over the photo in the vertical layout, as designed. The horizontal
          thumbnail is 116px wide, where anything longer than "Nouveau" wraps
          under the save button, so there the badge moves beside the title --
          the source has no horizontal example carrying one.
        */}
        {badge && !row && (
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
        {onSave && (
          // Above the card link, and outside it: a button inside an anchor is
          // invalid markup and ambiguous to assistive technology.
          //
          // The source renders this only in the vertical layout. That reading
          // does not survive its own prompt file, which assigns `horizontal` to
          // "saved/search lists" — a saved list whose rows cannot be unsaved.
          <IconButton
            icon="heart"
            variant="glass"
            size="sm"
            active={saved}
            fill={saved ? 'currentColor' : undefined}
            label={saved ? 'Retirer des favoris' : 'Enregistrer'}
            disabled={savePending}
            onClick={(event) => {
              event.stopPropagation();
              onSave();
            }}
            style={{ position: 'absolute', top: row ? 4 : 8, right: row ? 4 : 8, zIndex: 2 }}
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
          <Heading
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
          </Heading>
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
            // Wraps rather than compressing: the price is the one thing on this
            // card that must never break mid-number, so a badge that cannot fit
            // beside it drops to its own line instead.
            flexWrap: 'wrap',
            gap: 'var(--space-3) var(--space-4)',
            marginTop: 'var(--space-4)',
          }}
        >
          <span style={{ font: 'var(--type-price)', color: 'var(--text-price)', whiteSpace: 'nowrap' }}>
            {price}
            <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', marginLeft: 4 }}>
              MAD/{period}
            </span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {/* In the horizontal layout this is the badge's home: beside the
                title it truncated the title, and over the 116px thumbnail it
                wrapped under the save button. */}
            {badge && row && (
              <Badge tone={badgeTone} size="sm">
                {badge}
              </Badge>
            )}
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
          </span>
        </div>
      </div>
    </div>
  );
}
