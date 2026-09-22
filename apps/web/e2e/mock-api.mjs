import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL } from 'node:url';
import zlib from 'node:zlib';

/*
 * Two modes, one fixture set:
 *   default   plain HTTP on 4110, for the `next dev` project
 *   HTTPS     E2E_MOCK_HTTPS=true on E2E_MOCK_PORT, for the production-build
 *             project. The production gate refuses non-HTTPS API and media
 *             URLs, so this mode generates a throwaway self-signed certificate
 *             at start-up (openssl, deleted again immediately) and trusts
 *             nothing else. Clients accept it only in test configuration.
 */
const HTTPS_MODE = process.env.E2E_MOCK_HTTPS === 'true';
const PORT = Number(process.env.E2E_MOCK_PORT ?? 4110);
// Absolute photo URLs stand in for S3/CloudFront objects: the web app must
// pass them through untouched, while root-relative /uploads paths are
// resolved against the first NEXT_PUBLIC_MEDIA_ORIGINS entry.
const CDN_ORIGIN = process.env.E2E_MOCK_CDN_ORIGIN ?? `http://127.0.0.1:${PORT}`;
const now = '2026-09-20T10:00:00Z';
const JSON_LD_BREAKOUT_DESCRIPTION = 'Une chambre calme. </script><script>window.__jsonLdBreakout = true</script>';

const RELATIVE_COVER = '/uploads/listings/e2e-owner/e2e-relative-cover.png';
const ABSOLUTE_COVER = `${CDN_ORIGIN}/cdn/listings/e2e-owner/e2e-absolute-cover.png`;
const PNG = solidPng(40, 30, [0xc8, 0x6b, 0x3c]);

/** A real, decodable PNG, so browsers report naturalWidth > 0 for each photo. */
function solidPng(width, height, [red, green, blue]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (bytes) => {
    let c = 0xffffffff;
    for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB, no interlace
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [red, green, blue]).flat())]);
  const pixels = zlib.deflateSync(Buffer.concat(Array.from({ length: height }, () => row)));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header), chunk('IDAT', pixels), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const listing = (id, title, priceRent = 3200, coverPhotoUrl = null) => ({
  id,
  title,
  city: 'Rabat',
  neighborhood: 'Agdal',
  priceRent,
  latitude: 33.9716,
  longitude: -6.8498,
  availabilityState: 'AVAILABLE',
  createdAt: now,
  updatedAt: now,
  coverPhotoUrl,
});

const photo = (id, url, sortOrder) => ({
  id, url, mimeType: 'image/jpeg', width: 1200, height: 900, sortOrder, isCover: sortOrder === 0, createdAt: now,
});

const detail = (id = 'listing-1', status = 'PENDING_REVIEW') => ({
  ...listing(id, id === 'listing-new' ? 'Nouvelle annonce E2E' : 'Chambre lumineuse à Agdal'),
  description: 'Une chambre calme proche du tramway.',
  status,
  rejectionReason: null,
  amenityCodes: ['WIFI'],
  photos: [],
  houseRules: { smokingAllowed: false, petsAllowed: true, guestsAllowed: true, quietHoursStart: null, quietHoursEnd: null, otherRules: null },
  rooms: [],
});

const state = {
  favorites: new Set(),
  draft: null,
  submitted: false,
  deleted: false,
  messages: [{ id: 'message-1', conversationId: 'conversation-1', senderId: 'other-user', body: 'Bonjour, la chambre est-elle toujours disponible ?', sentAt: now, readAt: null }],
  reportCreated: false,
  adminUserStatus: 'SUSPENDED',
};

function reset() {
  state.favorites = new Set();
  state.draft = null;
  state.submitted = false;
  state.deleted = false;
  state.messages = [{ id: 'message-1', conversationId: 'conversation-1', senderId: 'other-user', body: 'Bonjour, la chambre est-elle toujours disponible ?', sentAt: now, readAt: null }];
  state.reportCreated = false;
  state.adminUserStatus = 'SUSPENDED';
}

const me = () => ({
  id: 'e2e-user-1', email: 'e2e.user@example.invalid', emailVerified: true, phone: null,
  phoneVerified: false, firstName: 'Utilisateur', displayName: 'Utilisateur E2E', city: 'Rabat',
  bio: 'Profil de test', avatarUrl: '/uploads/avatars/e2e-user-1.png', role: 'ADMIN', verification: 'EMAIL', createdAt: now,
});

