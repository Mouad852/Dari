export type WebConfig = {
  apiBaseUrl: string;
  apiOrigin: string;
  siteUrl: string;
  mediaOrigins: string[];
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
  };
  releaseVersion: string;
};

const isProduction = process.env.NODE_ENV === 'production';

function required(name: string, value: string | undefined): string {
  if (value && value.trim()) return value.trim();
  if (isProduction) throw new Error(`Configuration web manquante : ${name}`);
  return '';
}

function parseOrigin(name: string, value: string, allowPath: boolean): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Configuration web invalide : ${name}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`Configuration web invalide : ${name}`);
  }
  if (!allowPath && parsed.pathname !== '/') {
    throw new Error(`Configuration web invalide : ${name}`);
  }
  if (isProduction && parsed.protocol !== 'https:') {
    throw new Error(`Configuration web ${name} doit utiliser HTTPS en production`);
  }
  return parsed.toString().replace(/\/$/, '');
}

function parseApiUrl(name: string, value: string): { baseUrl: string; origin: string } {
  const parsed = parseOrigin(name, value, true);
  const url = new URL(parsed);
  if (!url.pathname.endsWith('/api/v1')) {
    throw new Error(`Configuration web invalide : ${name} doit finir par /api/v1`);
  }
  return { baseUrl: parsed.replace(/\/$/, ''), origin: `${url.origin}` };
}

function configuredMediaOrigins(apiOrigin: string): string[] {
  const raw = process.env.NEXT_PUBLIC_MEDIA_ORIGINS;
  if (!raw?.trim()) {
    if (isProduction) {
      throw new Error('Configuration web manquante : NEXT_PUBLIC_MEDIA_ORIGINS');
    }
    return [apiOrigin];
  }
  return raw.split(',').map((value) => parseOrigin('NEXT_PUBLIC_MEDIA_ORIGINS', value.trim(), false));
}

export function getWebConfig(): WebConfig {
  const api = parseApiUrl(
    typeof window === 'undefined' ? 'API_BASE_URL' : 'NEXT_PUBLIC_API_BASE_URL',
    required(
      typeof window === 'undefined' ? 'API_BASE_URL' : 'NEXT_PUBLIC_API_BASE_URL',
      typeof window === 'undefined' ? process.env.API_BASE_URL : process.env.NEXT_PUBLIC_API_BASE_URL,
    ) || 'http://localhost:8080/api/v1',
  );
  const siteUrl = parseOrigin(
    'NEXT_PUBLIC_SITE_URL',
    required('NEXT_PUBLIC_SITE_URL', process.env.NEXT_PUBLIC_SITE_URL) || 'http://localhost:3000',
    false,
  );

  const firebaseApiKey = required('NEXT_PUBLIC_FIREBASE_API_KEY', process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const firebaseAuthDomain = required('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
  const firebaseProjectId = required('NEXT_PUBLIC_FIREBASE_PROJECT_ID', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  if (isProduction && (!firebaseApiKey || !firebaseAuthDomain || !firebaseProjectId)) {
    throw new Error('Configuration web Firebase incomplète');
  }
  if (firebaseAuthDomain && /[\s/:]/.test(firebaseAuthDomain)) {
    throw new Error('Configuration web invalide : NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  }

  return {
    apiBaseUrl: api.baseUrl,
    apiOrigin: api.origin,
    siteUrl,
    mediaOrigins: configuredMediaOrigins(api.origin),
    firebase: { apiKey: firebaseApiKey, authDomain: firebaseAuthDomain, projectId: firebaseProjectId },
    releaseVersion: process.env.NEXT_PUBLIC_RELEASE_VERSION?.trim() || 'development',
  };
}

export function validateProductionBuildConfig(): void {
  if (!isProduction) return;
  getWebConfig();
  const legalKeys = [
    'DARI_LEGAL_ENTITY_NAME', 'DARI_LEGAL_ADDRESS', 'DARI_LEGAL_REGISTRATION',
    'DARI_LEGAL_CONTACT', 'DARI_LEGAL_JURISDICTION', 'DARI_LEGAL_COMPLAINT_AUTHORITY',
    'DARI_LEGAL_RETENTION', 'DARI_LEGAL_PROCESSORS', 'DARI_LEGAL_LAWFUL_BASES',
    'DARI_LEGAL_EFFECTIVE_DATE', 'DARI_LEGAL_VERSION',
  ];
  const missing = legalKeys.filter((key) => !process.env[key]?.trim());
  if (missing.length) throw new Error(`Configuration juridique manquante : ${missing.join(', ')}`);
}
