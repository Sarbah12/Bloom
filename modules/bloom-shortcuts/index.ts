import { requireOptionalNativeModule } from 'expo';

import type { QuickActionItem } from './types';

export type { QuickAction, QuickActionItem } from './types';

interface NativeModule {
  takePendingAction(): string | null;
  setQuickActions(items: QuickActionItem[]): void;
  addListener(event: 'onAction', listener: (e: { action: string }) => void): { remove(): void };
}

/** Missing on Android, the web and builds made before the module existed. */
const native = requireOptionalNativeModule<NativeModule>('BloomShortcuts');

export function takePendingAction(): string | null {
  try {
    return native?.takePendingAction() ?? null;
  } catch {
    return null;
  }
}

export function setQuickActions(items: QuickActionItem[]): void {
  try {
    native?.setQuickActions(items);
  } catch {
    // not supported here
  }
}

export function onQuickAction(listener: () => void): () => void {
  const sub = native?.addListener('onAction', listener);
  return () => sub?.remove();
}
