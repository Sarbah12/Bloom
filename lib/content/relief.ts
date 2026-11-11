import type { FeatherName } from '@/components/ui/Button';

/**
 * Cramp relief guidance, written from NHS and ACOG advice on period pain.
 * General self-care only; pending clinical review like all health copy.
 */

export const RELIEF_IDEAS: { icon: FeatherName; title: string; body: string }[] = [
  {
    icon: 'thermometer',
    title: 'Warmth',
    body: 'A heat pad or hot-water bottle on your tummy or lower back, or a warm bath. Warmth helps the muscles relax.',
  },
  {
    icon: 'wind',
    title: 'Gentle movement',
    body: 'A short walk, a swim or easy yoga. Many people find moving eases cramps, even when it is the last thing they feel like doing.',
  },
  {
    icon: 'plus-circle',
    title: 'Pain relief',
    body: 'Over-the-counter pain relief such as ibuprofen or paracetamol can help, especially taken early. Follow the label, and ask a pharmacist if you have other conditions or take other medicines.',
  },
  {
    icon: 'heart',
    title: 'Massage',
    body: 'Slow, gentle circles on your lower tummy or lower back.',
  },
  {
    icon: 'moon',
    title: 'Rest in a comfortable position',
    body: 'Lying on your side with your knees drawn up can take pressure off your tummy.',
  },
  {
    icon: 'coffee',
    title: 'Warm drinks and regular meals',
    body: 'Keeping warm, drinking water and not skipping meals helps some people feel better.',
  },
];

export interface Stretch {
  key: string;
  title: string;
  seconds: number;
  steps: string[];
}

export const STRETCHES: Stretch[] = [
  {
    key: 'childs-pose',
    title: 'Child’s pose',
    seconds: 30,
    steps: [
      'Kneel and sit back towards your heels.',
      'Fold forward and rest your forehead on the floor or a cushion.',
      'Let your arms relax and breathe slowly into your lower back.',
    ],
  },
  {
    key: 'knees-to-chest',
    title: 'Knees to chest',
    seconds: 30,
    steps: ['Lie on your back.', 'Gently hug both knees towards your chest.', 'Rock slowly from side to side if that feels good.'],
  },
  {
    key: 'cat-cow',
    title: 'Cat–cow',
    seconds: 45,
    steps: [
      'On hands and knees, breathe in as you let your tummy soften down and lift your gaze.',
      'Breathe out as you round your back and tuck your chin.',
      'Keep moving slowly with your breath.',
    ],
  },
];

export const SEE_SOMEONE_IF = [
  'Pain stops you going to work, school or doing everyday things.',
  'Pain relief does not help, or the pain has recently got much worse.',
  'You have pain during or after sex, or when passing urine or opening your bowels.',
  'Your periods are very heavy, or you bleed between periods or after sex.',
];

export const GET_URGENT_HELP_IF = [
  'You have sudden, severe pain in your tummy or pelvis.',
  'You have a high temperature or feel very unwell — especially while using a tampon or menstrual cup.',
  'You could be pregnant and have pain or bleeding.',
];

export const RELIEF_SOURCES = [
  { label: 'NHS — Period pain', url: 'https://www.nhs.uk/conditions/period-pain/' },
  { label: 'ACOG — Dysmenorrhea: painful periods', url: 'https://www.acog.org/womens-health/faqs/dysmenorrhea-painful-periods' },
];
