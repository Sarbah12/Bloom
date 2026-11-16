import type { CycleAnalysis } from '../cycle/engine.ts';
import { addDays, type ISODate } from '../cycle/dates.ts';
import { GOALS, MEDICATION_KINDS, MOODS, PAIN_LEVELS, SYMPTOMS } from '../data/catalog.ts';
import type { AppData } from '../data/types.ts';

/**
 * The cycle summary a person can choose to share with Bloom Assistant.
 *
 * Deliberately coarse: numbers and logged categories only. Never the journal,
 * check-in notes, names (theirs or their medicines'), exact birth year or
 * dates older than the recent cycles. The person can read exactly this text
 * before it's sent.
 */
export const SUMMARY_WINDOW_DAYS = 90;

const PHASE_NAMES = { menstrual: 'period', follicular: 'follicular phase', ovulatory: 'around ovulation (estimated)', luteal: 'luteal phase' } as const;

function label<T extends { key: string; label: string }>(list: readonly T[], key: string): string {
  return list.find((x) => x.key === key)?.label ?? key;
}

function topCounts(keys: string[], limit: number): [string, number][] {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

export function buildCycleSummary(data: AppData, analysis: CycleAnalysis, today: ISODate): string {
  const lines: string[] = [`Today: ${today}`];

  if (data.profile.birthYear) {
    const age = Number(today.slice(0, 4)) - data.profile.birthYear;
    if (age > 0 && age < 120) lines.push(`Age: ${Math.floor(age / 10) * 10}s`);
  }
  if (data.profile.goals.length) {
    lines.push(`Goals in Bloom: ${data.profile.goals.map((g) => label(GOALS, g)).join('; ')}`);
  }

  if (!analysis.hasHistory) {
    lines.push('No periods logged yet.');
  } else {
    const s = analysis.stats;
    lines.push(
      `Cycles: average ${s.averageCycleLength} days over ${s.countedCycles} recorded cycle${s.countedCycles === 1 ? '' : 's'}` +
        (s.shortestCycle != null && s.longestCycle != null ? ` (shortest ${s.shortestCycle}, longest ${s.longestCycle})` : '') +
        `; periods average ${s.averagePeriodLength} days. Prediction confidence: ${analysis.confidence}.`,
    );
    const recent = analysis.cycles
      .filter((c) => c.counted)
      .slice(-4)
      .map((c) => c.length);
    if (recent.length) lines.push(`Most recent cycle lengths, oldest first: ${recent.join(', ')} days`);

    const t = analysis.today;
    if (t) {
      const where = t.isPeriodDay && t.periodDay ? `period day ${t.periodDay}` : t.phase ? PHASE_NAMES[t.phase] : 'unknown phase';
      lines.push(`Today is cycle day ${t.cycleDay} (${where}).`);
    }
    const n = analysis.nextPeriod;
    if (n) {
      lines.push(n.isLate ? `Next period: ${n.daysLate} days later than estimated.` : `Next period estimated in ${n.daysUntil} days (window ${n.windowStart} to ${n.windowEnd}).`);
    }
    if (analysis.notices.length) lines.push(`Bloom notices: ${analysis.notices.map((x) => x.title).join('; ')}`);
  }

  const since = addDays(today, -SUMMARY_WINDOW_DAYS);
  const logs = Object.values(data.days).filter((d) => d.date >= since && d.date <= today);
  if (logs.length) {
    const symptoms = topCounts(logs.flatMap((d) => d.symptoms), 8);
    const moods = topCounts(logs.flatMap((d) => d.moods), 5);
    const pains = logs.map((d) => d.pain).filter((p): p is NonNullable<typeof p> => p != null);
    lines.push(`Check-ins in the last ${SUMMARY_WINDOW_DAYS} days: ${logs.length}`);
    if (symptoms.length) lines.push(`Symptoms logged (days): ${symptoms.map(([k, n]) => `${label(SYMPTOMS, k)} ${n}`).join(', ')}`);
    if (moods.length) lines.push(`Moods logged (days): ${moods.map(([k, n]) => `${label(MOODS, k)} ${n}`).join(', ')}`);
    if (pains.length) {
      const worst = Math.max(...pains);
      lines.push(`Cramp strength: logged on ${pains.length} days, strongest "${PAIN_LEVELS.find((p) => p.value === worst)?.label ?? worst}"`);
    }
    const heavy = logs.filter((d) => d.flow === 'heavy').length;
    if (heavy) lines.push(`Heavy-flow days: ${heavy}`);
  }

  const kinds = [...new Set(data.medications.filter((m) => !m.deletedAt).map((m) => m.kind))];
  if (kinds.length) lines.push(`Medication types tracked: ${kinds.map((k) => label(MEDICATION_KINDS, k)).join(', ')}`);

  return lines.join('\n');
}
