import ExpoModulesCore
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Bloom Assistant's link to Apple's on-device language model.
///
/// Everything runs on the phone: no network, no account, nothing stored.
/// Each request builds a fresh session from the instructions it is given, so
/// the JavaScript side owns the conversation and trims it to fit the model's
/// small context window.
public class BloomOnDeviceAIModule: Module {
  private var tasks: [String: Task<Void, Never>] = [:]
  private let lock = NSLock()

  public func definition() -> ModuleDefinition {
    Name("BloomOnDeviceAI")

    Events("onChunk")

    /// "available", or why not: "deviceNotEligible", "appleIntelligenceNotEnabled",
    /// "modelNotReady", "unavailable", "unsupportedOS".
    Function("availability") { () -> String in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        switch SystemLanguageModel.default.availability {
        case .available:
          return "available"
        case .unavailable(let reason):
          switch reason {
          case .deviceNotEligible: return "deviceNotEligible"
          case .appleIntelligenceNotEnabled: return "appleIntelligenceNotEnabled"
          case .modelNotReady: return "modelNotReady"
          @unknown default: return "unavailable"
          }
        }
      }
      #endif
      return "unsupportedOS"
    }

    /// Streams a reply: emits onChunk { requestId, text } with the reply so far,
    /// then resolves with the whole reply.
    AsyncFunction("generate") { (requestId: String, instructions: String, prompt: String, promise: Promise) in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        let task = Task { [weak self] in
          do {
            let session = LanguageModelSession(instructions: instructions)
            let options = GenerationOptions(temperature: 0.4, maximumResponseTokens: 700)
            var text = ""
            for try await snapshot in session.streamResponse(to: prompt, options: options) {
              try Task.checkCancellation()
              text = snapshot.content
              self?.sendEvent("onChunk", ["requestId": requestId, "text": text])
            }
            promise.resolve(text)
          } catch is CancellationError {
            promise.reject("ERR_CANCELLED", "Cancelled")
          } catch let error as LanguageModelSession.GenerationError {
            promise.reject(Self.code(for: error), error.localizedDescription)
          } catch {
            promise.reject("ERR_GENERATION", error.localizedDescription)
          }
          self?.finish(requestId)
        }
        lock.lock()
        tasks[requestId] = task
        lock.unlock()
        return
      }
      #endif
      promise.reject("ERR_UNAVAILABLE", "On-device AI needs iOS 26 or later.")
    }

    Function("cancel") { (requestId: String) in
      self.lock.lock()
      let task = self.tasks.removeValue(forKey: requestId)
      self.lock.unlock()
      task?.cancel()
    }
  }

  private func finish(_ requestId: String) {
    lock.lock()
    tasks.removeValue(forKey: requestId)
    lock.unlock()
  }

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private static func code(for error: LanguageModelSession.GenerationError) -> String {
    switch error {
    case .exceededContextWindowSize: return "ERR_TOO_LONG"
    case .guardrailViolation, .refusal: return "ERR_DECLINED"
    case .unsupportedLanguageOrLocale: return "ERR_LANGUAGE"
    case .rateLimited, .concurrentRequests: return "ERR_BUSY"
    case .assetsUnavailable: return "ERR_NOT_READY"
    default: return "ERR_GENERATION"
    }
  }
  #endif
}
