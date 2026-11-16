import ExpoModulesCore
import UIKit

/// The app icon's long-press menu, and quick actions handed over from Siri,
/// Shortcuts or that menu. The app side (SceneDelegate and the App Intents in
/// AppDelegate.swift, added by plugins/with-scene-lifecycle.js) stores the
/// action under `bloom.quickAction` and posts `BloomQuickAction`; JS takes it.
public class BloomShortcutsModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("BloomShortcuts")
    Events("onAction")

    /// The pending quick action, cleared once read.
    Function("takePendingAction") { () -> String? in
      let defaults = UserDefaults.standard
      let action = defaults.string(forKey: "bloom.quickAction")
      defaults.removeObject(forKey: "bloom.quickAction")
      return action
    }

    /// Replaces the long-press menu. Each item: type, title, subtitle?, icon (SF Symbol).
    Function("setQuickActions") { (items: [[String: String]]) in
      DispatchQueue.main.async {
        UIApplication.shared.shortcutItems = items.map { item in
          UIApplicationShortcutItem(
            type: item["type"] ?? "",
            localizedTitle: item["title"] ?? "",
            localizedSubtitle: item["subtitle"],
            icon: UIApplicationShortcutIcon(systemImageName: item["icon"] ?? "circle"),
            userInfo: nil
          )
        }
      }
    }

    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(
        forName: Notification.Name("BloomQuickAction"), object: nil, queue: .main
      ) { [weak self] note in
        self?.sendEvent("onAction", ["action": note.object as? String ?? ""])
      }
    }

    OnStopObserving {
      if let observer = self.observer { NotificationCenter.default.removeObserver(observer) }
      self.observer = nil
    }
  }
}
