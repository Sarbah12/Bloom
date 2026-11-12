/**
 * Missed pills. Current NHS guidance doesn't give one set of steps: what to
 * do depends on the type of pill, how many were missed and where you are in
 * the pack, so it sends people to their pill's leaflet or a pharmacist. Bloom
 * follows that — it never tells someone what to do about contraception. It
 * lays out the facts a pharmacist will ask for, and links to the sources.
 *
 * REVIEW STATUS: pending clinical review (see docs/LAUNCH.md).
 */
import type { PillFamily } from '@/lib/data/pill';

export const PILL_SOURCES = {
  combined: {
    label: 'NHS — Missed or extra combined pill',
    url: 'https://www.nhs.uk/contraception/methods-of-contraception/combined-pill/missed-or-extra-pill/',
  },
  pop: {
    label: 'NHS — Missed or extra progestogen-only pill',
    url: 'https://www.nhs.uk/contraception/methods-of-contraception/progestogen-only-pill/missed-or-extra-pill/',
  },
  leaflets: { label: 'Find your pill’s leaflet (eMC medicines)', url: 'https://www.medicines.org.uk/emc' },
} as const;

export const MISSED_PILL_INTRO =
  'What to do next depends on your type of pill, how many you missed and where you are in the pack. Check the leaflet that came with your pill, or ask a pharmacist — it’s free and confidential.';

export const EMERGENCY_CONTRACEPTION =
  'You may need emergency contraception. Speak to a pharmacist, sexual health clinic or GP, or call 111 — the pill can affect how some emergency contraception works.';

export const MISSED_PILL_DISCLAIMER = 'Bloom shows what you ticked. It can’t tell whether you’re protected from pregnancy.';

/** "Pill type: combined (21 pills + 7-day break)". */
export const familyLabel = (family: PillFamily) => (family === 'pop' ? 'progestogen-only (mini pill)' : 'combined');
