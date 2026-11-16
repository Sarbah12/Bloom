export type QuickAction = 'period-start' | 'period-end' | 'check-in' | 'assistant';

export interface QuickActionItem {
  type: QuickAction;
  title: string;
  subtitle?: string;
  /** SF Symbol name. */
  icon: string;
}
