import {
  ArrowRight,
  KeyRound,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';

const CITIES = [
  ['Rabat', '412 chambres'],
  ['Casablanca', '938 chambres'],
  ['Marrakech', '307 chambres'],
  ['Tanger', '186 chambres'],
] as const;

const FEATURED = [
  {
    id: 1,
    title: 'Chambre lumineuse',
    district: 'Agdal',
    city: 'Rabat',
    price: '3 200',
    flatmates: '2 colocataires',
    rating: '4,8',
    badge: 'Nouveau',
  },
  {
    id: 2,
    title: 'Studio Gauthier',
    district: 'Gauthier',
    city: 'Casablanca',
    price: '5 400',
    rating: '4,6',
  },
  {
    id: 3,
    title: 'Chambre en médina',
    district: 'Médina',
    city: 'Marrakech',
    price: '2 400',
    flatmates: '3 colocataires',
    rating: '4,9',
  },
  {
    id: 4,
    title: 'Coliving Malabata',
    district: 'Malabata',
    city: 'Tanger',
    price: '4 100',
    badge: 'Vérifié',
    badgeTone: 'success',
  },
] as const;

const STEPS = [
  ['search', 'Cherchez', 'Filtrez par quartier, budget et style de vie.'],
  ['shield-check', 'Vérifiez', 'Annonces et profils contrôlés avant publication.'],
  ['message-circle', 'Discutez', 'Échangez avec le propriétaire et les colocataires.'],
  ['key-round', 'Emménagez', 'Bail signé en ligne, caution protégée.'],
] as const;

const cardStyle = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-hairline)',
  borderRadius: 'var(--radius-card)',
  boxShadow: 'var(--shadow-sm)',
};

function SearchBar() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        alignItems: 'flex-end',
        background: 'var(--surface-card)',
        border: '1px solid var(--border-hairline)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
        padding: 'var(--space-5)',
      }}
    >
      <label style={{ display: 'grid', gap: '0.4rem', flex: 1, color: 'var(--text-muted)' }}>
        <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>
          Ville
        </span>
        <select
          defaultValue="Rabat"
          style={{
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-card)',
            color: 'var(--text-primary)',
            padding: '0.8rem 0.9rem',
            font: 'var(--type-body-md)',
          }}
        >
          <option>Rabat</option>
          <option>Casablanca</option>
          <option>Marrakech</option>
          <option>Tanger</option>
        </select>
      </label>

      <label style={{ display: 'grid', gap: '0.4rem', flex: 1, color: 'var(--text-muted)' }}>
        <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>
          Budget max.
        </span>
        <div style={{ position: 'relative' }}>
          <input
            placeholder="4 000"
            style={{
              width: '100%',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-card)',
              color: 'var(--text-primary)',
              padding: '0.8rem 2.8rem 0.8rem 0.9rem',
              font: 'var(--type-body-md)',
            }}
          />
          <span
            style={{
              position: 'absolute',
              right: '0.8rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              font: 'var(--type-label)',
            }}
          >
            MAD
          </span>
        </div>
      </label>

      <label style={{ display: 'grid', gap: '0.4rem', flex: 1, color: 'var(--text-muted)' }}>
        <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>
          Type
        </span>
        <select
          defaultValue="Chambre"
          style={{
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-card)',
            color: 'var(--text-primary)',
            padding: '0.8rem 0.9rem',
            font: 'var(--type-body-md)',
          }}
        >
          <option>Chambre</option>
          <option>Logement entier</option>
          <option>Coliving</option>
        </select>
      </label>

      <button
        type="button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          height: '3.25rem',
          padding: '0 1.25rem',
          background: 'var(--brand)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          font: 'var(--weight-semibold) var(--type-body-md) var(--font-ui)',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-brand)',
        }}
      >
        <Search size={18} />
        Rechercher
      </button>
    </div>
  );
}

