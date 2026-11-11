import { useWindowDimensions } from 'react-native';

/** True at the larger accessibility text sizes, where side-by-side layouts should stack. */
export function useLargeText(): boolean {
  return useWindowDimensions().fontScale >= 1.3;
}
