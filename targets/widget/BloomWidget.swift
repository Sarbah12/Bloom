import SwiftUI
import UIKit
import WidgetKit

/// Bloom's brand colours, defined here so the widget never depends on a
/// generated asset catalog. Values mirror theme/tokens.ts (light / dark).
extension Color {
  private static func hex(_ light: UInt32, _ dark: UInt32) -> Color {
    func ui(_ v: UInt32) -> UIColor {
      UIColor(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: 1)
    }
    return Color(UIColor { $0.userInterfaceStyle == .dark ? ui(dark) : ui(light) })
  }
  static let heroStart = hex(0x5E1A43, 0x4A1534)
  static let heroEnd = hex(0xA33F6C, 0x7A2A56)
  static let onHero = hex(0xFFFFFF, 0xFFFFFF)
  static let onHeroMuted = hex(0xFBE0EB, 0xF6D2E2)
}

/// The numbers Bloom shares with the widget. Written by the app as of `asOf`;
/// the widget moves them forward a day at a time so it stays right even if
/// the app isn't opened.
struct CycleSnapshot {
  var hasData: Bool
  var asOf: Date
  var cycleDay: Int
  var periodDay: Int      // 0 when not a period day
  var daysUntil: Int      // days until the next estimated period
  var average: Int        // average cycle length, for the ring
  var detailed: Bool      // show the word "period" (off by default)

  static let groupId = "group.com.sarbah.bloom"

  static func load() -> CycleSnapshot {
    let defaults = UserDefaults(suiteName: groupId)
    // The app stores the snapshot as JSON data (ExtensionStorage.setObject).
    let stored = defaults?.object(forKey: "cycle")
    let decoded: [String: Any]? = (stored as? Data).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
      ?? (stored as? [String: Any])
    guard let d = decoded,
          let asOfText = d["asOf"] as? String,
          let asOf = CycleSnapshot.dayFormatter.date(from: asOfText),
          (d["hasData"] as? Int ?? 0) == 1
    else {
      return CycleSnapshot(hasData: false, asOf: Date(), cycleDay: 0, periodDay: 0, daysUntil: 0, average: 28, detailed: false)
    }
    return CycleSnapshot(
      hasData: true,
      asOf: asOf,
      cycleDay: d["cycleDay"] as? Int ?? 0,
      periodDay: d["periodDay"] as? Int ?? 0,
      daysUntil: d["daysUntil"] as? Int ?? 0,
      average: max(1, d["average"] as? Int ?? 28),
      detailed: (d["detailed"] as? Int ?? 0) == 1
    )
  }

  static let dayFormatter: DateFormatter = {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = .current
    f.dateFormat = "yyyy-MM-dd"
    return f
  }()

  /// The snapshot moved forward to `date`. A period day counts on only while
  /// it's still today's snapshot — after that Bloom doesn't guess.
  func on(_ date: Date) -> CycleSnapshot {
    let cal = Calendar.current
    let delta = max(0, cal.dateComponents([.day], from: cal.startOfDay(for: asOf), to: cal.startOfDay(for: date)).day ?? 0)
    var s = self
    s.cycleDay = cycleDay + delta
    s.daysUntil = daysUntil - delta
    s.periodDay = delta == 0 ? periodDay : 0
    return s
  }

  var title: String { detailed ? "Cycle day \(cycleDay)" : "Day \(cycleDay)" }

  var line: String {
    if periodDay > 0 { return detailed ? "Period day \(periodDay)" : "Day \(periodDay) ●" }
    if daysUntil > 1 { return detailed ? "Period in about \(daysUntil) days" : "\(daysUntil) days to go" }
    if daysUntil == 1 { return detailed ? "Period due tomorrow" : "1 day to go" }
    if daysUntil == 0 { return detailed ? "Period due today" : "Due today" }
    return detailed ? "Period \(-daysUntil) days late" : "+\(-daysUntil) days"
  }

  var progress: Double { min(1, Double(cycleDay) / Double(average)) }
}

