/**
 * One-shot scaffolder for the route skeleton. Kept in the repo as a record of
 * which routes were created and why, not as something to re-run — it refuses to
 * overwrite a page that has been built.
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '../src/app');

/** [route, component name, title, phase, ports-from, note] */
const routes = [
  ['listings/page.tsx', 'SearchResultsPage', 'Résultats de recherche', 'phase 03',
    'ui_kits/website/SearchResultsPage.jsx',
    'Filters live in the URL, not in component state: a filtered search has to be shareable, and the back button has to work.'],

  ['listings/[id]/page.tsx', 'ListingDetailPage', 'Détail de l’annonce', 'phase 07',
    'ui_kits/mobile_app/ListingScreen.jsx',
    'Server-rendered, and returns notFound() for anything not published and available — phase 08 depends on that to keep let rooms out of the index.'],

  ['flatshare/[city]/page.tsx', 'CityLandingPage', 'Colocation par ville', 'phase 08',
    null,
    'The pages most likely to earn organic traffic. Real content, not just a grid: neighborhoods, price ranges, a paragraph on the local market.'],

  ['publish/page.tsx', 'PublishWizardPage', 'Publier une annonce', 'phase 05',
    'flows/listing-creation/Listing Wizard.dc.html',
    'Eight steps, persisted server-side as a DRAFT from step one. Losing a half-written listing to a closed tab is the fastest way to lose an owner.'],

  ['messages/page.tsx', 'InboxPage', 'Messages', 'phase 04',
    'ui_kits/mobile_app/MessagesScreen.jsx', null],

  ['messages/[id]/page.tsx', 'ConversationPage', 'Conversation', 'phase 04',
    'ui_kits/mobile_app/MessagesScreen.jsx',
    'Participation is checked server-side on every read. An unguessable id is not an authorization model.'],

  ['favorites/page.tsx', 'FavoritesPage', 'Favoris', 'phase 09',
    'ui_kits/mobile_app/FeedScreen.jsx',
    'Unavailable favorites stay listed and marked, and stay tappable — a saved item that vanishes reads as a bug.'],

  ['account/page.tsx', 'AccountPage', 'Votre compte', 'phase 09',
    'ui_kits/mobile_app/ProfileScreen.jsx', null],

  ['account/listings/page.tsx', 'MyListingsPage', 'Vos annonces', 'phase 05',
    null,
    'The only surface where an owner sees their own DRAFT, REJECTED and SUSPENDED listings, with the rejection reason.'],

  ['profile/[id]/page.tsx', 'PublicProfilePage', 'Profil public', 'phase 09',
    null,
    'A trust surface: what an owner reads before replying to a stranger. No private field may reach it.'],

  ['sign-in/page.tsx', 'SignInPage', 'Connexion', 'phase 03',
    null,
    'Firebase client SDK. The API has no login endpoint and must never grow one.'],

  ['sign-up/page.tsx', 'SignUpPage', 'Créer un compte', 'phase 03',
    null,
    'Firebase signup, then POST /users. Those are two steps that can fail independently — the 404 PROFILE_NOT_FOUND contract exists for exactly that gap.'],

  ['admin/page.tsx', 'AdminDashboardPage', 'Tableau de bord', 'phase 06',
    null, null],

  ['admin/listings/page.tsx', 'AdminListingQueuePage', 'File de modération', 'phase 06',
    null,
    'Shows exact locations, which is correct here and role-gated server-side.'],

  ['admin/reports/page.tsx', 'AdminReportsPage', 'Signalements', 'phase 06',
    null,
    'Grouped by target, not one row per report: five reports about one listing are one decision.'],

  ['admin/users/page.tsx', 'AdminUsersPage', 'Utilisateurs', 'phase 06',
    null, null],
];

function page({ component, title, phase, portsFrom, note }) {
  const props = [
    `title="${title}"`,
    `phase="${phase}"`,
    portsFrom ? `portsFrom="${portsFrom}"` : null,
  ].filter(Boolean).join('\n      ');

  return `import { Placeholder } from '@/components/layout/Placeholder';
${note ? `\n// ${note.replace(/\n/g, '\n// ')}\n` : ''}
export default function ${component}() {
  return (
    <Placeholder
      ${props}
    />
  );
}
`;
}

let created = 0;
let skipped = 0;

for (const [route, component, title, phase, portsFrom, note] of routes) {
  const target = join(APP, route);
  if (existsSync(target)) {
    console.log(`skip:    ${route} (already exists)`);
    skipped += 1;
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, page({ component, title, phase, portsFrom, note }), 'utf8');
  console.log(`created: ${route}`);
  created += 1;
}

console.log(`\n${created} created, ${skipped} skipped`);
