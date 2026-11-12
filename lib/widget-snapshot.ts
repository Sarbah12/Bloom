/**
 * The few numbers the home screen widget shows. No names, symptoms or notes —
 * only cycle counts. Pure, so it can be tested.
 */
import type { ISODate } from './cycle/dates.ts';
import type { CycleAnalysis } from './cycle/engine.ts';

export type WidgetSnapshot = Record<string, string | number>;

export function widgetSnapshot(analysis: CycleAnalysis, today: ISODate, detailed: boolean): WidgetSnapshot {
  const t = analysis.today;
  const next = analysis.nextPeriod;
  if (!analysis.hasHistory || !t || !next) return { hasData: 0, asOf: today, detailed: detailed ? 1 : 0 };
  return {
    hasData: 1,
    asOf: today,
    cycleDay: t.cycleDay,
    periodDay: t.periodDay ?? 0,
    daysUntil: next.isLate ? -next.daysLate : next.daysUntil,
    average: analysis.stats.averageCycleLength,
    detailed: detailed ? 1 : 0,
  };
}
