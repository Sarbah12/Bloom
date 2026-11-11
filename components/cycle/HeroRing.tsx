import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';

/** A light progress ring for the dark hero card: how far through the cycle you are. */
export function HeroRing({ day, length, size = 104 }: { day: number; length: number; size?: number }) {
  const { colors } = useTheme();
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = Math.min(1, Math.max(0, day / Math.max(length, 1)));

  return (
    <View style={{ width: size, height: size }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.onHero} strokeOpacity={0.18} strokeWidth={stroke} fill="none" />
        <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.onHero}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c * progress} ${c}`}
          />
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text variant="caption" color={colors.onHeroMuted}>
          Day
        </Text>
        <Text variant="title1" color={colors.onHero}>
          {day}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
