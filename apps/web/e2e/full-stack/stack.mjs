/** Where the full-stack harness runs each piece; shared by run.mjs and the specs. */
export const PORTS = { db: 55432, emulator: 9099, api: 18080, web: 3120 };

export const PROJECT_ID = 'demo-dari';

/** The harness's throwaway database container. */
export const DB_CONTAINER = 'dari-fullstack-db';

/** Placeholder only: the harness's API and web app share it so SSR requests are keyed. */
export const SSR_SECRET = 'full-stack-only-ssr-shared-secret-placeholder';

export const URLS = {
  emulator: `http://127.0.0.1:${PORTS.emulator}`,
  api: `http://127.0.0.1:${PORTS.api}`,
  web: `http://127.0.0.1:${PORTS.web}`,
};