const publicListings = [
  listing('listing-1', 'Chambre lumineuse à Agdal', 3200, RELATIVE_COVER),
  listing('listing-2', 'Studio calme près du tramway', 2800, ABSOLUTE_COVER),
];
const listingOneDetail = () => ({
  ...publicListings[0],
  ...detail(),
  status: 'PUBLISHED',
  // Owner-supplied text that tries to close the JSON-LD <script> element.
  description: JSON_LD_BREAKOUT_DESCRIPTION,
  coverPhotoUrl: RELATIVE_COVER,
  photos: [photo('photo-relative', RELATIVE_COVER, 0), photo('photo-absolute', ABSOLUTE_COVER, 1)],
});

/*
 * Which API calls carried the web runtime's SSR key. Server renders must send
 * the configured value; browser calls must send nothing (and could not: the
 * CORS allow-list below does not permit the header).
 */
const ssrAudit = { keyed: [], unkeyed: [], wrongKey: [] };

/*
 * A stand-in for the error-tracking ingest endpoint (the production project's
 * NEXT_PUBLIC_SENTRY_DSN points here, never at the vendor). Keeps each
 * envelope exactly as the browser sent it, plus the request headers that
 * could leak something.
 */
const errorReports = [];

/** A listing whose API lookup fails the way a broken upstream does (same id in error-reporting.spec.ts). */
const BROKEN_LISTING_ID = '0b5e1a7c-9f3d-4c2a-8e61-5d4f3c2b1a09';

function auditSsrKey(request, call) {
  const presented = request.headers['x-dari-ssr-key'];
  if (presented === undefined) ssrAudit.unkeyed.push(call);
  else if (presented === process.env.E2E_EXPECTED_SSR_KEY) ssrAudit.keyed.push(call);
  else ssrAudit.wrongKey.push(call);
}

function sendPng(response) {
  response.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
  response.end(PNG);
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'Authorization,Content-Type',
  });
  response.end(JSON.stringify(body));
}

function sendNoContent(response) {
  response.writeHead(204, {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'Authorization,Content-Type',
  });
  response.end();
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw || request.headers['content-type']?.includes('multipart/form-data')) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function error(response, status, code, message) {
  sendJson(response, status, { code, message });
}

