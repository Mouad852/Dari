function validateProductionConfiguration() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = [
    'NEXT_PUBLIC_API_BASE_URL',
    'API_BASE_URL',
    'NEXT_PUBLIC_SITE_URL',
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_MEDIA_ORIGINS',
    'DARI_LEGAL_ENTITY_NAME',
    'DARI_LEGAL_ADDRESS',
    'DARI_LEGAL_REGISTRATION',
    'DARI_LEGAL_CONTACT',
    'DARI_LEGAL_JURISDICTION',
    'DARI_LEGAL_COMPLAINT_AUTHORITY',
    'DARI_LEGAL_RETENTION',
    'DARI_LEGAL_PROCESSORS',
    'DARI_LEGAL_LAWFUL_BASES',
    'DARI_LEGAL_EFFECTIVE_DATE',
    'DARI_LEGAL_VERSION',
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) throw new Error(`Configuration de production manquante : ${missing.join(', ')}`);

  for (const name of ['NEXT_PUBLIC_API_BASE_URL', 'API_BASE_URL', 'NEXT_PUBLIC_SITE_URL']) {
    let parsed;
    try { parsed = new URL(process.env[name]); } catch { throw new Error(`URL de production invalide : ${name}`); }
    if (parsed.protocol !== 'https:') throw new Error(`URL de production non HTTPS : ${name}`);
    if (name !== 'NEXT_PUBLIC_SITE_URL' && !parsed.pathname.endsWith('/api/v1')) {
      throw new Error(`URL de production invalide : ${name}`);
    }
  }
  for (const origin of process.env.NEXT_PUBLIC_MEDIA_ORIGINS.split(',')) {
    let parsed;
    try { parsed = new URL(origin.trim()); } catch { throw new Error('Origine média publique invalide'); }
    if (parsed.protocol !== 'https:' || parsed.pathname !== '/') throw new Error('Origine média publique invalide');
  }
}

validateProductionConfiguration();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Pin the trace root to this app. Without it Next walks up looking for a
  // lockfile, finds a stray one in the user's home directory, and treats that
  // as the workspace root.
  outputFileTracingRoot: import.meta.dirname,

  // Photo hosts must be allowlisted for next/image. Phase 05's storage choice
  // resurfaces here; keep this list in step with it.
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000' }, // MinIO, local dev
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Listing pages carry approximate locations. Keep them out of embeds.
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
