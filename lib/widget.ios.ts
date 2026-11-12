import { ExtensionStorage } from '@bacons/apple-targets';
import { useEffect } from 'react';

import type { WidgetSnapshot } from './widget-snapshot';

const storage = new ExtensionStorage('group.com.sarbah.bloom');

/** Shares the widget's numbers with the iOS widget and asks it to redraw. */
export function useWidgetSync(snapshot: WidgetSnapshot, ready: boolean) {
  const key = JSON.stringify(snapshot);
  useEffect(() => {
    if (!ready) return;
    try {
      storage.set('cycle', JSON.parse(key) as WidgetSnapshot);
      ExtensionStorage.reloadWidget();
    } catch (e) {
      console.warn('Bloom: widget not updated', e);
    }
  }, [key, ready]);
}

/** Removes the widget's data (used when everything is deleted). */
export function clearWidget() {
  try {
    storage.remove('cycle');
    ExtensionStorage.reloadWidget();
  } catch {
    // nothing to clear
  }
}

export const supportsWidget = true;
