/**
 * The doctor visit report: a one-to-two page summary of recent cycles,
 * symptoms, pain, what helped, medications and lifestyle, written from the
 * person's own logs. `buildReport` gathers the facts; `reportHtml` lays them
 * out for printing to PDF. Both pure, so the wording can be tested.
 */
import { diffDays, isWithin, addDays, type ISODate } from '../cycle/dates.ts';
import type { CycleAnalysis } from '../cycle/engine.ts';
import { lifestyleByWindow, lifestyleNotes } from '../cycle/lifestyle.ts';
import { exerciseLabel, medicationKind, moodLabel, reliefLabel, symptomLabel } from '../data/catalog.ts';
import { adherence, medHistory } from '../data/meds.ts';
import type { DailyLog, Medication } from '../data/types.ts';

export interface ReportOptions {
  /** How many recent cycles to cover. */
  cycles: 3 | 6 | 12;
  includeName: boolean;
  includeNotes: boolean;
}

export interface ReportInput {
  name?: string;
  analysis: CycleAnalysis;
  days: Record<ISODate, DailyLog>;
  medications: Medication[];
  /** Plain-language findings already worded for the person (changes, deviations, notices). */
  findings: { title: string; detail?: string }[];
  today: ISODate;
  units: 'metric' | 'imperial';
  toLocalDay: (instant: string) => ISODate;
  formatDay: (d: ISODate) => string;
}

export interface ReportCycle {
  start: string;
  length: number | null;
  periodLength: number;
  heavyDays: number;
  crampDays: number;
  worstPain: string | null;
}

export interface ReportModel {
  title: string;
  name?: string;
  generatedOn: string;
  range: string;
  stats: { label: string; value: string }[];
  cycles: ReportCycle[];
  symptoms: { label: string; days: number }[];
  moods: { label: string; days: number }[];
  relief: { label: string; days: number }[];
  medications: { name: string; detail: string; adherence: string }[];
  lifestyle: { label: string; value: string }[];
  lifestyleNotes: string[];
  findings: { title: string; detail?: string }[];
  notes: { date: string; text: string }[];
  checkIns: number;
}

const PAIN = ['', 'Mild', 'Moderate', 'Severe'];

function topCounts(lists: (readonly string[] | undefined)[], label: (k: string) => string, limit = 8) {
  const counts = new Map<string, number>();
  for (const list of lists) for (const k of new Set(list ?? [])) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([k, days]) => ({ label: label(k), days }));
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const one = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const count = (n: number, word: string, many = `${word}s`) => `${one(n)} ${n === 1 ? word : many}`;

