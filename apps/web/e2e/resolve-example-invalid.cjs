/*
 * TEST-ONLY Node preload (NODE_OPTIONS=--require ...), used by the
 * production-build e2e project and never by a real deployment.
 *
 * That project gives the Next server and the browser deliberately different
 * hostnames for the internal API, the public API and the media/CDN origins, so
 * a leak of the internal hostname into rendered output is detectable. `.invalid`
 * names never resolve (RFC 6761), so this maps every *.example.invalid host to
 * the local HTTPS mock API. Chromium gets the same mapping through
 * --host-resolver-rules in playwright.config.ts.
 */
const dns = require('node:dns');

const originalLookup = dns.lookup;

dns.lookup = function lookup(hostname, options, callback) {
  if (typeof hostname !== 'string' || !hostname.endsWith('.example.invalid')) {
    return originalLookup.call(this, hostname, options, callback);
  }
  if (typeof options === 'function') {
    callback = options;
    options = {};
  } else if (typeof options === 'number') {
    options = { family: options };
  }
  if (options && options.all) {
    process.nextTick(callback, null, [{ address: '127.0.0.1', family: 4 }]);
  } else {
    process.nextTick(callback, null, '127.0.0.1', 4);
  }
  return {};
};
