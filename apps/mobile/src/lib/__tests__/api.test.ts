/**
 * The API client's failure paths: the deadline, the typed network errors, and
 * the one shared token refresh with one replay on a 401. Every test loads a
 * fresh copy of the module, because the refresh and the sign-out are shared
 * through module state on purpose.
 */

jest.mock('../config', () => ({ API_BASE_URL: 'https://api.example.invalid/api/v1' }));
jest.mock('../firebase', () => ({ getIdToken: jest.fn(), signOut: jest.fn(async () => undefined) }));
jest.mock('../network', () => ({ hasNetwork: jest.fn(async () => true) }));
jest.mock('../reporting', () => ({ reportError: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

type Api = typeof import('../api');
type Mocks = {
  api: Api;
  getIdToken: jest.Mock;
  signOut: jest.Mock;
  hasNetwork: jest.Mock;
  reportError: jest.Mock;
  push: jest.Mock;
  fetch: jest.Mock;
};

function response(status: number, body: unknown = '') {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return { status, ok: status >= 200 && status < 300, headers: { get: () => null }, text: async () => text };
}

const rejected = () => response(401, { code: 'INVALID_TOKEN', message: 'Session expirée' });

function load(): Mocks {
  jest.resetModules();
  const fetchMock = jest.fn();
  (globalThis as { fetch: unknown }).fetch = fetchMock;
  return {
    api: require('../api') as Api,
    getIdToken: require('../firebase').getIdToken as jest.Mock,
    signOut: require('../firebase').signOut as jest.Mock,
    hasNetwork: require('../network').hasNetwork as jest.Mock,
    reportError: require('../reporting').reportError as jest.Mock,
    push: require('expo-router').router.push as jest.Mock,
    fetch: fetchMock,
  };
}

const bearer = (call: unknown[]) => ((call[1] as { headers: Record<string, string> }).headers.Authorization);

afterEach(() => {
  jest.useRealTimers();
});

describe('deadline and network errors', () => {
  it('gives up after 15 s with the French timeout error, and reports it', async () => {
    jest.useFakeTimers();
    const { api, fetch, reportError } = load();
    fetch.mockImplementation((_url: string, init: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('Aborted')));
    }));

    const pending = api.apiFetch('/listings');
    const assertion = expect(pending).rejects.toMatchObject({ name: 'ApiTimeoutError', message: 'La requête a dépassé son délai' });
    await jest.advanceTimersByTimeAsync(15_000);
    await assertion;
    expect(reportError).toHaveBeenCalledWith(expect.any(api.ApiTimeoutError), { kind: 'timeout' });
  });

  it('does not time out a request that answers in time', async () => {
    jest.useFakeTimers();
    const { api, fetch } = load();
    fetch.mockResolvedValue(response(200, { items: [] }));
    await expect(api.apiFetch('/listings')).resolves.toEqual({ items: [] });
    await jest.advanceTimersByTimeAsync(20_000);
  });

  it('tells offline apart from a service that cannot be reached', async () => {
    const offline = load();
    offline.fetch.mockRejectedValue(new TypeError('Network request failed'));
    offline.hasNetwork.mockResolvedValue(false);
    await expect(offline.api.apiFetch('/listings')).rejects.toMatchObject({ name: 'ApiOfflineError', message: 'Aucune connexion réseau détectée' });

    const unreachable = load();
    unreachable.fetch.mockRejectedValue(new TypeError('Network request failed'));
    unreachable.hasNetwork.mockResolvedValue(true);
    await expect(unreachable.api.apiFetch('/listings')).rejects.toMatchObject({ name: 'ApiNetworkError', message: 'La connexion au service a échoué' });
  });

  it('passes the caller’s own cancellation through untouched', async () => {
    const { api, fetch } = load();
    const cancelled = new Error('Aborted');
    fetch.mockImplementation((_url: string, init: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(cancelled));
    }));
    const controller = new AbortController();
    const pending = api.apiFetch('/listings', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toBe(cancelled);
  });

  it('reads an empty success as undefined, and a non-API error page as unexpected', async () => {
    const { api, fetch } = load();
    fetch.mockResolvedValueOnce(response(200, ''));
    await expect(api.apiFetch('/conversations/c/read', { method: 'PATCH', token: 't' })).resolves.toBeUndefined();
    fetch.mockResolvedValueOnce(response(502, '<html>Bad gateway</html>'));
    await expect(api.apiFetch('/listings')).rejects.toMatchObject({ name: 'ApiUnexpectedResponseError', message: 'Réponse inattendue du service' });
  });

  it('shows each failure in its own French, and the fallback otherwise', () => {
    const { api } = load();
    expect(api.errorMessage(new api.ApiTimeoutError(15_000), 'Impossible')).toBe('La requête a dépassé son délai');
    expect(api.errorMessage(new api.ApiError(404, 'NOT_FOUND', 'Annonce introuvable'), 'Impossible')).toBe('Annonce introuvable');
    expect(api.errorMessage(new Error('boom'), 'Impossible')).toBe('Impossible');
  });
});

describe('a rejected session', () => {
  it('refreshes the token once for every request in flight, and replays each once', async () => {
    const { api, fetch, getIdToken, signOut } = load();
    let release: (token: string) => void = () => undefined;
    getIdToken.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    fetch.mockImplementation(async (_url: string, init: { headers: Record<string, string> }) =>
      init.headers.Authorization === 'Bearer stale' ? rejected() : response(200, { ok: true }));

    const requests = [api.apiFetch('/users/me', { token: 'stale' }), api.apiFetch('/favorites', { token: 'stale' }), api.apiFetch('/conversations', { token: 'stale' })];
    await new Promise((resolve) => setTimeout(resolve, 0));
    release('fresh');

    await expect(Promise.all(requests)).resolves.toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(fetch.mock.calls.map(bearer)).toEqual([
      'Bearer stale', 'Bearer stale', 'Bearer stale', 'Bearer fresh', 'Bearer fresh', 'Bearer fresh',
    ]);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('signs out once, without looping, when the replay is rejected too', async () => {
    const { api, fetch, getIdToken, signOut, push } = load();
    getIdToken.mockResolvedValue('fresh');
    fetch.mockImplementation(async () => rejected());

    const results = await Promise.allSettled([api.apiFetch('/users/me', { token: 'stale' }), api.apiFetch('/favorites', { token: 'stale' })]);

    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(getIdToken).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/sign-in');
  });

  it('keeps the session when Firebase cannot be reached for the refresh', async () => {
    const { api, fetch, getIdToken, signOut } = load();
    getIdToken.mockRejectedValue(new Error('auth/network-request-failed'));
    fetch.mockImplementation(async () => rejected());

    await expect(api.apiFetch('/users/me', { token: 'stale' })).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('does not treat a 403 as an ended session', async () => {
    const { api, fetch, getIdToken, signOut } = load();
    fetch.mockResolvedValue(response(403, { code: 'FORBIDDEN', message: 'Accès refusé' }));

    await expect(api.apiFetch('/admin/users', { token: 'valid' })).rejects.toMatchObject({ status: 403 });
    expect(getIdToken).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('does not retry an anonymous request', async () => {
    const { api, fetch, getIdToken } = load();
    fetch.mockImplementation(async () => rejected());
    await expect(api.apiFetch('/listings')).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(getIdToken).not.toHaveBeenCalled();
  });
});
