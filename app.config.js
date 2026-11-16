/**
 * Extends app.json with settings that come from .env.
 *
 * Google Sign-In: the iOS SDK needs the iOS client ID reversed as a URL scheme
 * (com.googleusercontent.apps.<id>). It's derived from
 * EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID so the ID lives in one place; without it
 * the plugin is left out and the Google button stays hidden.
 */
module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const plugins = [...(config.plugins ?? [])];

  if (iosClientId) {
    const id = iosClientId.replace(/\.apps\.googleusercontent\.com$/, '');
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: `com.googleusercontent.apps.${id}` }]);
  }

  return { ...config, plugins };
};
