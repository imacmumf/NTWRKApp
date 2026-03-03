// =============================================================================
// withSwift59.js — Expo Config Plugin
//
// Injects a post_install hook into the Podfile that forces SWIFT_VERSION = 5.9
// for all pod targets. This is needed because Xcode 16.4+ ships Swift 6.2,
// which defaults to Swift 6 language mode — breaking expo-modules-core.
//
// Unlike direct Podfile edits, this plugin survives `expo prebuild --clean`.
// =============================================================================

const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withSwift59(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );

      if (!fs.existsSync(podfilePath)) {
        console.warn("[withSwift59] Podfile not found — skipping");
        return config;
      }

      let podfile = fs.readFileSync(podfilePath, "utf8");

      // Don't add the fix if it's already present
      if (podfile.includes("SWIFT_VERSION") && podfile.includes("5.9")) {
        console.log("[withSwift59] SWIFT_VERSION fix already in Podfile");
        return config;
      }

      // Insert the Swift 5.9 override right before the closing `end` of post_install
      // We look for `react_native_post_install` and inject after its closing paren
      const swiftVersionFix = `
    # [withSwift59 plugin] Fix: Xcode 16.4 ships Swift 6.2 which defaults to Swift 6 language mode.
    # expo-modules-core is not yet compatible. Force Swift 5.9 for all pods.
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        bc.build_settings['SWIFT_VERSION'] = '5.9'
      end
    end`;

      // Find the post_install block's react_native_post_install call and append after it
      const reactPostInstallRegex =
        /(react_native_post_install\([^)]*\)[\s\S]*?\))/;
      const match = podfile.match(reactPostInstallRegex);

      if (match) {
        podfile = podfile.replace(
          match[0],
          match[0] + "\n" + swiftVersionFix
        );
        fs.writeFileSync(podfilePath, podfile, "utf8");
        console.log("[withSwift59] ✅ Injected SWIFT_VERSION = 5.9 into Podfile");
      } else {
        console.warn(
          "[withSwift59] Could not find react_native_post_install in Podfile — adding to end of post_install"
        );
        // Fallback: add before the last `end` in the file
        const lastEndIndex = podfile.lastIndexOf("end");
        if (lastEndIndex !== -1) {
          podfile =
            podfile.slice(0, lastEndIndex) +
            swiftVersionFix +
            "\n  " +
            podfile.slice(lastEndIndex);
          fs.writeFileSync(podfilePath, podfile, "utf8");
          console.log(
            "[withSwift59] ✅ Injected SWIFT_VERSION = 5.9 into Podfile (fallback)"
          );
        }
      }

      return config;
    },
  ]);
}

module.exports = withSwift59;