export function buildReport(input: ReportInput, options: ReportOptions): ReportModel {
  const { analysis, today, formatDay } = input;
  const episodes = analysis.episodes.slice(-(options.cycles + 1));
  const from = episodes[0]?.start ?? addDays(today, -90);
  const entries = Object.values(input.days)
    .filter((d) => d.date >= from && d.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const cycles: ReportCycle[] = episodes.map((e, i) => {
    const next = episodes[i + 1];
    const inPeriod = entries.filter((d) => isWithin(d.date, addDays(e.start, -2), e.end));
    const pains = inPeriod.filter((d) => d.symptoms.includes('cramps')).map((d) => d.pain ?? 0);
    const worst = pains.length ? Math.max(...pains) : 0;
    return {
      start: formatDay(e.start),
      length: next ? diffDays(e.start, next.start) : null,
      periodLength: e.length,
      heavyDays: inPeriod.filter((d) => d.flow === 'heavy').length,
      crampDays: inPeriod.filter((d) => d.symptoms.includes('cramps')).length,
      worstPain: worst ? PAIN[worst] : null,
    };
  });

  const lengths = cycles.map((c) => c.length).filter((n): n is number => n !== null);
  const periodLengths = episodes.filter((e) => !e.endIsEstimated).map((e) => e.length);
  const stats: ReportModel['stats'] = [
    { label: 'Cycles covered', value: String(lengths.length) },
    { label: 'Average cycle', value: lengths.length ? `${Math.round(avg(lengths)!)} days` : '—' },
    { label: 'Shortest – longest', value: lengths.length ? `${Math.min(...lengths)} – ${Math.max(...lengths)} days` : '—' },
    { label: 'Average period', value: periodLengths.length ? count(Math.round(avg(periodLengths)! * 10) / 10, 'day') : '—' },
  ];
  if (analysis.nextPeriod) {
    stats.push({
      label: analysis.nextPeriod.isLate ? 'Period late by' : 'Next period (est.)',
      value: analysis.nextPeriod.isLate ? `${analysis.nextPeriod.daysLate} days` : formatDay(analysis.nextPeriod.start),
    });
  }

  const meds = input.medications.filter((m) => !m.deletedAt);
  const days = Math.min(30, Math.max(1, diffDays(from, today) + 1));
  const medications = meds.map((m) => {
    const a = adherence(medHistory(m, input.days, today, input.toLocalDay(m.createdAt), days));
    return {
      name: m.name,
      detail: [medicationKind(m.kind).label, m.dose].filter(Boolean).join(' · '),
      adherence: a.total >= 2 ? `Ticked on ${a.taken} of the last ${a.total} days` : 'Added recently',
    };
  });

  const sleep = avg(entries.map((d) => d.sleepHours).filter((n): n is number => n !== undefined));
  const water = avg(entries.map((d) => d.water).filter((n): n is number => n !== undefined));
  const exercise = entries.filter((d) => d.exercise);
  const weights = entries.filter((d) => d.weightKg !== undefined);
  const lifestyle: ReportModel['lifestyle'] = [];
  if (sleep !== null) lifestyle.push({ label: 'Sleep', value: `${one(Math.round(sleep * 10) / 10)} h a night on average` });
  if (water !== null)
    lifestyle.push({ label: 'Water', value: `${count(Math.round(water * 10) / 10, 'glass', 'glasses')} a day on average` });
  if (exercise.length) {
    const active = exercise.filter((d) => d.exercise !== 'none').length;
    const common = topCounts(
      exercise.map((d) => [d.exercise as string]),
      exerciseLabel,
      1,
    )[0];
    lifestyle.push({
      label: 'Activity',
      value: `Active on ${active} of ${exercise.length} logged days; most often ${common.label.toLowerCase()}`,
    });
  }
  if (weights.length) {
    const first = weights[0].weightKg!;
    const last = weights[weights.length - 1].weightKg!;
    const show = (kg: number) =>
      input.units === 'imperial' ? `${one(Math.round(kg * 2.20462 * 10) / 10)} lb` : `${one(Math.round(kg * 10) / 10)} kg`;
    lifestyle.push({ label: 'Weight', value: weights.length > 1 ? `${show(first)} → ${show(last)}` : show(last) });
  }

  return {
    title: 'Cycle summary',
    name: options.includeName && input.name?.trim() ? input.name.trim() : undefined,
    generatedOn: formatDay(today),
    range: `${formatDay(from)} – ${formatDay(today)}`,
    stats,
    cycles,
    symptoms: topCounts(
      entries.map((d) => d.symptoms),
      symptomLabel,
    ),
    moods: topCounts(
      entries.map((d) => d.moods),
      moodLabel,
      6,
    ),
    relief: topCounts(
      entries.filter((d) => d.symptoms.includes('cramps')).map((d) => d.relief),
      reliefLabel,
      5,
    ),
    medications,
    lifestyle,
    lifestyleNotes: lifestyleNotes(lifestyleByWindow(entries, analysis.episodes)),
    findings: input.findings,
    notes: options.includeNotes
      ? entries.filter((d) => d.note?.trim()).map((d) => ({ date: formatDay(d.date), text: d.note!.trim() }))
      : [],
    checkIns: entries.length,
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const REPORT_DISCLAIMER =
  'Prepared by the patient from their own logs in the Bloom app. Cycle estimates are approximate. This summary is not a diagnosis, and Bloom is not a method of contraception.';

/** Print-ready HTML (A4 and Letter), in Bloom's colours but plain enough to photocopy. */
export function reportHtml(m: ReportModel): string {
  const list = (items: { label: string; days: number }[], total: number) =>
    items.length
      ? `<table class="bars">${items
          .map(
            (i) =>
              `<tr><td>${esc(i.label)}</td><td class="bar"><span style="width:${Math.max(4, Math.round((i.days / Math.max(1, total)) * 100))}%"></span></td><td class="n">${i.days} ${i.days === 1 ? 'day' : 'days'}</td></tr>`,
          )
          .join('')}</table>`
      : '<p class="muted">None logged.</p>';
  const section = (title: string, body: string) => `<section><h2>${title}</h2>${body}</section>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(m.title)}</title><style>
  @page { margin: 16mm 14mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, 'Helvetica Neue', Roboto, Arial, sans-serif; color: #2D1A24; font-size: 11pt; line-height: 1.45; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #A23B6D; padding-bottom: 8px; margin-bottom: 14px; }
  h1 { font-size: 20pt; margin: 0; letter-spacing: -0.3px; }
  .brand { color: #A23B6D; font-weight: 700; font-size: 10pt; letter-spacing: 1px; text-transform: uppercase; }
  .meta { text-align: right; color: #694F5B; font-size: 9.5pt; }
  h2 { font-size: 11.5pt; color: #7A2550; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: 0.6px; }
  .stats { display: flex; flex-wrap: wrap; gap: 8px; }
  .stat { flex: 1 1 0; min-width: 17%; background: #F8EDF1; border-radius: 8px; padding: 8px 10px; }
  .stat b { display: block; font-size: 13pt; }
  .stat span { color: #694F5B; font-size: 9pt; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #F1E3E8; vertical-align: top; }
  th { font-size: 9pt; color: #694F5B; font-weight: 600; }
  .bars td { border: 0; padding: 3px 6px; }
  .bars .bar { width: 50%; }
  .bars .bar span { display: block; height: 8px; border-radius: 4px; background: #A23B6D; }
  .bars .n, .num { white-space: nowrap; color: #694F5B; }
  .cols { display: flex; gap: 20px; }
  .cols > section { flex: 1; }
  .finding { margin: 0 0 6px; }
  .finding b { display: block; }
  .muted { color: #694F5B; }
  footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #F1E3E8; color: #694F5B; font-size: 8.5pt; }
  section { break-inside: avoid; }
</style></head><body>
<header><div><div class="brand">Bloom</div><h1>${esc(m.title)}${m.name ? ` — ${esc(m.name)}` : ''}</h1></div>
<div class="meta">${esc(m.range)}<br>Created ${esc(m.generatedOn)} · ${m.checkIns} check-ins</div></header>
<div class="stats">${m.stats.map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('')}</div>
${section(
  'Cycles',
  m.cycles.length
    ? `<table><tr><th>Period started</th><th>Cycle length</th><th>Period length</th><th>Heavy days</th><th>Cramp days</th><th>Worst pain</th></tr>${m.cycles
        .map(
          (c) =>
            `<tr><td>${esc(c.start)}</td><td class="num">${c.length === null ? 'Current' : count(c.length, 'day')}</td><td class="num">${count(c.periodLength, 'day')}</td><td class="num">${c.heavyDays}</td><td class="num">${c.crampDays}</td><td>${c.worstPain ?? '—'}</td></tr>`,
        )
        .join('')}</table>`
    : '<p class="muted">No periods logged in this range.</p>',
)}
${m.findings.length ? section('Worth discussing', m.findings.map((f) => `<p class="finding"><b>${esc(f.title)}</b>${f.detail ? `<span class="muted">${esc(f.detail)}</span>` : ''}</p>`).join('')) : ''}
<div class="cols">${section('Most logged symptoms', list(m.symptoms, m.checkIns))}${section('Moods', list(m.moods, m.checkIns))}</div>
${m.relief.length ? section('What helped with cramps', list(m.relief, Math.max(...m.relief.map((r) => r.days)))) : ''}
${
  m.medications.length
    ? section(
        'Medications',
        `<table><tr><th>Name</th><th>Type and dose</th><th>Taken</th></tr>${m.medications
          .map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(x.detail)}</td><td class="num">${esc(x.adherence)}</td></tr>`)
          .join('')}</table>`,
      )
    : ''
}
${
  m.lifestyle.length || m.lifestyleNotes.length
    ? section(
        'Sleep and lifestyle',
        `${m.lifestyle.map((l) => `<p class="finding"><b>${esc(l.label)}</b>${esc(l.value)}</p>`).join('')}${m.lifestyleNotes.map((n) => `<p class="finding">${esc(n)}</p>`).join('')}`,
      )
    : ''
}
${m.notes.length ? section('Notes', `<table>${m.notes.map((n) => `<tr><td class="num">${esc(n.date)}</td><td>${esc(n.text)}</td></tr>`).join('')}</table>`) : ''}
<footer>${esc(REPORT_DISCLAIMER)}</footer>
</body></html>`;
}
