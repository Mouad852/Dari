import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import '@/styles/app.css';

import { SiteFooter } from '@/components/SiteFooter';

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
        <SiteFooter />
      </body>
    </html>
  );
}
