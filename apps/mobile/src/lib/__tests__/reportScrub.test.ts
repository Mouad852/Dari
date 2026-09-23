import type { ErrorEvent } from '@sentry/react-native';

import { scrub } from '../reportScrub';

// An event carrying every kind of private data the app handles, in every place
// an SDK or a native layer puts things.
const EMAIL = 'amina.test@example.invalid';
const TOKEN = 'eyJhbGciOiJSUzI1NiJ9.fake-id-token';
const BODY = 'Bonjour, la chambre est-elle toujours disponible ?';
const LATITUDE = '33.971612';
const LONGITUDE = '-6.849812';

const event: ErrorEvent = {
  type: undefined,
  event_id: 'abc123',
  timestamp: 1_790_000_000,
  platform: 'javascript',
  level: 'error',
  release: '1.0.0-test',
  environment: 'production',
  message: `Échec pour ${EMAIL}`,
  user: { id: 'user-1', email: EMAIL, ip_address: '10.0.0.8' },
  request: { url: `https://api.example.invalid/api/v1/listings?lat=${LATITUDE}`, headers: { Authorization: `Bearer ${TOKEN}` } },
  breadcrumbs: [{ category: 'fetch', message: `POST /conversations body=${BODY}`, data: { Authorization: `Bearer ${TOKEN}` } }],
  extra: { location: { latitude: LATITUDE, longitude: LONGITUDE }, draft: BODY },
  contexts: { os: { name: 'Android', version: '15' }, device: { model: 'Pixel 8', name: `Téléphone de ${EMAIL}` }, app: { app_name: 'Dari' } },
  tags: { kind: 'timeout', route: '/messages/[id]', correlation_id: 'corr-1', email: EMAIL, token: TOKEN },
  exception: {
    values: [{
      type: 'ApiError',
      value: `Message refusé: ${BODY} (${EMAIL})`,
      mechanism: { type: 'onerror', handled: false, data: { token: TOKEN } },
      stacktrace: {
        frames: [{
          filename: `app:///index.android.bundle?token=${TOKEN}`,
          function: 'sendMessage',
          lineno: 10,
          colno: 4,
          in_app: true,
          vars: { body: BODY, latitude: LATITUDE },
          context_line: `send(${BODY})`,
        }],
      },
    }],
  },
};

describe('scrub', () => {
  const scrubbed = scrub(event);
  const serialized = JSON.stringify(scrubbed);

  it.each([
    ['an email address', EMAIL],
    ['a bearer token', TOKEN],
    ['the Authorization header', 'Authorization'],
    ['a message body', BODY],
    ['an exact latitude', LATITUDE],
    ['an exact longitude', LONGITUDE],
    ['an IP address', '10.0.0.8'],
    ['the device name', 'Téléphone'],
  ])('drops %s from the whole event', (_label, secret) => {
    expect(serialized).not.toContain(secret);
  });

  it('keeps what a crash needs to be read', () => {
    expect(scrubbed.release).toBe('1.0.0-test');
    expect(scrubbed.tags).toEqual({ kind: 'timeout', route: '/messages/[id]', correlation_id: 'corr-1' });
    expect(scrubbed.contexts).toEqual({ os: { name: 'Android', version: '15' } });
    const exception = scrubbed.exception?.values?.[0];
    expect(exception?.type).toBe('ApiError');
    expect(exception?.value).toBeUndefined();
    expect(exception?.stacktrace?.frames?.[0]).toEqual({
      filename: 'app:///index.android.bundle', function: 'sendMessage', lineno: 10, colno: 4, in_app: true,
    });
  });

  it('carries no user, request, breadcrumbs, extra data or message', () => {
    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.request).toBeUndefined();
    expect(scrubbed.breadcrumbs).toBeUndefined();
    expect(scrubbed.extra).toBeUndefined();
    expect(scrubbed.message).toBeUndefined();
  });
});
