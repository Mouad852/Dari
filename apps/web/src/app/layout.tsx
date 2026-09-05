import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import Link from 'next/link';
import '@/styles/app.css';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-ui-loaded',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    // Sentence case, no exclamation marks — the copy rules apply to the tab too.
    default: 'Dari — colocation au Maroc',
    template: '%s | Dari',
  },
  description:
    'Trouvez une colocation à Rabat, Casablanca, Marrakech ou Tanger. '
    + 'Annonces vérifiées, loyers annoncés charges comprises.',
};

export const viewport: Viewport = {
  themeColor: '#FBF7F2', // --sable-50, the page ground
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        <footer style={{ borderTop: '1px solid var(--border-hairline)', padding: 'var(--space-5) var(--gutter-mobile)', color: 'var(--text-muted)', font: 'var(--type-caption)' }}>
          <nav aria-label="Informations légales" style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <Link href="/legal/terms">Conditions d’utilisation</Link>
            <Link href="/legal/privacy">Confidentialité</Link>
            <Link href="/legal/location-data">Données de localisation</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