async function handle(request, response) {
  const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/health') return sendJson(response, 200, { status: 'UP' });
  if (request.method === 'OPTIONS') return sendNoContent(response);
  if (url.pathname === '/__reset' && request.method === 'POST') { reset(); return sendNoContent(response); }
  if (request.method === 'GET' && /^\/(uploads|cdn)\/.+\.png$/.test(url.pathname)) return sendPng(response);

  if (url.pathname === '/__ssr-audit' && request.method === 'GET') return sendJson(response, 200, ssrAudit);

  if (/^\/api\/\d+\/envelope\/?$/.test(url.pathname) && request.method === 'POST') {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    errorReports.push({
      body: Buffer.concat(chunks).toString('utf8'),
      query: url.search,
      cookie: request.headers.cookie ?? null,
      referer: request.headers.referer ?? null,
      authorization: request.headers.authorization ?? null,
    });
    return sendJson(response, 200, { id: 'e2e' });
  }
  if (url.pathname === '/__error-reports' && request.method === 'GET') return sendJson(response, 200, errorReports);
  if (url.pathname === '/__error-reports' && request.method === 'DELETE') { errorReports.length = 0; return sendNoContent(response); }

  const prefix = '/api/v1';
  if (!url.pathname.startsWith(prefix)) return error(response, 404, 'NOT_FOUND', 'Route inconnue');
  const path = url.pathname.slice(prefix.length) || '/';
  const method = request.method;
  auditSsrKey(request, `${method} ${path}${url.search}`);

  if (path === '/users/me' && method === 'GET') return sendJson(response, 200, state.deleted ? { ...me(), displayName: '' } : me());
  if (path === '/users' && method === 'POST') return sendJson(response, 201, me());
  if (path === '/users/me' && method === 'DELETE') { state.deleted = true; return sendNoContent(response); }

  if (path === '/cities' && method === 'GET') return sendJson(response, 200, ['Rabat', 'Casablanca', 'Marrakech', 'Tanger']);
  if (path === '/amenities' && method === 'GET') return sendJson(response, 200, ['WIFI', 'PARKING']);
  if (path.startsWith('/neighborhoods') && method === 'GET') return sendJson(response, 200, ['Agdal', 'Hassan']);

  if (path === '/listings/count' && method === 'GET') return sendJson(response, 200, { count: 2, capped: false });
  if (path === '/listings/featured' && method === 'GET') return sendJson(response, 200, publicListings);
  if (path === '/listings/sitemap/count' && method === 'GET') return sendJson(response, 200, { count: publicListings.length });
  if (path === '/listings/sitemap' && method === 'GET') return sendJson(response, 200, publicListings.map(({ id, updatedAt }) => ({ id, updatedAt })));
  if (path === '/listings/map' && method === 'GET') return sendJson(response, 200, publicListings.map(({ id, title, city, neighborhood, latitude, longitude }) => ({ id, title, city, neighborhood, latitude, longitude })));
  if (path === '/listings' && method === 'GET') {
    const cursor = url.searchParams.get('cursor');
    const items = cursor ? [publicListings[1]] : [publicListings[0]];
    return sendJson(response, 200, { items, nextCursor: cursor ? null : 'page-2', hasMore: !cursor });
  }
  if (path === '/listings' && method === 'POST') {
    const body = await readBody(request);
    state.draft = { ...detail('listing-new', 'DRAFT'), ...body, id: 'listing-new', status: 'DRAFT' };
    return sendJson(response, 201, state.draft);
  }
  if (path === '/listings/draft' && method === 'GET') return error(response, 404, 'NOT_FOUND', 'Brouillon introuvable');
  if (path === '/listings/listing-new' && method === 'PATCH') {
    const body = await readBody(request);
    state.draft = { ...(state.draft ?? detail('listing-new', 'DRAFT')), ...body, id: 'listing-new' };
    return sendJson(response, 200, state.draft);
  }
  if (path === '/listings/listing-new/submit' && method === 'POST') {
    state.submitted = true;
    if (state.draft) state.draft.status = 'PENDING_REVIEW';
    return sendNoContent(response);
  }
  if (path === '/listings/listing-new/photos' && method === 'GET') return sendJson(response, 200, state.draft?.photos ?? []);
  if (path === '/listings/listing-new/photos' && method === 'POST') {
    const photo = { id: 'photo-1', url: '/uploads/e2e-photo.jpg', mimeType: 'image/jpeg', width: 1200, height: 900, sortOrder: 0, isCover: true, createdAt: now };
    state.draft = { ...(state.draft ?? detail('listing-new', 'DRAFT')), photos: [photo] };
    return sendJson(response, 201, photo);
  }
  if (path === '/listings/listing-1' && method === 'GET') return sendJson(response, 200, listingOneDetail());
  if (path === `/listings/${BROKEN_LISTING_ID}` && method === 'GET') {
    response.writeHead(502, { 'content-type': 'text/html' });
    return response.end('<html><body>502 Bad Gateway</body></html>');
  }
  if (path === '/users/other-user' && method === 'GET') return sendJson(response, 200, { id: 'other-user', displayName: 'Amina', city: 'Rabat', bio: null, avatarUrl: null, verification: 'EMAIL', memberSince: now, activeListingCount: 1 });

  if (path === '/favorites/ids' && method === 'GET') return sendJson(response, 200, [...state.favorites]);
  if (path === '/favorites' && method === 'GET') return sendJson(response, 200, { items: publicListings.filter((item) => state.favorites.has(item.id)), nextCursor: null, hasMore: false });
  const favoriteMatch = path.match(/^\/favorites\/([^/]+)$/);
  if (favoriteMatch && method === 'POST') { state.favorites.add(favoriteMatch[1]); return sendNoContent(response); }
  if (favoriteMatch && method === 'DELETE') { state.favorites.delete(favoriteMatch[1]); return sendNoContent(response); }

  const conversation = { id: 'conversation-1', listingId: 'listing-1', participantAId: 'e2e-user-1', participantBId: 'other-user', otherUserId: 'other-user', otherUserDisplayName: 'Amina', createdAt: now, lastMessage: state.messages.at(-1)?.body ?? null, lastMessageAt: now, unreadCount: 1, lastMessageId: state.messages.at(-1)?.id ?? null, lastMessageReadAt: null };
  if (path === '/conversations' && method === 'GET') return sendJson(response, 200, { items: [conversation], nextCursor: null, hasMore: false });
  if (path === '/conversations/conversation-1' && method === 'GET') return sendJson(response, 200, conversation);
  if (path === '/conversations/conversation-1/messages' && method === 'GET') return sendJson(response, 200, { items: state.messages, nextCursor: null, hasMore: false });
  if (path === '/conversations/conversation-1/messages' && method === 'POST') {
    const body = await readBody(request);
    const message = { id: `message-${state.messages.length + 1}`, conversationId: 'conversation-1', senderId: 'e2e-user-1', body: body.body, sentAt: now, readAt: null };
    state.messages.push(message);
    return sendJson(response, 201, message);
  }
  if (path === '/conversations/conversation-1/read' && method === 'PATCH') return sendNoContent(response);
  if (path === '/conversations/unread-count' && method === 'GET') return sendJson(response, 200, { count: 1 });

  if (path === '/reports' && method === 'POST') { state.reportCreated = true; return sendJson(response, 201, { id: 'report-1', status: 'PENDING' }); }

  if (path === '/admin/dashboard' && method === 'GET') return sendJson(response, 200, { pendingListings: 1, pendingReports: state.reportCreated ? 1 : 0, activeUsers: 3 });
  if (path === '/admin/listings' && method === 'GET') return sendJson(response, 200, [{ ...detail('listing-new', state.submitted ? 'PENDING_REVIEW' : 'PENDING_REVIEW') }]);
  if (path === '/admin/listings/listing-new/approve' && method === 'POST') return sendNoContent(response);
  if (path === '/admin/reports' && method === 'GET') return sendJson(response, 200, [{ targetType: 'LISTING', targetId: 'listing-1', reportCount: 1, reporterCount: 1, firstReportedAt: now, reasons: ['OTHER'], details: ['Vérifier le contenu'], autoFlagged: false, priorDismissedReports: 0, targetLabel: 'Chambre lumineuse à Agdal' }]);
  if (path === '/admin/users' && method === 'GET') return sendJson(response, 200, { items: [{ id: 'reported-user', email: 'reported@example.invalid', displayName: 'Compte signalé', firstName: 'Compte', city: 'Rabat', role: 'USER', status: state.adminUserStatus, reportCount: 3, createdAt: now }], nextCursor: null, hasMore: false });
  const adminUserMatch = path.match(/^\/admin\/users\/([^/]+)\/(suspend|unsuspend|ban)$/);
  if (adminUserMatch && method === 'POST') { state.adminUserStatus = adminUserMatch[2] === 'unsuspend' ? 'ACTIVE' : adminUserMatch[2] === 'ban' ? 'BANNED' : 'SUSPENDED'; return sendJson(response, 200, { status: 'ok' }); }

  return error(response, 404, 'NOT_FOUND', 'Route inconnue');
}

function selfSignedCertificate() {
  const directory = mkdtempSync(join(tmpdir(), 'dari-e2e-tls-'));
  try {
    const key = join(directory, 'key.pem');
    const cert = join(directory, 'cert.pem');
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
      '-keyout', key, '-out', cert, '-subj', '/CN=dari-e2e-mock',
      '-addext', 'subjectAltName=DNS:*.example.invalid,DNS:localhost,IP:127.0.0.1',
    ], { stdio: 'ignore' });
    return { key: readFileSync(key), cert: readFileSync(cert) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const listener = (request, response) => {
  void handle(request, response).catch((cause) => error(response, 500, 'INTERNAL_ERROR', cause instanceof Error ? cause.message : 'Erreur interne'));
};
const server = HTTPS_MODE ? https.createServer(selfSignedCertificate(), listener) : http.createServer(listener);

server.listen(PORT, '127.0.0.1', () => console.log(`E2E mock API listening on ${HTTPS_MODE ? 'https' : 'http'}://127.0.0.1:${PORT}`));
