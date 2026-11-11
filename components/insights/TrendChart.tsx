import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import type { TrendBucket } from '@/lib/cycle/trends';
import { useTheme } from '@/theme/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1] ?? key;

/**
 * How often a symptom or mood was logged, as a share of check-in days — by
 * cycle day or by month. Days with no check-ins show as a faint tick, so
 * "not logged" never looks like "didn't happen". Has a spoken summary.
 */
export function TrendChart({
  buckets,
  mode,
  color,
  name,
}: {
  buckets: TrendBucket[];
  mode: 'cycleDay' | 'month';
  color: string;
  name: string;
}) {
  const { colors, fonts } = useTheme();
  const [width, setWidth] = useState(0);
  const height = 150;
  const top = 8;
  const bottom = 22;
  const plot = height - top - bottom;
  const slot = buckets.length ? width / buckets.length : 0;
  const barW = Math.max(3, Math.min(mode === 'month' ? 28 : 10, slot * 0.7));
  const share = (b: TrendBucket) => (b.logged ? b.matching / b.logged : 0);

  const label = (b: TrendBucket, i: number) => {
    if (mode === 'month') return monthName(b.label);
    const day = i + 1;
    return day === 1 || day % 7 === 0 ? String(day) : '';
  };

  const spoken =
    mode === 'month'
      ? `${name} by month: ${buckets.map((b) => `${monthName(b.label)} ${b.logged ? `${b.matching} of ${b.logged} days` : 'no check-ins'}`).join(', ')}.`
      : `${name} by cycle day: ${
          buckets
            .map((b, i) => (b.matching ? `day ${i + 1}, ${Math.round(share(b) * 100)}%` : ''))
            .filter(Boolean)
            .join('; ') || 'not logged yet'
        }.`;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={spoken}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          {[0.5, 1].map((g) => (
            <Line
              key={g}
              x1={0}
              x2={width}
              y1={top + plot - g * plot}
              y2={top + plot - g * plot}
              stroke={colors.border}
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          ))}
          <Line x1={0} x2={width} y1={top + plot} y2={top + plot} stroke={colors.border} strokeWidth={1} />
          {buckets.map((b, i) => {
            const cx = slot * i + slot / 2;
            const h = b.logged ? Math.max(b.matching ? 3 : 0, share(b) * plot) : 0;
            return (
              <G key={b.label}>
                {b.logged ? (
                  <Rect x={cx - barW / 2} y={top + plot - h} width={barW} height={h} rx={Math.min(4, barW / 2)} fill={color} />
                ) : (
                  <Rect x={cx - barW / 2} y={top + plot - 2} width={barW} height={2} fill={colors.surfaceMuted} />
                )}
                {label(b, i) ? (
                  <SvgText x={cx} y={height - 6} fontSize={11} fontFamily={fonts.body} fill={colors.inkMuted} textAnchor="middle">
                    {label(b, i)}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}
