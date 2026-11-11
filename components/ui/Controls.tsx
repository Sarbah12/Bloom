import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/theme';
import { MIN_TOUCH } from '@/theme/tokens';

import { Text } from './Text';

/**
 * A number picker with − / + buttons. Screen readers treat it as one
 * adjustable control: swipe up or down to change the value.
 */
export function Stepper({
  label,
  value,
  min,
  max,
  unit,
  onChange,
  testID,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (next: number) => void;
  testID?: string;
}) {
  const { colors, radii, space } = useTheme();
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));

  const button = (dir: -1 | 1) => {
    const disabled = dir < 0 ? value <= min : value >= max;
    return (
      <Pressable
        onPress={() => set(value + dir)}
        disabled={disabled}
        importantForAccessibility="no"
        accessibilityElementsHidden
        style={({ pressed }) => [
          styles.stepButton,
          {
            borderRadius: radii.pill,
            backgroundColor: pressed ? colors.surfaceMuted : colors.primarySoft,
            opacity: disabled ? 0.4 : 1,
          },
        ]}
      >
        <Feather name={dir < 0 ? 'minus' : 'plus'} size={22} color={colors.onPrimarySoft} />
      </Pressable>
    );
  };

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: `${value}${unit ? ` ${unit}` : ''}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
      style={[styles.stepper, { gap: space.lg }]}
    >
      {button(-1)}
      <View style={styles.stepValue}>
        <Text variant="hero" align="center">
          {value}
        </Text>
        {unit ? (
          <Text variant="footnote" tone="muted" align="center">
            {unit}
          </Text>
        ) : null}
      </View>
      {button(1)}
    </View>
  );
}

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
}

/** Pick one of a few options. Each segment is a radio button. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentOption<T>[];
  value: T | undefined;
  onChange: (next: T) => void;
  label: string;
}) {
  const { colors, radii, space } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.segmented, { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, padding: space.xs }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: selected }}
            aria-checked={selected}
            style={[
              styles.segment,
              {
                borderRadius: radii.pill,
                backgroundColor: selected ? colors.surface : 'transparent',
                borderColor: selected ? colors.borderStrong : 'transparent',
              },
            ]}
          >
            <Text variant="callout" tone={selected ? 'default' : 'muted'} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TextField({ label, hint, error, ...input }: TextInputProps & { label: string; hint?: string; error?: string }) {
  const { colors, radii, space, type } = useTheme();
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text variant="headline" style={{ marginBottom: space.sm }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.inkSubtle}
        {...input}
        style={[
          type.body,
          {
            color: colors.ink,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.borderStrong,
            borderWidth: 1,
            borderRadius: radii.md,
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
            minHeight: MIN_TOUCH,
          },
          input.multiline ? { minHeight: 120, textAlignVertical: 'top' } : null,
          input.style,
        ]}
      />
      {error ? (
        <Text variant="footnote" tone="danger" style={{ marginTop: space.xs }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="footnote" tone="muted" style={{ marginTop: space.xs }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepButton: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 96 },
  mini: { flexDirection: 'row', alignItems: 'center' },
  miniButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  miniValue: { minWidth: 64 },
  segmented: { flexDirection: 'row' },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
  },
});

/**
 * A small inline − value + control for quick counts (sleep, water). Starts
 * empty ("—"); the first tap sets `start`. One adjustable element for screen
 * readers.
 */
export function CompactStepper({
  label,
  value,
  start,
  step = 1,
  min,
  max,
  format = (n) => String(n),
  onChange,
  testID,
}: {
  label: string;
  value: number | undefined;
  start: number;
  step?: number;
  min: number;
  max: number;
  format?: (n: number) => string;
  onChange: (next: number | undefined) => void;
  testID?: string;
}) {
  const { colors, radii, space } = useTheme();
  const move = (dir: -1 | 1) => {
    if (value === undefined) return onChange(start);
    const next = Math.round((value + dir * step) * 100) / 100;
    if (next < min) return onChange(undefined);
    onChange(Math.min(max, next));
  };
  const shown = value === undefined ? '—' : format(value);

  const button = (dir: -1 | 1) => (
    <Pressable
      onPress={() => move(dir)}
      disabled={dir < 0 && value === undefined}
      importantForAccessibility="no"
      accessibilityElementsHidden
      hitSlop={6}
      style={({ pressed }) => [
        styles.miniButton,
        {
          borderRadius: radii.pill,
          backgroundColor: pressed ? colors.surfaceMuted : colors.primarySoft,
          opacity: dir < 0 && value === undefined ? 0.4 : 1,
        },
      ]}
    >
      <Feather name={dir < 0 ? 'minus' : 'plus'} size={18} color={colors.onPrimarySoft} />
    </Pressable>
  );

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: value === undefined ? 'Not logged' : format(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => move(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={[styles.mini, { gap: space.sm }]}
    >
      {button(-1)}
      <Text variant="headline" align="center" style={styles.miniValue} tone={value === undefined ? 'subtle' : 'default'}>
        {shown}
      </Text>
      {button(1)}
    </View>
  );
}
