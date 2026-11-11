import type { FeatherName } from '@/components/ui/Button';

/**
 * The fixed vocabularies people log with. Keys are stored and synced; labels
 * are only for display, so they can be translated without touching data.
 */

export type Flow = 'spotting' | 'light' | 'medium' | 'heavy';

export const FLOWS: { key: Flow; label: string; description: string }[] = [
  { key: 'spotting', label: 'Spotting', description: 'A few drops, no protection needed' },
  { key: 'light', label: 'Light', description: 'Light bleeding' },
  { key: 'medium', label: 'Medium', description: 'Regular bleeding' },
  { key: 'heavy', label: 'Heavy', description: 'Changing protection every 1–2 hours' },
];

export const SYMPTOMS = [
  { key: 'cramps', label: 'Cramps', icon: 'activity' },
  { key: 'bloating', label: 'Bloating', icon: 'circle' },
  { key: 'headache', label: 'Headache', icon: 'cloud-lightning' },
  { key: 'back_pain', label: 'Back pain', icon: 'align-center' },
  { key: 'breast_tenderness', label: 'Tender breasts', icon: 'heart' },
  { key: 'acne', label: 'Acne', icon: 'droplet' },
  { key: 'fatigue', label: 'Fatigue', icon: 'battery' },
  { key: 'nausea', label: 'Nausea', icon: 'wind' },
  { key: 'cravings', label: 'Cravings', icon: 'coffee' },
  { key: 'insomnia', label: 'Poor sleep', icon: 'moon' },
  { key: 'constipation', label: 'Constipation', icon: 'minus-circle' },
  { key: 'diarrhea', label: 'Diarrhoea', icon: 'alert-circle' },
  { key: 'dizziness', label: 'Dizziness', icon: 'loader' },
] as const satisfies readonly { key: string; label: string; icon: FeatherName }[];

export type SymptomKey = (typeof SYMPTOMS)[number]['key'];

export const MOODS = [
  { key: 'calm', label: 'Calm' },
  { key: 'happy', label: 'Happy' },
  { key: 'energetic', label: 'Energetic' },
  { key: 'confident', label: 'Confident' },
  { key: 'sensitive', label: 'Sensitive' },
  { key: 'irritable', label: 'Irritable' },
  { key: 'anxious', label: 'Anxious' },
  { key: 'low', label: 'Low' },
  { key: 'mood_swings', label: 'Mood swings' },
  { key: 'stressed', label: 'Stressed' },
  { key: 'unmotivated', label: 'Unmotivated' },
] as const;

export type MoodKey = (typeof MOODS)[number]['key'];

export type Energy = 1 | 2 | 3 | 4 | 5;

export const ENERGY_LEVELS: { value: Energy; label: string }[] = [
  { value: 1, label: 'Drained' },
  { value: 2, label: 'Low' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'High' },
];

/** How strong cramps were — asked only when cramps are logged. */
export type PainLevel = 1 | 2 | 3;

export const PAIN_LEVELS: { value: PainLevel; label: string }[] = [
  { value: 1, label: 'Mild' },
  { value: 2, label: 'Moderate' },
  { value: 3, label: 'Severe' },
];

/** What eased the cramps. Bloom learns from these which relief works for you. */
export const RELIEF = [
  { key: 'heat', label: 'Heat', icon: 'thermometer' },
  { key: 'movement', label: 'Gentle movement', icon: 'wind' },
  { key: 'stretching', label: 'Stretching', icon: 'maximize-2' },
  { key: 'breathing', label: 'Slow breathing', icon: 'cloud' },
  { key: 'pain_relief', label: 'Pain relief', icon: 'plus-circle' },
  { key: 'rest', label: 'Rest', icon: 'moon' },
  { key: 'warm_drink', label: 'Warm drink', icon: 'coffee' },
  { key: 'massage', label: 'Massage', icon: 'heart' },
] as const satisfies readonly { key: string; label: string; icon: FeatherName }[];

export type ReliefKey = (typeof RELIEF)[number]['key'];

export const GOALS = [
  { key: 'track_periods', label: 'Know when my period is coming', icon: 'calendar' },
  { key: 'understand_body', label: 'Understand my cycle and body', icon: 'compass' },
  { key: 'manage_symptoms', label: 'Spot and manage symptoms', icon: 'activity' },
  { key: 'mood', label: 'See how my cycle affects my mood', icon: 'smile' },
  { key: 'conceive', label: "I'm trying to conceive", icon: 'sun' },
  { key: 'appointments', label: 'Prepare for health appointments', icon: 'clipboard' },
] as const satisfies readonly { key: string; label: string; icon: FeatherName }[];

export type GoalKey = (typeof GOALS)[number]['key'];

export const symptomLabel = (key: string) => SYMPTOMS.find((s) => s.key === key)?.label ?? key;
export const moodLabel = (key: string) => MOODS.find((m) => m.key === key)?.label ?? key;
export const flowLabel = (key: string) => FLOWS.find((f) => f.key === key)?.label ?? key;
export const reliefLabel = (key: string) => RELIEF.find((r) => r.key === key)?.label ?? key;

/** How active the day was. */
export type ExerciseLevel = 'none' | 'light' | 'moderate' | 'intense';

export const EXERCISE_LEVELS: { value: ExerciseLevel; label: string }[] = [
  { value: 'none', label: 'Rest' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'intense', label: 'Intense' },
];

export const exerciseLabel = (key: string) => EXERCISE_LEVELS.find((e) => e.value === key)?.label ?? key;

/** Sensible bounds for body measurements, in the stored (metric) units. */
export const BODY_LIMITS = {
  sleepHours: { min: 0, max: 16, step: 0.5 },
  water: { min: 0, max: 20, step: 1 },
  weightKg: { min: 20, max: 300 },
  temperatureC: { min: 34, max: 42 },
} as const;

export const MEDICATION_KINDS = [
  { key: 'pill', label: 'Contraceptive pill', icon: 'circle' },
  { key: 'pain_relief', label: 'Pain relief', icon: 'plus-circle' },
  { key: 'iron', label: 'Iron', icon: 'droplet' },
  { key: 'supplement', label: 'Supplement', icon: 'sun' },
  { key: 'other', label: 'Other', icon: 'package' },
] as const satisfies readonly { key: string; label: string; icon: FeatherName }[];

export type MedicationKind = (typeof MEDICATION_KINDS)[number]['key'];

export const medicationKind = (key: string) => MEDICATION_KINDS.find((k) => k.key === key) ?? MEDICATION_KINDS[MEDICATION_KINDS.length - 1];
