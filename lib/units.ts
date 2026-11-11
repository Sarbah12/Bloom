/** Weight and temperature are stored metric and shown in the person's units. */
export type Units = 'metric' | 'imperial';

const LB_PER_KG = 2.20462;

const round1 = (n: number) => Math.round(n * 10) / 10;

export const weightUnit = (u: Units) => (u === 'imperial' ? 'lb' : 'kg');
export const tempUnit = (u: Units) => (u === 'imperial' ? '°F' : '°C');

export const kgToDisplay = (kg: number, u: Units) => round1(u === 'imperial' ? kg * LB_PER_KG : kg);
export const displayToKg = (v: number, u: Units) => round1(u === 'imperial' ? v / LB_PER_KG : v);
export const cToDisplay = (c: number, u: Units) =>
  u === 'imperial' ? Math.round(((c * 9) / 5) * 100 + 3200) / 100 : Math.round(c * 100) / 100;
export const displayToC = (v: number, u: Units) => Math.round((u === 'imperial' ? ((v - 32) * 5) / 9 : v) * 100) / 100;

/** Accepts "64,5" as well as "64.5". Returns undefined for blank, NaN for junk. */
export function parseDecimal(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (!t) return undefined;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

export const formatHours = (h: number) => (Number.isInteger(h) ? `${h} h` : `${Math.floor(h)}½ h`);
