import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { onQuickAction, setQuickActions, takePendingAction } from '@/modules/bloom-shortcuts';

import { quickActionItems } from './quick-items';

const ACTIONS = new Set(['period-start', 'period-end', 'check-in', 'assistant']);

/** Keeps the long-press menu current and opens quick actions from Siri, Shortcuts or that menu. */
export function useQuickActions(discreet: boolean, onPeriod: boolean, ready: boolean) {
  useEffect(() => {
    if (ready) setQuickActions(quickActionItems(discreet, onPeriod));
  }, [discreet, onPeriod, ready]);

  useEffect(() => {
    if (!ready) return;
    const open = () => {
      const action = takePendingAction();
      if (action && ACTIONS.has(action)) router.push(`/quick/${action}`);
    };
    open();
    const unsubscribe = onQuickAction(open);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && open());
    return () => {
      unsubscribe();
      sub.remove();
    };
  }, [ready]);
}
