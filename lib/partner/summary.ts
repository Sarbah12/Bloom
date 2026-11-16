/**
 * Partner mode: the small summary a phone publishes for a partner, and the
 * gentle support tips a partner sees. Only what the person chose to share
 * leaves the phone, and the server filters again by their choices. Never
 * notes, journal, pain details, medications or body measurements. Pure.
 */
import type { ISODate } from '../cycle/dates.ts';
import type { CycleAnalysis, Phase } from '../cycle/engine.ts';

export interface PartnerSummary {
  asOf: ISODate;
  period: {
    isPeriodDay: boolean;
    periodDay: number | null;
    nextStart: ISODate | null;
    windowStart: ISODate | null;
    windowEnd: ISODate | null;
    isLate: boolean;
    daysLate: number;
  };
  phase: { phase: Phase | null; cycleDay: number | null };
  today: { moods: string[]; symptoms: string[] };
  fertile: { start: ISODate; end: ISODate } | null;
}

export interface SharingChoices {
  period: boolean;
  phase: boolean;
  today: boolean;
  fertile: boolean;
}

/** What a partner receives back from the server (switched-off parts are absent). */
export interface PartnerView {
  link_id: string;
  label: string;
  updated_at?: string;
  as_of?: ISODate;
  period?: PartnerSummary['period'];
  phase?: PartnerSummary['phase'];
  today?: PartnerSummary['today'];
  fertile?: PartnerSummary['fertile'];
}

/**
 * Builds the summary. Parts the person switched off are left out here too, so
 * they never leave the phone — the server's filter is a second line of defence.
 */
export function buildPartnerSummary(
  analysis: CycleAnalysis,
  todayLog: { moods: readonly string[]; symptoms: readonly string[] } | undefined,
  today: ISODate,
  share: SharingChoices,
  showFertility: boolean,
): Partial<PartnerSummary> & { asOf: ISODate } {
  const t = analysis.today;
  const next = analysis.nextPeriod;
  const out: Partial<PartnerSummary> & { asOf: ISODate } = { asOf: today };
  if (share.period) {
    out.period = {
      isPeriodDay: !!t?.isPeriodDay,
      periodDay: t?.periodDay ?? null,
      nextStart: next?.start ?? null,
      windowStart: next?.windowStart ?? null,
      windowEnd: next?.windowEnd ?? null,
      isLate: !!next?.isLate,
      daysLate: next?.daysLate ?? 0,
    };
  }
  if (share.phase) out.phase = { phase: t?.phase ?? null, cycleDay: t?.cycleDay ?? null };
  if (share.today) out.today = { moods: [...(todayLog?.moods ?? [])], symptoms: [...(todayLog?.symptoms ?? [])] };
  if (share.fertile && showFertility) {
    const p = analysis.projections.find((x) => x.fertileEnd >= today);
    out.fertile = p ? { start: p.fertileStart, end: p.fertileEnd } : null;
  }
  return out;
}

const PHASE_TIPS: Record<Phase, string[]> = {
  menstrual: [
    'Periods can be tiring. Offering to take something off their plate goes a long way.',
    'Warmth helps many people with cramps — a hot water bottle or a warm drink.',
  ],
  follicular: ['Energy often picks up after a period. A good time for plans together.'],
  ovulatory: ['Many people feel more energetic and social around now.'],
  luteal: [
    'The days before a period can bring tiredness, bloating or mood changes. A little extra patience helps.',
    'Check in rather than guess — “How are you feeling today?” is a good start.',
  ],
};

const SYMPTOM_TIPS: Partial<Record<string, string>> = {
  cramps: 'They logged cramps today. A hot water bottle, a warm drink or a quiet evening can help.',
  fatigue: 'They’re feeling tired today. Taking on a chore or two would help.',
  headache: 'They have a headache today — somewhere quiet and a glass of water can help.',
  bloating: 'Bloating can be uncomfortable; comfy plans beat big dinners today.',
  insomnia: 'They slept badly. A calm, early evening might help.',
  hot_flushes: 'Hot flushes today — a cooler room or a fan can make a real difference.',
  night_sweats: 'Night sweats can disturb sleep for both of you; light bedding and a cool room help.',
};

const MOOD_TIPS: Partial<Record<string, string>> = {
  low: 'They’re feeling low today. Listening, without trying to fix it, is often what helps most.',
  anxious: 'They’re feeling anxious. Something calm and familiar together can help.',
  irritable: 'They’re feeling irritable — not a sign of anything you did. Give a little space if they want it.',
  stressed: 'They’re stressed today. Asking “what would help?” is a good start.',
};

/** Two or three kind, practical ideas for the partner, from what's shared. */
export function supportTips(view: Pick<PartnerView, 'phase' | 'today' | 'period'>, dayOfYear: number): string[] {
  const out: string[] = [];
  for (const s of view.today?.symptoms ?? []) {
    const tip = SYMPTOM_TIPS[s];
    if (tip && !out.includes(tip)) out.push(tip);
  }
  for (const m of view.today?.moods ?? []) {
    const tip = MOOD_TIPS[m];
    if (tip && !out.includes(tip)) out.push(tip);
  }
  const phase = view.period?.isPeriodDay ? 'menstrual' : view.phase?.phase;
  if (phase) {
    const tips = PHASE_TIPS[phase];
    out.push(tips[dayOfYear % tips.length]);
  }
  return out.slice(0, 3);
}
