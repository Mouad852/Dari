import http from 'node:http';
import { URL } from 'node:url';

const PORT = 4110;
const now = '2026-09-20T10:00:00Z';

const listing = (id, title, priceRent = 3200) => ({
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
  coverPhotoUrl: null,
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
  bio: 'Profil de test', avatarUrl: null, role: 'ADMIN', verification: 'EMAIL', createdAt: now,
});

const publicListings = [listing('listing-1', 'Chambre lumineuse à Agdal'), listing('listing-2', 'Studio calme près du tramway', 2800)];

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

  const prefix = '/api/v1';
  if (!url.pathname.startsWith(prefix)) return error(response, 404, 'NOT_FOUND', 'Route inconnue');
  const path = url.pathname.slice(prefix.length) || '/';
  const method = request.method;

  if (path === '/users/me' && method === 'GET') return sendJson(response, 200, state.deleted ? { ...me(), displayName: '' } : me());
  if (path === '/users' && method === 'POST') return sendJson(response, 201, me());
  if (path === '/users/me' && method === 'DELETE') { state.deleted = true; return sendNoContent(response); }

  if (path === '/cities' && method === 'GET') return sendJson(response, 200, ['Rabat', 'Casablanca', 'Marrakech', 'Tanger']);
  if (path === '/amenities' && method === 'GET') return sendJson(response, 200, ['WIFI', 'PARKING']);
  if (path.startsWith('/neighborhoods') && method === 'GET') return sendJson(response, 200, ['Agdal', 'Hassan']);

  if (path === '/listings/count' && method === 'GET') return sendJson(response, 200, { count: 2, capped: false });
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
  if (path === '/listings/listing-1' && method === 'GET') return sendJson(response, 200, { ...publicListings[0], ...detail() });

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

const server = http.createServer((request, response) => {
  void handle(request, response).catch((cause) => error(response, 500, 'INTERNAL_ERROR', cause instanceof Error ? cause.message : 'Erreur interne'));
});

server.listen(PORT, '127.0.0.1', () => console.log(`E2E mock API listening on ${PORT}`));
