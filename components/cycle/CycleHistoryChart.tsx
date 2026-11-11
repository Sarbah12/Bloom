import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import type { CompletedCycle } from '@/lib/cycle/engine';
import { LIMITS } from '@/lib/cycle/engine';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/theme/theme';

/**
 * Recent cycle lengths as bars, with the typical 24–38 day range shaded so
 * you can see at a glance which cycles sat outside it. Every bar is labelled
 * with its length, and the whole chart has a spoken summary.
 */
export function CycleHistoryChart({ cycles }: { cycles: CompletedCycle[] }) {
  const { colors, fonts, space } = useTheme();
  const [width, setWidth] = useState(0);
  const recent = cycles.slice(-8);
  const height = 180;
  const top = 18;
  const bottom = 28;
  const plot = height - top - bottom;
  const maxLen = Math.max(45, ...recent.map((c) => c.length));
  const y = (days: number) => top + plot - (Math.min(days, maxLen) / maxLen) * plot;
  const slot = recent.length ? width / recent.length : 0;
  const barW = Math.min(28, slot * 0.55);

  const summary = recent.length
    ? `Cycle lengths, oldest to newest: ${recent.map((c) => `${c.length} days${c.counted ? '' : ' (not counted)'}`).join(', ')}. Typical range is ${LIMITS.typicalCycleMin} to ${LIMITS.typicalCycleMax} days.`
    : 'No completed cycles yet.';

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Rect
            x={0}
            y={y(LIMITS.typicalCycleMax)}
            width={width}
            height={y(LIMITS.typicalCycleMin) - y(LIMITS.typicalCycleMax)}
            fill={colors.phase.follicular.soft}
          />
          <Line x1={0} x2={width} y1={top + plot} y2={top + plot} stroke={colors.border} strokeWidth={1} />
          {recent.map((c, i) => {
            const cx = slot * i + slot / 2;
            const inRange = c.length >= LIMITS.typicalCycleMin && c.length <= LIMITS.typicalCycleMax;
            return (
              <G key={c.start}>
                <Rect
                  x={cx - barW / 2}
                  y={y(c.length)}
                  width={barW}
                  height={top + plot - y(c.length)}
                  rx={6}
                  fill={c.counted ? (inRange ? colors.primary : colors.phase.ovulatory.solid) : colors.borderStrong}
                />
                <SvgText x={cx} y={y(c.length) - 5} fontSize={12} fontFamily={fonts.bodySemibold} fill={colors.ink} textAnchor="middle">
                  {c.length}
                </SvgText>
                <SvgText x={cx} y={height - 8} fontSize={11} fontFamily={fonts.body} fill={colors.inkMuted} textAnchor="middle">
                  {formatDate(c.start).split(' ').slice(0, 2).join(' ')}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      <Text variant="footnote" tone="muted" style={{ marginTop: space.sm }}>
        Shaded band: typical range ({LIMITS.typicalCycleMin}–{LIMITS.typicalCycleMax} days). Grey bars look like a missed log and aren’t
        used for estimates.
      </Text>
    </View>
  );
}
