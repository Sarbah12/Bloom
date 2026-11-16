import ExpoModulesCore
import HealthKit

/// One sample Bloom wants in Apple Health. `key` encodes the day, the type
/// and the value, so a changed value is a new key: syncing removes samples
/// whose key is no longer wanted and adds the missing ones.
struct HealthSampleRecord: Record {
  @Field var type: String = ""
  @Field var key: String = ""
  /// Local calendar day, yyyy-MM-dd.
  @Field var date: String = ""
  /// Category samples: the HealthKit category value.
  @Field var value: Int = 0
  /// Quantity samples: the amount in `unit` ("kg", "degC" or "mL").
  @Field var amount: Double = 0
  @Field var unit: String = ""
  /// Menstrual flow only: the first day of a period.
  @Field var cycleStart: Bool = false
}

private let bloomKey = "BloomKey"

private let categoryIds: [HKCategoryTypeIdentifier] = [
  .menstrualFlow, .intermenstrualBleeding,
  .abdominalCramps, .bloating, .headache, .lowerBackPain, .breastPain, .acne, .fatigue, .nausea,
  .appetiteChanges, .sleepChanges, .constipation, .diarrhea, .dizziness, .hotFlashes, .nightSweats,
  .memoryLapse, .vaginalDryness, .moodChanges, .rapidPoundingOrFlutteringHeartbeat,
]
private let quantityIds: [HKQuantityTypeIdentifier] = [.bodyMass, .bodyTemperature, .dietaryWater]

private func sampleType(_ raw: String) -> HKSampleType? {
  if let id = categoryIds.first(where: { $0.rawValue == raw }) { return HKCategoryType(id) }
  if let id = quantityIds.first(where: { $0.rawValue == raw }) { return HKQuantityType(id) }
  return nil
}

private var shareTypes: [HKSampleType] {
  categoryIds.map { HKCategoryType($0) } + quantityIds.map { HKQuantityType($0) }
}

public class BloomHealthModule: Module {
  private let store = HKHealthStore()