struct Entry: TimelineEntry {
  let date: Date
  let snapshot: CycleSnapshot
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry {
    Entry(date: Date(), snapshot: CycleSnapshot(hasData: true, asOf: Date(), cycleDay: 14, periodDay: 0, daysUntil: 14, average: 28, detailed: false))
  }

  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : Entry(date: Date(), snapshot: CycleSnapshot.load().on(Date())))
  }

  /// One entry per day for the next week, each at local midnight.
  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    let base = CycleSnapshot.load()
    let cal = Calendar.current
    let start = cal.startOfDay(for: Date())
    var entries = [Entry(date: Date(), snapshot: base.on(Date()))]
    for i in 1...7 {
      if let day = cal.date(byAdding: .day, value: i, to: start) {
        entries.append(Entry(date: day, snapshot: base.on(day)))
      }
    }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

struct Ring: View {
  let progress: Double
  var body: some View {
    ZStack {
      Circle().stroke(Color.onHero.opacity(0.25), lineWidth: 6)
      Circle()
        .trim(from: 0, to: progress)
        .stroke(Color.onHero, style: StrokeStyle(lineWidth: 6, lineCap: .round))
        .rotationEffect(.degrees(-90))
    }
  }
}

struct BloomWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: Entry

  var body: some View {
    let s = entry.snapshot
    Group {
      switch family {
      case .accessoryCircular:
        ZStack {
          AccessoryWidgetBackground()
          VStack(spacing: 0) {
            Text("\(s.hasData ? s.cycleDay : 0)").font(.system(.title2, design: .rounded).weight(.bold))
            Text("day").font(.caption2)
          }
        }
      case .accessoryRectangular:
        VStack(alignment: .leading) {
          Text(s.hasData ? s.title : "Bloom").font(.headline)
          Text(s.hasData ? s.line : "Open Bloom to start").font(.caption)
        }
      case .systemMedium:
        HStack(spacing: 16) {
          VStack(alignment: .leading, spacing: 4) {
            Text("Bloom").font(.caption.weight(.semibold)).foregroundStyle(Color.onHeroMuted)
            Spacer(minLength: 0)
            Text(s.hasData ? s.title : "Bloom").font(.system(size: 30, weight: .heavy, design: .rounded)).foregroundStyle(Color.onHero)
              .minimumScaleFactor(0.7).lineLimit(1)
            Text(s.hasData ? s.line : "Open Bloom to start").font(.subheadline).foregroundStyle(Color.onHeroMuted)
          }
          Spacer(minLength: 0)
          if s.hasData {
            ZStack {
              Ring(progress: s.progress)
              Text("\(s.cycleDay)").font(.system(size: 24, weight: .bold, design: .rounded)).foregroundStyle(Color.onHero)
            }
            .frame(width: 84, height: 84)
          }
        }
      default:
        VStack(alignment: .leading, spacing: 2) {
          Text("Bloom").font(.caption.weight(.semibold)).foregroundStyle(Color.onHeroMuted)
          Spacer(minLength: 0)
          Text(s.hasData ? s.title : "Bloom").font(.system(size: 28, weight: .heavy, design: .rounded)).foregroundStyle(Color.onHero)
            .minimumScaleFactor(0.6).lineLimit(1)
          Text(s.hasData ? s.line : "Open Bloom to start").font(.footnote).foregroundStyle(Color.onHeroMuted)
            .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .containerBackground(for: .widget) {
      if family == .systemSmall || family == .systemMedium {
        LinearGradient(colors: [Color.heroStart, Color.heroEnd], startPoint: .topLeading, endPoint: .bottomTrailing)
      } else {
        Color.clear
      }
    }
    .widgetURL(URL(string: "bloom://"))
  }
}

struct BloomWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "BloomWidget", provider: Provider()) { entry in
      BloomWidgetView(entry: entry)
    }
    .configurationDisplayName("Bloom")
    .description("Your cycle day at a glance. Discreet unless you choose otherwise in Bloom.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
  }
}

@main
struct BloomWidgets: WidgetBundle {
  var body: some Widget {
    BloomWidget()
  }
}
