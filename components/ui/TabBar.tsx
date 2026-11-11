import Feather from '@expo/vector-icons/Feather';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme';

import type { FeatherName } from './Button';
import { Text } from './Text';

export const TAB_ICONS: Record<string, FeatherName> = {
  index: 'home',
  calendar: 'calendar',
  insights: 'pie-chart',
  learn: 'book-open',
  profile: 'user',
};

/** Space screens leave at the bottom so content clears the floating bar. */
export const TAB_BAR_CLEARANCE = 96;

/**
 * A floating pill tab bar. The current tab expands into a dark pill with its
 * name; the others show an icon only but keep their name for screen readers.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, radii, space, elevation, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, space.md), paddingHorizontal: space.lg }]}>
      <View
        accessibilityRole="tablist"
        style={[
          styles.bar,
          {
            backgroundColor: colors.surface,
            borderRadius: radii.pill,
            padding: 6,
            shadowColor: colors.shadow,
            borderWidth: scheme === 'dark' ? 1 : 0,
            borderColor: colors.border,
            ...elevation.raised,
            shadowOpacity: 0.1,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;
          const icon = TAB_ICONS[route.name] ?? 'circle';

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              aria-selected={focused}
              testID={`tab-${route.name}`}
              style={[
                styles.tab,
                focused
                  ? { flex: 1, backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: space.md }
                  : styles.iconTab,
              ]}
            >
              <Feather name={icon} size={20} color={focused ? colors.onPrimary : colors.inkMuted} />
              {focused ? (
                <Text
                  variant="headline"
                  color={colors.onPrimary}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                  style={{ marginLeft: space.sm }}
                >
                  {label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  tab: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  iconTab: { width: 46 },
});
