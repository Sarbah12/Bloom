import type { QuickActionItem } from '../modules/bloom-shortcuts/types.ts';

/**
 * The app icon's long-press menu. Discreet (the default) shows only a neutral
 * "Check in"; otherwise it offers the period action that fits today.
 */
export function quickActionItems(discreet: boolean, onPeriod: boolean): QuickActionItem[] {
  const checkIn: QuickActionItem = { type: 'check-in', title: 'Check in', subtitle: 'Log how today’s going', icon: 'square.and.pencil' };
  if (discreet) return [checkIn];
  return [
    onPeriod
      ? { type: 'period-end', title: 'Period ended', subtitle: 'Mark today as the last day', icon: 'checkmark.circle' }
      : { type: 'period-start', title: 'Period started', subtitle: 'Mark today as day 1', icon: 'drop' },
    checkIn,
    { type: 'assistant', title: 'Ask Bloom Assistant', icon: 'bubble.left' },
  ];
}
