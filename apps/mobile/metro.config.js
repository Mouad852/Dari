// Expo's default Metro configuration, plus the debug ids Sentry needs to match
// an uploaded source map to a bundle. Uploading itself is off by default
// (SENTRY_DISABLE_AUTO_UPLOAD in eas.json); see docs/MOBILE_RELEASE.md.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
