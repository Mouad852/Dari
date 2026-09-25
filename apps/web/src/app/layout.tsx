import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import '@/styles/app.css';

import { SiteFooter } from '@/components/SiteFooter';
import { SiteNav } from '@/components/SiteNav';
import { SkipLink } from '@/components/SkipLink';

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

metadata.icons = {
  icon: [{ url: '/favicon-32.png', sizes: '32x32', type: 'image/png' }],
  apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
};
metadata.manifest = '/manifest.webmanifest';
metadata.openGraph = { type: 'website', locale: 'fr_MA', siteName: 'Dari', images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Dari — colocation au Maroc' }] };
metadata.twitter = { card: 'summary_large_image', images: ['/og-image.png'] };

export const viewport: Viewport = {
  themeColor: '#FBF7F2', // --sable-50, the page ground
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <SkipLink />
        <SiteNav />
        {/* The skip link's target, rendered on the server so the client has nothing to add to the page's HTML. */}
        <div id="main-content">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