  public func definition() -> ModuleDefinition {
    Name("BloomHealth")

    Function("isAvailable") { () -> Bool in
      HKHealthStore.isHealthDataAvailable()
    }

    /// Whether Bloom may write period days, plus how many of its types it may write.
    Function("status") { () -> [String: Any] in
      guard HKHealthStore.isHealthDataAvailable() else {
        return ["flow": "unavailable", "allowed": 0, "total": shareTypes.count]
      }
      let flow: String
      switch self.store.authorizationStatus(for: HKCategoryType(.menstrualFlow)) {
      case .sharingAuthorized: flow = "authorized"
      case .sharingDenied: flow = "denied"
      default: flow = "notDetermined"
      }
      let allowed = shareTypes.filter { self.store.authorizationStatus(for: $0) == .sharingAuthorized }.count
      return ["flow": flow, "allowed": allowed, "total": shareTypes.count]
    }

    /// Shows Apple's permission sheet (only the first time; after that the
    /// person changes access in the Health app).
    AsyncFunction("requestAuthorization") { () async throws in
      guard HKHealthStore.isHealthDataAvailable() else {
        throw Exception(name: "ERR_UNAVAILABLE", description: "Apple Health isn't available on this device.")
      }
      try await self.store.requestAuthorization(
        toShare: Set(shareTypes),
        read: [HKCategoryType(.menstrualFlow)]
      )
    }

    /// Makes Bloom's samples in Health match `samples`. Only touches samples
    /// Bloom wrote, and only types the person allowed.
    AsyncFunction("sync") { (samples: [HealthSampleRecord]) async throws -> [String: Int] in
      let allowed = shareTypes.filter { self.store.authorizationStatus(for: $0) == .sharingAuthorized }
      let allowedIds = Set(allowed.map { $0.identifier })

      var existing: [String: [HKSample]] = [:]
      for type in allowed {
        for sample in try await self.ownSamples(of: type) {
          let key = sample.metadata?[bloomKey] as? String ?? ""
          existing[key, default: []].append(sample)
        }
      }

      var wanted = Set<String>()
      var toSave: [HKSample] = []
      var skipped = 0
      for record in samples {
        guard allowedIds.contains(record.type) else {
          skipped += 1
          continue
        }
        guard !wanted.contains(record.key) else { continue }
        wanted.insert(record.key)
        if existing[record.key]?.isEmpty == false { continue }
        if let sample = Self.makeSample(record) { toSave.append(sample) }
      }

      var toDelete: [HKSample] = []
      for (key, list) in existing {
        if key.isEmpty { continue }  // not ours to manage
        if wanted.contains(key) {
          toDelete.append(contentsOf: list.dropFirst())  // duplicates
        } else {
          toDelete.append(contentsOf: list)
        }
      }

      if !toDelete.isEmpty { try await self.store.delete(toDelete) }
      if !toSave.isEmpty { try await self.store.save(toSave) }
      return ["added": toSave.count, "removed": toDelete.count, "kept": wanted.count - toSave.count, "skipped": skipped]
    }

    /// Period days other apps and devices saved to Health since `from`
    /// (yyyy-MM-dd), for importing. Bloom's own samples are left out.
    AsyncFunction("readPeriodDays") { (from: String) async throws -> [[String: Any]] in
      guard let start = Self.day(from) else { return [] }
      let type = HKCategoryType(.menstrualFlow)
      let predicate = HKQuery.predicateForSamples(withStart: start, end: nil, options: [])
      let found: [HKSample] = try await withCheckedThrowingContinuation { cont in
        let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) {
          _, results, error in
          if let error { cont.resume(throwing: error) } else { cont.resume(returning: results ?? []) }
        }
        self.store.execute(query)
      }
      let ownBundle = Bundle.main.bundleIdentifier
      return found.compactMap { sample -> [String: Any]? in
        guard let s = sample as? HKCategorySample,
              s.sourceRevision.source.bundleIdentifier != ownBundle,
              s.value != 5  // "none" (HKCategoryValueVaginalBleeding.none, iOS 18+)
        else { return nil }
        return ["date": Self.format(s.startDate), "value": s.value]
      }
    }
  }

  private func ownSamples(of type: HKSampleType) async throws -> [HKSample] {
    try await withCheckedThrowingContinuation { cont in
      let predicate = HKQuery.predicateForObjects(from: HKSource.default())
      let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) {
        _, results, error in
        if let error { cont.resume(throwing: error) } else { cont.resume(returning: results ?? []) }
      }
      store.execute(query)
    }
  }

  private static func makeSample(_ r: HealthSampleRecord) -> HKSample? {
    guard let type = sampleType(r.type), let start = day(r.date),
          let end = Calendar.current.date(byAdding: .day, value: 1, to: start)
    else { return nil }
    var metadata: [String: Any] = [bloomKey: r.key]

    if let categoryType = type as? HKCategoryType {
      if categoryType.identifier == HKCategoryTypeIdentifier.menstrualFlow.rawValue {
        metadata[HKMetadataKeyMenstrualCycleStart] = r.cycleStart
      }
      return HKCategorySample(type: categoryType, value: r.value, start: start, end: end, metadata: metadata)
    }
    if let quantityType = type as? HKQuantityType {
      let unit: HKUnit
      switch r.unit {
      case "kg": unit = .gramUnit(with: .kilo)
      case "degC": unit = .degreeCelsius()
      case "mL": unit = .literUnit(with: .milli)
      default: return nil
      }
      let quantity = HKQuantity(unit: unit, doubleValue: r.amount)
      guard quantity.is(compatibleWith: unit) else { return nil }
      // Water is a day's total; weight and temperature are one reading, at noon.
      if quantityType.identifier == HKQuantityTypeIdentifier.dietaryWater.rawValue {
        return HKQuantitySample(type: quantityType, quantity: quantity, start: start, end: end, metadata: metadata)
      }
      let noon = Calendar.current.date(byAdding: .hour, value: 12, to: start) ?? start
      return HKQuantitySample(type: quantityType, quantity: quantity, start: noon, end: noon, metadata: metadata)
    }
    return nil
  }

  private static func day(_ iso: String) -> Date? {
    let parts = iso.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else { return nil }
    return Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
  }

  private static func format(_ date: Date) -> String {
    let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
  }
}
