'use client';

import { ArrowRight, MapPin, ShieldCheck } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiFetch, ApiError, type CursorPage } from '@/lib/api';
import type { PublicListing } from '@/types/api';

const CITY_LABELS: Record<string, string> = {
  rabat: 'Rabat',
  casablanca: 'Casablanca',
  marrakech: 'Marrakech',
  tanger: 'Tanger',
};

const NEIGHBORHOODS = [
  ['Agdal', 'Chambres à partir de 2 600 MAD'],
  ['Hassan', 'Studio et chambres meublées'],
  ['Hay Riad', 'Logements calmes et sécurisés'],
  ['Médina', 'Colocation dans les quartiers historiques'],
] as const;

const HIGHLIGHTS = [
  ['420', 'annonces actives'],
  ['2 600 MAD', 'budget moyen'],
  ['6 jours', 'temps moyen de réponse'],
] as const;

export default function CityLandingPage() {
  const params = useParams<{ city: string }>();
  const cityName = CITY_LABELS[params.city.toLowerCase()] ?? 'Rabat';
  const [listings, setListings] = useState<PublicListing[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    apiFetch<CursorPage<PublicListing>>(
      `/listings?city=${encodeURIComponent(cityName)}&sort=updated`,
    )
      .then((page) => {
        if (isCurrent) {
          setListings(page.items);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (isCurrent) {
          setError(cause instanceof ApiError ? cause.message : 'Une erreur est survenue');
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [cityName]);

  return (
    <main style={{ padding: 'var(--space-8) var(--gutter-desktop) var(--space-11)' }}>
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gap: 'var(--space-8)' }}>
        <section
          style={{
            background: 'linear-gradient(180deg, var(--clay-50) 0%, var(--bg-page) 72%)',
            borderRadius: 'var(--radius-2xl)',
            padding: 'var(--space-9)',
            border: '1px solid var(--border-hairline)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 'var(--space-8)', alignItems: 'center' }}>
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <span style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', gap: '0.5rem', color: 'var(--brand)', background: 'var(--brand-subtle)', borderRadius: 'var(--radius-pill)', padding: '0.5rem 0.8rem', font: 'var(--type-label)' }}>
                <ShieldCheck size={16} />
                Annonces vérifiées
              </span>
              <h1 style={{ margin: 0, font: 'var(--weight-extra) 48px/1.08 var(--font-display)', letterSpacing: 'var(--ls-display)' }}>
                Colocation à {cityName}
              </h1>
              <p style={{ margin: 0, color: 'var(--text-muted)', font: 'var(--type-body-lg)', maxWidth: 600 }}>
                Trouvez une chambre, un studio ou une colocation à {cityName}, avec des loyers annoncés charges comprises et des profils vérifiés avant le premier contact.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                <a
                  href={`/listings?city=${encodeURIComponent(cityName)}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'var(--brand)',
                    color: '#fff',
                    borderRadius: 'var(--radius-pill)',
                    padding: '0.85rem 1.2rem',
                    textDecoration: 'none',
                    font: 'var(--weight-semibold) var(--type-body-md) var(--font-ui)',
                  }}
                >
                  Voir les annonces
                  <ArrowRight size={16} />
                </a>
                <span style={{ color: 'var(--text-muted)', font: 'var(--type-body-md)' }}>Loyers de 2 100 à 5 400 MAD</span>
              </div>
            </div>

            <div
              style={{
                minHeight: 280,
                borderRadius: 'var(--radius-2xl)',
                background: 'var(--sable-200)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--sable-500)',
                font: 'var(--type-caption)',
                letterSpacing: 'var(--ls-caps)',
                textTransform: 'uppercase',
              }}
            >
              Photo {cityName}
            </div>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-5)' }}>
          {HIGHLIGHTS.map(([value, label]) => (
            <div key={label} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-card)', padding: '1.25rem' }}>
              <div style={{ font: 'var(--weight-bold) 28px/1.2 var(--font-display)', color: 'var(--text-primary)' }}>{value}</div>
              <div style={{ color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>{label}</div>
            </div>
          ))}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 'var(--space-7)' }}>
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-card)', padding: 'var(--space-6)' }}>
            <h2 style={{ margin: '0 0 var(--space-4)', font: 'var(--weight-bold) 30px/1.2 var(--font-display)' }}>Quartiers populaires</h2>
            <div style={{ display: 'grid', gap: '0.9rem' }}>
              {NEIGHBORHOODS.map(([name, summary]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-hairline)', paddingBottom: '0.7rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <MapPin size={16} color="var(--brand)" />
                    <span style={{ font: 'var(--type-body-md)', color: 'var(--text-primary)' }}>{name}</span>
                  </div>
                  <span style={{ color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>{summary}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-card)', padding: 'var(--space-6)' }}>
            <h2 style={{ margin: '0 0 var(--space-4)', font: 'var(--weight-bold) 30px/1.2 var(--font-display)' }}>Le marché local</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', font: 'var(--type-body-md)', lineHeight: 1.7 }}>
              À {cityName}, les chambres restent très demandées autour des quartiers centraux et des campus. Les logements meublés et les studios proches des transports sont les plus prisés, avec un budget typique entre 2 500 et 4 000 MAD.
            </p>
          </div>
        </section>

        <section style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-3)' }}>
            <h2 style={{ margin: 0, font: 'var(--weight-bold) 30px/1.2 var(--font-display)' }}>
              Annonces à {cityName}
            </h2>
            <a href={`/listings?city=${encodeURIComponent(cityName)}`} style={{ color: 'var(--brand)', font: 'var(--type-body-sm)' }}>
              Voir tout
            </a>
          </div>
          {error ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>{error}</p>
          ) : listings.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>
              Chargement des annonces disponibles…
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-5)' }}>
              {listings.slice(0, 3).map((listing) => (
                <a
                  key={listing.id}
                  href={`/listings/${listing.id}`}
                  style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-hairline)',
                    borderRadius: 'var(--radius-card)',
                    padding: 'var(--space-4)',
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ color: 'var(--text-subtle)', font: 'var(--type-eyebrow)', textTransform: 'uppercase' }}>
                    {listing.neighborhood}
                  </div>
                  <div style={{ marginTop: '0.3rem', font: 'var(--type-h3)' }}>{listing.title}</div>
                  <div style={{ marginTop: 'var(--space-3)', color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>
                    {new Intl.NumberFormat('fr-MA').format(listing.priceRent)} MAD/mois
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