function ListingCard({
  title,
  district,
  city,
  price,
  flatmates,
  rating,
  badge,
  badgeTone,
}: {
  title: string;
  district: string;
  city: string;
  price: string;
  flatmates?: string;
  rating?: string;
  badge?: string;
  badgeTone?: 'success';
}) {
  return (
    <article
      style={{
        ...cardStyle,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateRows: '170px 1fr',
        transition: 'transform 200ms ease, box-shadow 200ms ease',
      }}
    >
      <div
        style={{
          position: 'relative',
          background: 'var(--sable-200)',
          color: 'var(--sable-500)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: 'var(--type-caption)',
          letterSpacing: 'var(--ls-caps)',
          textTransform: 'uppercase',
        }}
      >
        Photo
        <div
          style={{
            position: 'absolute',
            inset: 'auto 12px 12px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span
            style={{
              background: 'rgba(36, 31, 28, 0.56)',
              backdropFilter: 'blur(12px)',
              color: '#fff',
              borderRadius: '999px',
              padding: '0.45rem 0.7rem',
              font: 'var(--type-label)',
            }}
          >
            {price} MAD/mois
          </span>
          <span
            style={{
              background: 'rgba(255,255,255,0.82)',
              color: 'var(--text-primary)',
              borderRadius: '999px',
              padding: '0.45rem 0.7rem',
              font: 'var(--type-label)',
            }}
          >
            ★ {rating}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.9rem', padding: '1rem 1rem 1.1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem' }}>
          <div>
            <div style={{ font: 'var(--type-eyebrow)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>
              {district}
            </div>
            <h3 style={{ margin: '0.15rem 0 0', font: 'var(--type-h3)' }}>{title}</h3>
          </div>
          {badge ? (
            <span
              style={{
                background: badgeTone === 'success' ? 'var(--atlas-500)' : 'var(--sand-100)',
                color: badgeTone === 'success' ? '#fff' : 'var(--text-primary)',
                borderRadius: '999px',
                padding: '0.35rem 0.65rem',
                font: 'var(--type-label)',
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>
          <span>{city}</span>
          <span>{flatmates ?? 'Colocation'}</span>
        </div>
      </div>
    </article>
  );
}

export default function HomePage() {
  return (
    <main>
      <section
        style={{
          position: 'relative',
          padding: 'var(--space-11) var(--gutter-desktop) var(--space-10)',
          background: 'linear-gradient(180deg, var(--clay-50) 0%, var(--bg-page) 78%)',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--container-max)',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '1.05fr .95fr',
            gap: 'var(--space-9)',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
            <span style={{ display: 'inline-flex', width: 'fit-content' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'var(--brand-subtle)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '0.5rem 0.75rem',
                  color: 'var(--brand)',
                  font: 'var(--type-label)',
                }}
              >
                <ShieldCheck size={16} />
                Annonces vérifiées une par une
              </span>
            </span>
            <h1
              style={{
                margin: 0,
                font: 'var(--weight-extra) 52px/1.08 var(--font-display)',
                letterSpacing: 'var(--ls-display)',
                color: 'var(--text-primary)',
              }}
            >
              Une chambre, des colocataires, une vraie adresse.
            </h1>
            <p
              style={{
                margin: 0,
                font: 'var(--type-body-lg)',
                color: 'var(--text-muted)',
                maxWidth: 520,
              }}
            >
              Trouvez une colocation à Rabat, Casablanca, Marrakech ou Tanger — avec des profils vérifiés et des loyers annoncés charges comprises.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
              <button
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  height: '3.25rem',
                  padding: '0 1.4rem',
                  background: 'var(--brand)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  font: 'var(--weight-semibold) var(--type-body-md) var(--font-ui)',
                  boxShadow: 'var(--shadow-brand)',
                  cursor: 'pointer',
                }}
              >
                Voir les chambres
              </button>
              <button
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  height: '3.25rem',
                  padding: '0 1.35rem',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-pill)',
                  font: 'var(--weight-semibold) var(--type-body-md) var(--font-ui)',
                  cursor: 'pointer',
                }}
              >
                <Plus size={18} />
                Publier une annonce
              </button>
            </div>
          </div>

          <div
            style={{
              height: 380,
              borderRadius: 'var(--radius-2xl)',
              background: 'var(--sable-200)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--sable-500)',
              font: 'var(--type-caption)',
              letterSpacing: 'var(--ls-caps)',
              textTransform: 'uppercase',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            Photo
          </div>
        </div>

        <div style={{ maxWidth: 'var(--container-max)', margin: 'var(--space-9) auto 0' }}>
          <SearchBar />
        </div>
      </section>

      <section style={{ padding: 'var(--space-10) var(--gutter-desktop)' }}>
        <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gap: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, font: 'var(--weight-bold) 32px/1.2 var(--font-display)' }}>Chambres en vedette</h2>
            <a
              href="/listings"
              style={{ color: 'var(--brand)', textDecoration: 'none', font: 'var(--type-body-md)' }}
            >
              Voir les 1 843 annonces <ArrowRight size={16} style={{ verticalAlign: 'middle' }} />
            </a>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--space-5)' }}>
            {FEATURED.map((listing) => (
              <ListingCard key={listing.id} {...listing} />
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: 'var(--space-10) var(--gutter-desktop)', background: 'var(--bg-page-alt)' }}>
        <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gap: 'var(--space-6)' }}>
          <h2 style={{ margin: 0, font: 'var(--weight-bold) 32px/1.2 var(--font-display)' }}>Comment ça marche</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--space-5)' }}>
            {STEPS.map(([icon, title, description], index) => {
              const IconComponent =
                icon === 'search'
                  ? Search
                  : icon === 'shield-check'
                    ? ShieldCheck
                    : icon === 'message-circle'
                      ? MessageCircle
                      : KeyRound;

              return (
                <div
                  key={title}
                  style={{
                    ...cardStyle,
                    display: 'grid',
                    gap: 'var(--space-3)',
                    alignContent: 'start',
                    padding: 'var(--card-pad-lg)',
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--brand-subtle)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--brand)',
                    }}
                  >
                    <IconComponent size={20} />
                  </span>
                  <span
                    style={{
                      font: 'var(--type-eyebrow)',
                      letterSpacing: 'var(--ls-caps)',
                      textTransform: 'uppercase',
                      color: 'var(--text-subtle)',
                    }}
                  >
                    Étape {index + 1}
                  </span>
                  <h3 style={{ margin: 0, font: 'var(--type-h3)' }}>{title}</h3>
                  <p style={{ margin: 0, font: 'var(--type-body-sm, 13px)', color: 'var(--text-muted)' }}>{description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section style={{ padding: 'var(--space-10) var(--gutter-desktop)' }}>
        <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gap: 'var(--space-6)' }}>
          <h2 style={{ margin: 0, font: 'var(--weight-bold) 32px/1.2 var(--font-display)' }}>Explorer par ville</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--space-5)' }}>
            {CITIES.map(([city, count]) => (
              <div
                key={city}
                style={{
                  position: 'relative',
                  height: 200,
                  borderRadius: 'var(--radius-card)',
                  overflow: 'hidden',
                  background: 'var(--sable-200)',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--sable-500)',
                    font: 'var(--type-caption)',
                    letterSpacing: 'var(--ls-caps)',
                    textTransform: 'uppercase',
                  }}
                >
                  Photo
                </span>
                <span style={{ position: 'absolute', inset: 0, background: 'var(--scrim-image)' }} />
                <span style={{ position: 'absolute', bottom: 14, left: 16, color: '#fff' }}>
                  <span style={{ display: 'block', font: 'var(--weight-bold) 20px/1.2 var(--font-display)' }}>{city}</span>
                  <span style={{ display: 'block', font: 'var(--type-caption)', opacity: 0.88 }}>{count}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter-desktop) var(--space-11)' }}>
        <div
          style={{
            maxWidth: 'var(--container-max)',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-8)',
            background: 'var(--clay-500)',
            borderRadius: 'var(--radius-2xl)',
            padding: 'var(--space-9) var(--space-10)',
            color: '#fff',
          }}
        >
          <div style={{ flex: 1, display: 'grid', gap: 'var(--space-4)' }}>
            <h2
              style={{
                margin: 0,
                font: 'var(--weight-extra) 34px/1.15 var(--font-display)',
                color: '#fff',
                letterSpacing: 'var(--ls-display)',
              }}
            >
              Vous avez une chambre libre ?
            </h2>
            <p style={{ margin: 0, font: 'var(--type-body-lg)', color: 'var(--clay-50)', maxWidth: 520 }}>
              Publiez gratuitement, choisissez vos colocataires, encaissez le loyer en ligne.
            </p>
          </div>
          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              height: '3.25rem',
              padding: '0 1.3rem',
              background: '#fff',
              color: 'var(--text-primary)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              font: 'var(--weight-semibold) var(--type-body-md) var(--font-ui)',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
            }}
          >
            Publier une annonce
          </button>
        </div>
      </section>
    </main>
  );
}
