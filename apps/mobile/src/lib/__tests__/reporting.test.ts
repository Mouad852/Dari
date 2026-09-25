import * as Sentry from '@sentry/react-native';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  setUser: jest.fn(),
}));

/**
 * What the mobile SDK is told at start. Native crash, ANR and app-hang events
 * never pass through scrub(), so these options are all that limits them:
 * native capture stays on, no personal data by default, no breadcrumbs, no
 * sessions, no screenshots or view hierarchy, and no user set by Dari. What
 * the native SDKs still add on their own is listed in docs/LEGAL_PREP.md §9.
 */
function startWithDsn(): typeof import('../reporting') {
  process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://publickey@errors.example.invalid/1';
  let reporting!: typeof import('../reporting');
  jest.isolateModules(() => {
    reporting = require('../reporting');
  });
  reporting.startErrorReporting();
  return reporting;
}

afterEach(() => {
  delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  jest.clearAllMocks();
});

describe('startErrorReporting', () => {
  it('starts nothing without a DSN', () => {
    jest.isolateModules(() => {
      require('../reporting').startErrorReporting();
    });
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('keeps native crash capture and sends no default personal data', () => {
    startWithDsn();
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    const options = (Sentry.init as jest.Mock).mock.calls[0][0];
    expect(options).toMatchObject({
      sendDefaultPii: false,
      maxBreadcrumbs: 0,
      enableAutoSessionTracking: false,
    });
    // The scrubber itself is tested in reportScrub.test.ts; here, that it is the one installed.
    expect(options.beforeSend.name).toBe('scrub');
    expect(options.beforeSend({ event_id: 'e', user: { id: 'u', email: 'a@example.invalid' } }).user).toBeUndefined();
    expect(options.beforeBreadcrumb({ category: 'navigation' })).toBeNull();
    // Off would hide native crashes entirely; the SDK default (on) is kept.
    expect(options.enableNative).not.toBe(false);
    expect(options.enableNativeCrashHandling).not.toBe(false);
    for (const attachment of ['attachScreenshot', 'attachViewHierarchy', 'attachStacktrace']) {
      expect(options[attachment]).not.toBe(true);
    }
    expect(options).not.toHaveProperty('initialScope');
    expect(options).not.toHaveProperty('integrations');
  });

  it('never attaches a user, and reports only the allowed tags', () => {
    const reporting = startWithDsn();
    reporting.reportError(new Error('boom'), { kind: 'render', route: '/messages/[id]', correlationId: 'c-1' });
    expect(Sentry.setUser).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { kind: 'render', route: '/messages/[id]', correlation_id: 'c-1' },
    });
  });
});
