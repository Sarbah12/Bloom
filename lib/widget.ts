import type { WidgetSnapshot } from './widget-snapshot';

/** Android and the browser preview don't have Bloom's widget yet. */
export function useWidgetSync(_snapshot: WidgetSnapshot, _ready: boolean) {}
export function clearWidget() {}
export const supportsWidget = false;
