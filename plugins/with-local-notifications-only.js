const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * Removes the `aps-environment` entitlement that expo-notifications adds.
 *
 * Bloom only uses *local* notifications — period and check-in reminders are
 * scheduled on the device itself. Nothing is ever sent from a server, so no
 * health information passes through a push service and the app needs no Push
 * Notifications capability.
 *
 * Leaving the entitlement in place fails the build outright:
 *
 *   Provisioning profile "…" doesn't support the Push Notifications capability
 *   Provisioning profile "…" doesn't include the aps-environment entitlement
 *
 * The alternative would be enabling Push Notifications on the App ID and
 * regenerating the provisioning profile, but that would be claiming a
 * capability the app does not use.
 *
 * If remote push is ever added, delete this plugin and enable the capability
 * on the App ID instead.
 *
 * ORDER MATTERS. This must be the FIRST entry in app.json's plugins array.
 * Expo composes mods by wrapping, so the first registered runs last — listed
 * anywhere else, expo-notifications re-adds the entitlement afterwards and the
 * build fails again.
 */
module.exports = function withLocalNotificationsOnly(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
};
