/**
 * Extends app.json with what only exists at build time:
 * - google-services.json (Firebase, for push). The build writes it from the
 *   GOOGLE_SERVICES_JSON secret; without it the app builds without push.
 * - The Expo project id (push tokens), from the EXPO_PROJECT_ID variable.
 */
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const googleServices = path.join(__dirname, 'google-services.json');
  const projectId = process.env.RITMO_EXPO_PROJECT_ID || config.extra?.eas?.projectId;
  return {
    ...config,
    android: {
      ...config.android,
      ...(fs.existsSync(googleServices) ? { googleServicesFile: './google-services.json' } : {}),
    },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { ...(config.extra?.eas ?? {}), projectId } } : {}),
    },
  };
};
