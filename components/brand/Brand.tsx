import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme';

import { DROP_WITH_CRESCENT, LEAF_LEFT, LEAF_RIGHT } from './logo-paths';

/** The Bloom mark — a drop with a crescent, cradled by two leaves. */
export function BloomMark({ size = 88, color, leafColor }: { size?: number; color?: string; leafColor?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d={LEAF_LEFT} fill={leafColor ?? colors.primary} opacity={leafColor ? 1 : 0.38} />
        <Path d={LEAF_RIGHT} fill={leafColor ?? colors.primary} opacity={leafColor ? 1 : 0.38} />
        <Path d={DROP_WITH_CRESCENT} fill={color ?? colors.primary} fillRule="evenodd" />
      </Svg>
    </View>
  );
}

/** The app icon as it appears on the home screen, for in-app use. */
export function BloomBadge({ size = 96 }: { size?: number }) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Bloom"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        overflow: 'hidden',
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="badge" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F27BA6" />
            <Stop offset="1" stopColor="#A23B6D" />
          </LinearGradient>
        </Defs>
        <Rect width="100" height="100" fill="url(#badge)" />
      </Svg>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <BloomMark size={size * 0.68} color="#FFF7F0" leafColor="#FFD9E6" />
      </View>
    </View>
  );
}

/**
 * "bloom" set in Playfair Display, with the mark standing in for the first o.
 * Drawn as one SVG so the letters and the mark share a true baseline.
 */
export function Wordmark({ height = 48, color }: { height?: number; color?: string }) {
  const { colors, fonts } = useTheme();
  const ink = color ?? colors.ink;
  // Units: font size 100. Widths measured from Playfair Display SemiBold:
  // "bl" 87, "om" 146, ascender 78. The mark stands as tall as the "b" and
  // sits on the baseline, like the sprout in a botanical wordmark.
  const W = 323;
  const H = 104;
  const baseline = 92;
  const s = 0.95;
  const markLeft = 94;
  const tx = markLeft - 12 * s;
  const ty = baseline + 1 - 88 * s;
  return (
    <View accessibilityRole="image" accessibilityLabel="Bloom" style={{ height, width: (height * W) / H }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <SvgText x={4} y={baseline} fontFamily={fonts.wordmark} fontSize={100} fill={ink}>
          bl
        </SvgText>
        <G transform={`translate(${tx} ${ty}) scale(${s})`}>
          <Path d={LEAF_LEFT} fill={colors.primary} opacity={0.38} />
          <Path d={LEAF_RIGHT} fill={colors.primary} opacity={0.38} />
          <Path d={DROP_WITH_CRESCENT} fill={colors.primary} fillRule="evenodd" />
        </G>
        <SvgText x={markLeft + 76 * s + 3} y={baseline} fontFamily={fonts.wordmark} fontSize={100} fill={ink}>
          om
        </SvgText>
      </Svg>
    </View>
  );
}

/**
 * Layered rose waves that sit at the bottom of the welcome screen, with the
 * main action resting on them.
 */
export function WaveFooter({ children, height = 220 }: { children: ReactNode; height?: number }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ height: height + insets.bottom }}>
      <Svg width="100%" height={height} viewBox="0 0 375 220" preserveAspectRatio="none" style={{ position: 'absolute', top: 0 }}>
        <Path d="M0,58 C90,8 180,10 262,48 C322,76 352,66 375,40 L375,220 L0,220 Z" fill={colors.tintStart} />
        <Path d="M0,96 C80,60 170,70 250,96 C310,116 345,102 375,82 L375,220 L0,220 Z" fill={colors.heroEnd} opacity={0.55} />
        <Path d="M0,132 C90,106 170,116 260,138 C320,150 350,142 375,126 L375,220 L0,220 Z" fill={colors.heroStart} />
      </Svg>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: insets.bottom + 2,
          backgroundColor: colors.heroStart,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: insets.bottom + 20,
        }}
      >
        {children}
      </View>
    </View>
  );
}
