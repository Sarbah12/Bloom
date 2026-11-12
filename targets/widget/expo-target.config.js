/** Bloom's home and lock screen widget. Reads a few numbers the app shares via the App Group. */
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'BloomWidget',
  displayName: 'Bloom',
  bundleIdentifier: '.widget',
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
