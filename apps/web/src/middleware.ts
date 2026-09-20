import { NextResponse, type NextRequest } from 'next/server';

function originFrom(value: string | undefined): string | null {
  if (!value) return null;
  try { return new URL(value).origin; } catch { return null; }
}

export function middleware(_request: NextRequest) {
  const nonce = crypto.randomUUID();
  const apiOrigin = originFrom(process.env.NEXT_PUBLIC_API_BASE_URL) ?? 'http://localhost:8080';
  const mediaOrigins = (process.env.NEXT_PUBLIC_MEDIA_ORIGINS ?? apiOrigin)
    .split(',').map(originFrom).filter((value): value is string => Boolean(value));
  const firebaseOrigin = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}`
    : 'https://*.firebaseapp.com';

  const developmentE2e = process.env.NEXT_PUBLIC_E2E_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production';
  const scriptSource = developmentE2e
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

  const csp = [
    "default-src 'self'",
    scriptSource,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    "style-src-attr 'unsafe-inline'",
    ["img-src 'self' data: blob:", apiOrigin, ...mediaOrigins, 'https://*.tile.openstreetmap.org'].join(' '),
    "font-src 'self' https://fonts.gstatic.com",
    ["connect-src 'self'", apiOrigin, ...mediaOrigins, firebaseOrigin, 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://www.googleapis.com'].join(' '),
    ["frame-src 'self'", firebaseOrigin].join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  const requestHeaders = new Headers(_request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(), payment=()');
  return response;
}

export const config = {
  runtime: 'nodejs',
  matcher: [{ source: '/((?!api|_next/static|_next/image|favicon.ico).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }, { type: 'header', key: 'purpose', value: 'prefetch' }] }],
};
