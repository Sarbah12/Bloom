import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { BloomBadge } from '@/components/brand/Brand';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';

/** Re-lock after the app has been in the background this long. */
const RELOCK_AFTER_MS = 60_000;

export async function biometricsAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function confirmIdentity(reason: string): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  return result.success;
}

/**
 * Covers the app with a lock screen when App Lock is on: at launch, after a
 * minute in the background, and — so health data never shows in the app
 * switcher — whenever the app isn't in the foreground.
 */
export function AppLock({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const { colors, space } = useTheme();
  const [locked, setLocked] = useState(enabled);
  const [covered, setCovered] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      if (await confirmIdentity('Unlock Bloom')) setLocked(false);
    } finally {
      prompting.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLocked(false);
      return;
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setCovered(false);
        const away = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        backgroundedAt.current = null;
        if (away > RELOCK_AFTER_MS) setLocked(true);
      } else {
        setCovered(true);
        if (state === 'background' && backgroundedAt.current === null) backgroundedAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [enabled]);

  useEffect(() => {
    if (enabled && locked && AppState.currentState === 'active') unlock();
  }, [enabled, locked, unlock]);

  const showLock = enabled && (locked || covered);

  return (
    <View style={styles.fill}>
      {children}
      {showLock ? (
        <View style={[StyleSheet.absoluteFill, styles.lock, { backgroundColor: colors.background, gap: space.lg }]}>
          <BloomBadge size={80} />
          <Text variant="title1" align="center" heading>
            Bloom is locked
          </Text>
          <Text variant="callout" tone="muted" align="center" style={{ maxWidth: 280 }}>
            Your health records stay private until you unlock.
          </Text>
          {locked && !covered ? <Button label="Unlock" icon="unlock" onPress={unlock} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  lock: { alignItems: 'center', justifyContent: 'center', padding: 32 },
});
