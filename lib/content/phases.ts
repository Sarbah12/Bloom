import type { Phase } from '@/lib/cycle/engine';

/**
 * Plain-language phase descriptions and self-care ideas.
 *
 * Kept general and non-prescriptive: hormones shift through the cycle, but how
 * any one person feels varies widely. Copy here must not promise outcomes or
 * suggest anything that replaces medical advice. Pending clinical review.
 */
export interface PhaseContent {
  label: string;
  short: string;
  summary: string;
  body: string;
  ideas: string[];
}

export const PHASES: Record<Phase, PhaseContent> = {
  menstrual: {
    label: 'Menstrual phase',
    short: 'Period',
    summary: 'Your period — the start of a new cycle.',
    body: 'The lining of the uterus is shed. Oestrogen and progesterone are at their lowest, which is why some people feel tired or crampy in the first days.',
    ideas: [
      'Warmth helps many people with cramps — a heat pad or a warm bath.',
      'Gentle movement such as walking or stretching can ease discomfort.',
      'Iron-rich foods (beans, leafy greens, red meat, fortified cereals) help replace what is lost.',
    ],
  },
  follicular: {
    label: 'Follicular phase',
    short: 'Follicular',
    summary: 'Oestrogen rises as your body prepares to release an egg.',
    body: 'After your period, rising oestrogen thickens the uterine lining. Many people notice their energy and mood lift during these days, though everyone is different.',
    ideas: [
      'If you feel more energetic, it can be a good time to try something new.',
      'Notice how your sleep and energy change — patterns become clearer over a few cycles.',
    ],
  },
  ovulatory: {
    label: 'Ovulation (estimated)',
    short: 'Ovulation',
    summary: 'An egg is likely to be released around now.',
    body: 'Ovulation usually happens about 14 days before your next period. Some people notice clearer, stretchier discharge or a mild one-sided ache. This is an estimate based on your cycle history, not a measurement.',
    ideas: [
      'Changes in cervical mucus are a natural sign of ovulation you can learn to recognise.',
      'If you are trying to conceive, ovulation tests measure hormones directly and are more precise than a calendar estimate.',
    ],
  },
  luteal: {
    label: 'Luteal phase',
    short: 'Luteal',
    summary: 'Progesterone rises, then falls before your next period.',
    body: 'After ovulation, progesterone rises. In the days before a period, some people notice bloating, tender breasts, cravings or mood changes — often called PMS.',
    ideas: [
      'Regular meals and limiting salt and caffeine may ease bloating for some people.',
      'Prioritising sleep and winding down can help if you feel more sensitive.',
      'If mood changes before your period seriously affect your life, talk to a healthcare professional — effective support is available.',
    ],
  },
};

/** Self-care ideas for specific symptoms, used for personalised suggestions. */
export const SYMPTOM_IDEAS: Partial<Record<string, string>> = {
  cramps:
    'For cramps, many people find heat, gentle movement or over-the-counter pain relief helpful — follow the label or ask a pharmacist. Pain that stops you doing everyday things is worth raising with a healthcare professional.',
  bloating: 'Bloating often eases with smaller, regular meals, less salt, and staying hydrated.',
  headache:
    'Headaches around your period are common. Rest, water and regular meals can help; tell a healthcare professional about severe or new headaches.',
  fatigue:
    'Feeling drained? Regular sleep and meals help. If tiredness is persistent, especially with heavy periods, ask a healthcare professional about checking your iron.',
  insomnia: 'Poor sleep can come before a period. A cool, dark room and a steady bedtime routine may help.',
  cravings: 'Cravings are common before a period. Regular meals with protein and fibre can keep energy steadier.',
  acne: 'Hormonal breakouts often follow a cyclical pattern. Gentle skincare helps; a pharmacist or doctor can advise on treatments.',
  nausea: 'If nausea is new, persistent, or you could be pregnant, check in with a healthcare professional.',
  dizziness: 'Dizziness with heavy bleeding can be a sign of low iron — worth checking with a healthcare professional.',
};

export const CONTRACEPTION_DISCLAIMER =
  'Fertile window and ovulation dates are estimates. Bloom is not a method of contraception and should not be used to prevent pregnancy.';

export const MEDICAL_DISCLAIMER =
  'Bloom offers general information to help you understand your cycle. It does not diagnose, treat or replace advice from a healthcare professional.';
