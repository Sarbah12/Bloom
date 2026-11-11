const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/**
 * Raises every CocoaPods target to at least iOS 15.1.
 *
 * Xcode 27 only builds for iOS 15.0 and newer, but a few pods still declare
 * older targets on their resource-bundle targets (RNSVG's filters at 12.4,
 * AsyncStorage's resources at 13.4), which fails the whole build:
 *
 *   The iOS Simulator deployment target 'IPHONEOS_DEPLOYMENT_TARGET' is set
 *   to 12.4, but the range of supported deployment target versions is 15.0 …
 *
 * 15.1 matches Expo SDK 54's own minimum, so nothing loses support. Safe to
 * delete once those pods ship updated podspecs.
 */
const MIN = '15.1';
const MARKER = '# bloom: minimum pod deployment target';

module.exports = function withMinPodDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    (mod) => {
      const podfile = path.join(mod.modRequest.platformProjectRoot, 'Podfile');
      let text = fs.readFileSync(podfile, 'utf8');
      if (!text.includes(MARKER)) {
        const hook = 'post_install do |installer|';
        if (!text.includes(hook)) throw new Error('with-min-pod-deployment-target: no post_install block in Podfile');
        text = text.replace(
          hook,
          `${hook}
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build|
        if build.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < ${MIN}
          build.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN}'
        end
      end
    end`,
        );
        fs.writeFileSync(podfile, text);
      }
      return mod;
    },
  ]);
};
