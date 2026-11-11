import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme';
import { MIN_TOUCH } from '@/theme/tokens';

import { TAB_BAR_CLEARANCE } from './TabBar';

import { Text } from './Text';

export interface ScreenProps {
  children: ReactNode;
  /** Large serif title at the top of the scroll content. */
  title?: string;
  /** Small uppercase line above the title. */
  eyebrow?: string;
  subtitle?: string;
  /** Shows a compact bar with a back (or close) button. */
  nav?: 'back' | 'close';
  /** Overrides what the back/close button does (default: router back). */
  onBack?: () => void;
  navTitle?: string;
  /** Rendered on the right of the nav bar. */
  navRight?: ReactNode;
  /** Pinned to the bottom (e.g. a primary action). */
  footer?: ReactNode;
  scroll?: boolean;
  /** Leaves room for the floating tab bar. */
  withTabBar?: boolean;
  /** Replaces the default title block, e.g. a greeting row with an avatar. */
  header?: ReactNode;
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
  testID?: string;
}

export function Screen({
  children,
  title,
  eyebrow,
  subtitle,
  nav,
  onBack,
  navTitle,
  navRight,
  footer,
  scroll = true,
  withTabBar,
  header,
  keyboardShouldPersistTaps = 'handled',
  testID,
}: ScreenProps) {
  const { colors, space, elevation, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboardUp, setKeyboardUp] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const heading =
    title || eyebrow ? (
      <View style={{ marginBottom: space.xxl, marginTop: nav ? space.sm : space.lg }}>
        {eyebrow ? (
          <Text variant="eyebrow" tone="muted" style={{ marginBottom: space.sm }}>
            {eyebrow}
          </Text>
        ) : null}
        {title ? (
          <Text variant="display" heading>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="body" tone="muted" style={{ marginTop: space.sm }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    ) : null;

  const body = (
    <>
      {header ? <View style={{ marginTop: space.lg, marginBottom: space.xl }}>{header}</View> : heading}
      {children}
    </>
  );

  return (
    <View
      testID={testID}
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: nav === 'close' && Platform.OS === 'ios' ? space.md : insets.top },
      ]}
    >
      {nav ? (
        <View style={[styles.nav, { paddingHorizontal: space.md, paddingTop: space.xs }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nav === 'close' ? 'Close' : 'Back'}
            onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
            hitSlop={4}
            style={styles.navButton}
          >
            <View
              style={[
                styles.navCircle,
                {
                  backgroundColor: colors.surface,
                  shadowColor: colors.shadow,
                  borderWidth: scheme === 'dark' ? 1 : 0,
                  borderColor: colors.border,
                  ...elevation.card,
                },
              ]}
            >
              <Feather name={nav === 'close' ? 'x' : 'chevron-left'} size={22} color={colors.ink} />
            </View>
          </Pressable>
          <Text variant="headline" numberOfLines={1} style={styles.navTitle} heading={!!navTitle && !title}>
            {navTitle ?? ''}
          </Text>
          <View style={styles.navButton}>{navRight}</View>
        </View>
      ) : null}
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={styles.root}
            keyboardShouldPersistTaps={keyboardShouldPersistTaps}
            contentContainerStyle={{
              paddingHorizontal: space.gutter,
              paddingBottom: footer ? space.xxl : insets.bottom + (withTabBar ? TAB_BAR_CLEARANCE : space.huge),
            }}
          >
            {body}
          </ScrollView>
        ) : (
          <View style={[styles.root, { paddingHorizontal: space.gutter }]}>{body}</View>
        )}
        {footer ? (
          <View
            style={{
              paddingHorizontal: space.gutter,
              paddingTop: space.md,
              paddingBottom: keyboardUp ? space.md : insets.bottom + space.lg,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
              backgroundColor: colors.background,
            }}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH },
  navButton: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  navCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center' },
});
