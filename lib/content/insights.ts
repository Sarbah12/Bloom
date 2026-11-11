import type { Confidence, CycleAnalysis } from '@/lib/cycle/engine';
import type { Pattern } from '@/lib/cycle/patterns';
import { moodLabel, symptomLabel } from '@/lib/data/catalog';
import type { DailyLog } from '@/lib/data/types';

import { PHASES, SYMPTOM_IDEAS } from './phases';

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Early estimate',
};

const TIMING_TEXT: Record<Pattern['timing'], string> = {
  'during-period': 'Usually during your period',
  'before-period': 'Usually in the 5 days before your period',
  'mid-cycle': 'Usually around estimated ovulation',
};

/** Which phase colour marks a pattern's timing. */
export const TIMING_PHASE: Record<Pattern['timing'], 'menstrual' | 'luteal' | 'ovulatory'> = {
  'during-period': 'menstrual',
  'before-period': 'luteal',
  'mid-cycle': 'ovulatory',
};

/** "Cramps" · "Usually during your period" · "14 of 14 logs · 7 cycles". */
export function describePattern(p: Pattern): { name: string; when: string; evidence: string } {
  const label = p.kind === 'symptom' ? symptomLabel(p.key) : moodLabel(p.key);
  return {
    name: p.kind === 'symptom' ? label : `Feeling ${label.toLowerCase()}`,
    when: TIMING_TEXT[p.timing],
    evidence: `${p.matching} of ${p.total} logs · ${p.cycles} cycles`,
  };
}

export const PATTERN_DISCLAIMER = 'Patterns describe what you’ve logged. They aren’t a diagnosis.';

/**
 * One or two gentle, relevant ideas for today: one for a symptom logged
 * recently (if any), and one for the current phase.
 */
export function suggestionsForToday(analysis: CycleAnalysis, recent: DailyLog[]): { title: string; body: string }[] {
  const out: { title: string; body: string }[] = [];
  const symptom = recent.flatMap((d) => d.symptoms).find((s) => SYMPTOM_IDEAS[s]);
  if (symptom) out.push({ title: `For ${symptomLabel(symptom).toLowerCase()}`, body: SYMPTOM_IDEAS[symptom] as string });
  const phase = analysis.today?.phase;
  if (phase) {
    const ideas = PHASES[phase].ideas;
    const day = analysis.today?.cycleDay ?? 0;
    out.push({ title: PHASES[phase].label, body: ideas[day % ideas.length] });
  }
  return out;
}

/**
 * "Your period is due in about 3 days. In the days before your period you
 * often log bloating and feeling anxious." Only from the person's own
 * before-period patterns, and only in the 5 days before an expected period.
 */
export function periodHeadsUp(patterns: Pattern[], analysis: CycleAnalysis): { title: string; body: string } | null {
  const next = analysis.nextPeriod;
  const today = analysis.today;
  if (!next || next.isLate || !today || today.isPeriodDay) return null;
  if (next.daysUntil < 1 || next.daysUntil > 5) return null;
  const before = patterns.filter((p) => p.timing === 'before-period').slice(0, 3);
  if (!before.length) return null;
  const names = before.map((p) => (p.kind === 'symptom' ? symptomLabel(p.key).toLowerCase() : `feeling ${moodLabel(p.key).toLowerCase()}`));
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return {
    title: `Your period is due in about ${next.daysUntil} ${next.daysUntil === 1 ? 'day' : 'days'}`,
    body: `In the days before your period you often log ${list}. Plan in a little extra rest, and look back at what helped last time.`,
  };
}
