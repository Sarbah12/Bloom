import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import type { Stretch } from '@/lib/content/relief';
import { useTheme } from '@/theme/theme';

/** One gentle stretch with its steps and a hold timer. */
export function StretchCard({ stretch }: { stretch: Stretch }) {
  const { colors, space } = useTheme();
  const [left, setLeft] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);

  const start = () => {
    if (timer.current) clearInterval(timer.current);
    setLeft(stretch.seconds);
    timer.current = setInterval(() => {
      setLeft((s) => {
        if (s === null || s <= 1) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const holding = left !== null && left > 0;

  return (
    <Card>
      <View style={styles.header}>
        <Text variant="title3" style={styles.flex}>
          {stretch.title}
        </Text>
        <Text variant="caption" tone="muted">
          Hold {stretch.seconds}s
        </Text>
      </View>
      <View style={{ gap: space.sm, marginTop: space.md }}>
        {stretch.steps.map((step, i) => (
          <View key={i} style={[styles.step, { gap: space.md }]}>
            <View style={[styles.num, { backgroundColor: colors.primarySoft }]}>
              <Text variant="caption" color={colors.onPrimarySoft}>
                {i + 1}
              </Text>
            </View>
            <Text variant="callout" style={styles.flex}>
              {step}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ marginTop: space.lg }}>
        <Button
          label={holding ? `Holding… ${left}s` : left === 0 ? 'Done — again?' : `Start ${stretch.seconds}-second hold`}
          icon={holding ? 'clock' : 'play'}
          variant="soft"
          fullWidth
          onPress={start}
          accessibilityHint="Starts a timer for this stretch"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  step: { flexDirection: 'row', alignItems: 'flex-start' },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
