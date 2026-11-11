import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { GradientCard } from '@/components/ui/GradientCard';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';

/** Breathe in for 4 seconds, out for 6: a slow rhythm that helps the body settle. */
const IN_MS = 4000;
const OUT_MS = 6000;
const ROUNDS = 6; // one minute

type Phase = 'idle' | 'in' | 'out' | 'done';

const LABEL: Record<Phase, string> = {
  idle: 'Ready',
  in: 'Breathe in',
  out: 'Breathe out',
  done: 'Well done',
};

/**
 * A one-minute guided breathing exercise. With Reduce Motion on, the circle
 * stays still and the words carry the rhythm.
 */
export function BreathingExercise() {
  const { colors, space } = useTheme();
  const [phase, setPhase] = useState<Phase>('idle');
  const [round, setRound] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const scale = useRef(new Animated.Value(0.6)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const animate = (to: number, ms: number) => {
    if (reduceMotion) return;
    Animated.timing(scale, { toValue: to, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start();
  };

  const stop = (finished: boolean) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    scale.stopAnimation();
    animate(0.6, 600);
    setPhase(finished ? 'done' : 'idle');
  };

  const start = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    for (let r = 0; r < ROUNDS; r++) {
      const base = r * (IN_MS + OUT_MS);
      timers.current.push(
        setTimeout(() => {
          setRound(r + 1);
          setPhase('in');
          animate(1, IN_MS);
          if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
        }, base),
        setTimeout(() => {
          setPhase('out');
          animate(0.6, OUT_MS);
        }, base + IN_MS),
      );
    }
    timers.current.push(setTimeout(() => stop(true), ROUNDS * (IN_MS + OUT_MS)));
  };

  const running = phase === 'in' || phase === 'out';

  return (
    <GradientCard>
      <Text variant="eyebrow" color={colors.onHeroMuted}>
        Slow breathing · 1 minute
      </Text>
      <Text variant="title2" color={colors.onHero} style={{ marginTop: space.xs }}>
        Breathe in for 4, out for 6
      </Text>
      <View
        style={[styles.stage, { marginVertical: space.xl }]}
        accessibilityLiveRegion="polite"
        accessible
        accessibilityLabel={running ? `${LABEL[phase]}. Round ${round} of ${ROUNDS}` : LABEL[phase]}
      >
        <Animated.View style={[styles.circle, { backgroundColor: colors.onHero, opacity: 0.1, transform: [{ scale }] }]} />
        <Animated.View style={[styles.core, { backgroundColor: colors.onHero, opacity: 0.14, transform: [{ scale }] }]} />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.center}>
            <Text variant="title2" color={colors.onHero} align="center">
              {LABEL[phase]}
            </Text>
            {running ? (
              <Text variant="caption" color={colors.onHero} align="center">
                Round {round} of {ROUNDS}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
      <Button
        label={running ? 'Stop' : phase === 'done' ? 'Again' : 'Start'}
        icon={running ? 'square' : 'play'}
        variant="inverse"
        fullWidth
        onPress={() => (running ? stop(false) : start())}
      />
    </GradientCard>
  );
}

const styles = StyleSheet.create({
  stage: { height: 200, alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute', width: 200, height: 200, borderRadius: 100 },
  core: { position: 'absolute', width: 140, height: 140, borderRadius: 70 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
