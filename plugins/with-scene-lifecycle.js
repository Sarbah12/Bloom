const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

/**
 * Moves the iOS app to the UIScene lifecycle.
 *
 * iOS 27 terminates any app built with the iOS 27 SDK that hasn't adopted
 * scenes, the moment its first scene is created:
 *
 *   UIKitCore  _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption
 *   EXC_BREAKPOINT (SIGTRAP), right at launch
 *
 * Expo SDK 54's AppDelegate template still creates its own UIWindow in
 * didFinishLaunching. This plugin:
 *   1. declares a single-window scene manifest in Info.plist,
 *   2. removes the window setup from AppDelegate.didFinishLaunching, and
 *   3. appends a SceneDelegate (same file, so the Xcode project needs no new
 *      file reference) that creates the window from the scene and starts
 *      React Native in it, forwarding deep links (bloom://account…) both on
 *      cold start and while running.
 *
 * Safe to delete once Bloom is on an Expo SDK whose template adopts scenes.
 */
const MARKER = '// bloom: scene lifecycle';

const WINDOW_SETUP = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

const SCENE_DELEGATE = `
${MARKER}
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else { return }

    // Scenes receive launch URLs here instead of in launchOptions; hand them
    // to React Native the old way so Linking.getInitialURL() still works.
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }
    if let activity = connectionOptions.userActivities.first {
      launchOptions[.userActivityDictionary] = [
        "UIApplicationLaunchOptionsUserActivityKey": activity,
        "UIApplicationLaunchOptionsUserActivityTypeKey": activity.activityType,
      ]
    }

    // Long-press menu on the app icon, on a cold start.
    if let item = connectionOptions.shortcutItem {
      BloomQuickAction.post(item.type)
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: launchOptions)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }

  // Long-press menu on the app icon, while Bloom is running.
  func windowScene(
    _ windowScene: UIWindowScene,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    BloomQuickAction.post(shortcutItem.type)
    completionHandler(true)
  }
}

/// Hands a quick action to JS: stored until read (cold start) and announced
/// (already running). Read by modules/bloom-shortcuts.
enum BloomQuickAction {
  static func post(_ action: String) {
    UserDefaults.standard.set(action, forKey: "bloom.quickAction")
    NotificationCenter.default.post(name: Notification.Name("BloomQuickAction"), object: action)
  }
}

// Siri and Shortcuts. Each opens Bloom, which does the logging after unlock.
@available(iOS 17.0, *)
struct LogPeriodStartedIntent: AppIntent {
  static var title: LocalizedStringResource = "Log Period Started"
  static var description = IntentDescription("Marks today as the first day of your period in Bloom.")
  static var openAppWhenRun: Bool = true
  @MainActor func perform() async throws -> some IntentResult {
    BloomQuickAction.post("period-start")
    return .result()
  }
}

@available(iOS 17.0, *)
struct LogPeriodEndedIntent: AppIntent {
  static var title: LocalizedStringResource = "Log Period Ended"
  static var description = IntentDescription("Marks today as the last day of your period in Bloom.")
  static var openAppWhenRun: Bool = true
  @MainActor func perform() async throws -> some IntentResult {
    BloomQuickAction.post("period-end")
    return .result()
  }
}

@available(iOS 17.0, *)
struct CheckInIntent: AppIntent {
  static var title: LocalizedStringResource = "Check In"
  static var description = IntentDescription("Opens today's check-in in Bloom.")
  static var openAppWhenRun: Bool = true
  @MainActor func perform() async throws -> some IntentResult {
    BloomQuickAction.post("check-in")
    return .result()
  }
}

@available(iOS 17.0, *)
struct AskAssistantIntent: AppIntent {
  static var title: LocalizedStringResource = "Ask Bloom Assistant"
  static var description = IntentDescription("Opens Bloom Assistant.")
  static var openAppWhenRun: Bool = true
  @MainActor func perform() async throws -> some IntentResult {
    BloomQuickAction.post("assistant")
    return .result()
  }
}

@available(iOS 17.0, *)
struct BloomAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: LogPeriodStartedIntent(),
      phrases: ["My period started in \\(.applicationName)", "Log my period in \\(.applicationName)", "Start my period in \\(.applicationName)"],
      shortTitle: "Period Started",
      systemImageName: "drop"
    )
    AppShortcut(
      intent: LogPeriodEndedIntent(),
      phrases: ["My period ended in \\(.applicationName)", "End my period in \\(.applicationName)"],
      shortTitle: "Period Ended",
      systemImageName: "checkmark.circle"
    )
    AppShortcut(
      intent: CheckInIntent(),
      phrases: ["Check in with \\(.applicationName)", "Log today in \\(.applicationName)"],
      shortTitle: "Check In",
      systemImageName: "square.and.pencil"
    )
    AppShortcut(
      intent: AskAssistantIntent(),
      phrases: ["Ask \\(.applicationName) Assistant", "Open \\(.applicationName) Assistant"],
      shortTitle: "Ask Assistant",
      systemImageName: "bubble.left"
    )
  }
}
`;

function withSceneManifest(config) {
  return withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return mod;
  });
}

function withSceneDelegate(config) {
  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') {
      throw new Error('with-scene-lifecycle: expected a Swift AppDelegate');
    }
    let text = mod.modResults.contents;
    if (!text.includes(MARKER)) {
      if (!text.includes(WINDOW_SETUP)) {
        throw new Error('with-scene-lifecycle: AppDelegate window setup not found; the Expo template changed');
      }
      text = text.replace(WINDOW_SETUP, '    // The window is created by SceneDelegate (UIScene lifecycle).\n');
      text = `${text.trimEnd()}\n${SCENE_DELEGATE}`;
      // App Intents (Siri and Shortcuts) live in the same file.
      text = text.replace(/^import Expo$/m, 'import Expo\nimport AppIntents');
      mod.modResults.contents = text;
    }
    return mod;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withSceneDelegate(withSceneManifest(config));
};
