import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { useTheme } from '@/theme/theme';

import type { FeatherName } from './Button';
import { Text } from './Text';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: FeatherName;
  /** Text shown on the right, e.g. the current value of a setting. */
  value?: string;
  onPress?: () => void;
  /** Renders a switch instead of a chevron. */
  toggle?: { value: boolean; onChange: (next: boolean) => void; disabled?: boolean };
  destructive?: boolean;
  right?: ReactNode;
  last?: boolean;
  testID?: string;
}

export function ListRow({ title, subtitle, icon, value, onPress, toggle, destructive, right, last, testID }: ListRowProps) {
  const { colors, space } = useTheme();
  const fg = destructive ? colors.danger : colors.ink;

  const content = (
    <View
      style={[
        styles.row,
        {
          paddingVertical: space.md,
          paddingHorizontal: space.lg,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
    >
      {icon ? (
        <View style={[styles.icon, { backgroundColor: destructive ? colors.dangerSoft : colors.primarySoft }]}>
          <Feather name={icon} size={17} color={destructive ? colors.onDangerSoft : colors.onPrimarySoft} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text variant="bodyStrong" color={fg}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" tone="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="callout" tone="muted" style={{ marginLeft: space.sm }}>
          {value}
        </Text>
      ) : null}
      {right}
      {toggle ? (
        // iOS 26 draws its switch at the top of a stretched frame, so it gets
        // its own fixed-height box to stay centred in taller rows.
        <View style={styles.switchBox} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Switch
            value={toggle.value}
            onValueChange={toggle.onChange}
            disabled={toggle.disabled}
            trackColor={{ true: colors.primary, false: colors.switchOff }}
            thumbColor="#FFFFFF"
            {...({ activeThumbColor: '#FFFFFF' } as object)}
            ios_backgroundColor={colors.switchOff}
          />
        </View>
      ) : onPress ? (
        <Feather name="chevron-right" size={20} color={colors.inkSubtle} style={{ marginLeft: space.xs }} />
      ) : null}
    </View>
  );

  if (toggle) {
    // The whole row flips the switch: a far bigger target than the switch
    // itself, and one element for screen readers ("App Lock, switch, off").
    return (
      <Pressable
        testID={testID}
        onPress={() => toggle.onChange(!toggle.value)}
        disabled={toggle.disabled}
        accessibilityRole="switch"
        accessibilityLabel={title}
        accessibilityHint={subtitle}
        accessibilityState={{ checked: toggle.value, disabled: !!toggle.disabled }}
        aria-checked={toggle.value}
        style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceMuted : 'transparent', opacity: toggle.disabled ? 0.5 : 1 })}
      >
        {content}
      </Pressable>
    );
  }

  if (!onPress) return <View testID={testID}>{content}</View>;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}, ${value}` : title}
      accessibilityHint={subtitle}
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceMuted : 'transparent' })}
    >
      {content}
    </Pressable>
  );
}

/** A rounded group of rows, like a settings section. */
export function ListGroup({ children, title, flush }: { children: ReactNode; title?: string; flush?: boolean }) {
  const { colors, radii, space } = useTheme();
  return (
    <View style={{ marginBottom: flush ? 0 : space.xxl }}>
      {title ? (
        <Text variant="eyebrow" tone="muted" style={{ marginBottom: space.sm, marginLeft: space.xs }} heading>
          {title}
        </Text>
      ) : null}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  text: { flex: 1 },
  switchBox: { height: 32, justifyContent: 'center', marginLeft: 12 },
});
