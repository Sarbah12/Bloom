import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { useTheme } from '@/theme/theme';
import type { Phase } from '@/theme/tokens';

export interface CycleRingProps {
  cycleLength: number;
  /** Bleeding days at the start of this cycle. */
  periodLength: number;
  /** Cycle day of the estimated ovulation. */
  ovulationDay: number;
  /** Today's cycle day; may exceed `cycleLength` when a period is late. */
  cycleDay: number;
  size?: number;
  accessibilityLabel: string;
  children?: ReactNode;
}

/**
 * The cycle as a ring: one arc per phase, sized by days, with a marker for
 * today. Phases are also named in the text beside it — colour is never the
 * only cue.
 */
export function CycleRing({ cycleLength, periodLength, ovulationDay, cycleDay, size = 220, accessibilityLabel, children }: CycleRingProps) {
  const { colors } = useTheme();
  const stroke = 14;
  const r = (size - stroke) / 2 - 6;
  const c = 2 * Math.PI * r;
  const C = Math.max(cycleLength, 1);
  const perDay = c / C;
  const gap = 3;

  const P = Math.min(periodLength, C);
  const ovuStart = Math.max(P + 1, ovulationDay - 1);
  const ovuEnd = Math.min(C, ovulationDay + 1);
  const segments: { phase: Phase; from: number; to: number }[] = [
    { phase: 'menstrual' as Phase, from: 1, to: P },
    { phase: 'follicular' as Phase, from: P + 1, to: ovuStart - 1 },
    { phase: 'ovulatory' as Phase, from: ovuStart, to: ovuEnd },
    { phase: 'luteal' as Phase, from: ovuEnd + 1, to: C },
  ].filter((s) => s.to >= s.from);

  const day = Math.min(Math.max(cycleDay, 1), C);
  const angle = ((day - 0.5) / C) * 2 * Math.PI - Math.PI / 2;
  const cx = size / 2;
  const mx = cx + r * Math.cos(angle);
  const my = cx + r * Math.sin(angle);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cx} r={r} stroke={colors.surfaceMuted} strokeWidth={stroke} fill="none" />
        <G transform={`rotate(-90 ${cx} ${cx})`}>
          {segments.map((s) => {
            const len = (s.to - s.from + 1) * perDay - gap;
            return (
              <Circle
                key={s.phase}
                cx={cx}
                cy={cx}
                r={r}
                stroke={colors.phase[s.phase].solid}
                strokeWidth={stroke}
                strokeLinecap="butt"
                fill="none"
                strokeDasharray={`${Math.max(len, 0.1)} ${c}`}
                strokeDashoffset={-((s.from - 1) * perDay + gap / 2)}
                opacity={day >= s.from && day <= s.to ? 1 : 0.4}
              />
            );
          })}
        </G>
        <Circle cx={mx} cy={my} r={stroke / 2 + 5} fill={colors.surface} />
        <Circle cx={mx} cy={my} r={stroke / 2 + 1} fill={colors.ink} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: 36 },
});
