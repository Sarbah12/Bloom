import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useLargeText } from '@/lib/ui/useLargeText';
import { useTheme } from '@/theme/theme';

import type { FeatherName } from './Button';
import { Text } from './Text';

export type NoticeTone = 'info' | 'care' | 'privacy';

/**
 * A quiet callout. `care` is for "worth talking to a healthcare professional"
 * messages — it is warm, never alarming, and never a diagnosis.
 */
export function Notice({
  tone = 'info',
  title,
  children,
  icon,
  action,
}: {
  tone?: NoticeTone;
  title?: string;
  children: ReactNode;
  icon?: FeatherName;
  action?: ReactNode;
}) {
  const { colors, radii, space } = useTheme();
  const palette = {
    info: { bg: colors.surfaceMuted, fg: colors.ink, icon: 'info' as FeatherName, iconColor: colors.inkMuted },
    care: { bg: colors.warningSoft, fg: colors.onWarningSoft, icon: 'heart' as FeatherName, iconColor: colors.onWarningSoft },
    privacy: { bg: colors.primarySoft, fg: colors.onPrimarySoft, icon: 'shield' as FeatherName, iconColor: colors.onPrimarySoft },
  }[tone];

  return (
    <View accessible={!action} style={[styles.notice, { backgroundColor: palette.bg, borderRadius: radii.md, padding: space.lg }]}>
      <Feather name={icon ?? palette.icon} size={18} color={palette.iconColor} style={{ marginTop: 2, marginRight: space.md }} />
      <View style={styles.flex}>
        {title ? (
          <Text variant="headline" color={palette.fg} style={{ marginBottom: space.xs }}>
            {title}
          </Text>
        ) : null}
        {typeof children === 'string' ? (
          <Text variant="footnote" color={palette.fg}>
            {children}
          </Text>
        ) : (
          children
        )}
        {action ? <View style={{ marginTop: space.md }}>{action}</View> : null}
      </View>
    </View>
  );
}

export function StatTile({ label, value, caption, accent }: { label: string; value: string; caption?: string; accent?: string }) {
  const { colors, radii, space, elevation, scheme } = useTheme();
  const largeText = useLargeText();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${caption ? `. ${caption}` : ''}`}
      style={[
        styles.tile,
        largeText ? { minWidth: '100%' } : null,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: scheme === 'dark' ? 1 : 0,
          borderRadius: radii.lg,
          padding: space.lg,
          shadowColor: colors.shadow,
          ...elevation.card,
        },
      ]}
    >
      <Text variant="eyebrow" tone="muted">
        {label}
      </Text>
      <Text variant="title1" color={accent} style={{ marginTop: space.sm }}>
        {value}
      </Text>
      {caption ? (
        <Text variant="footnote" tone="muted" style={{ marginTop: space.xs }}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  const { space } = useTheme();
  return (
    <View style={[styles.section, { marginTop: space.xxl, marginBottom: space.md }]}>
      <Text variant="title2" heading style={styles.flex}>
        {title}
      </Text>
      {action}
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: FeatherName; title: string; body: string; action?: ReactNode }) {
  const { colors, space } = useTheme();
  return (
    <View style={[styles.empty, { paddingVertical: space.xxxl, gap: space.sm }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
        <Feather name={icon} size={24} color={colors.onPrimarySoft} />
      </View>
      <Text variant="title3" align="center">
        {title}
      </Text>
      <Text variant="callout" tone="muted" align="center" style={{ maxWidth: 320 }}>
        {body}
      </Text>
      {action ? <View style={{ marginTop: space.md }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'flex-start' },
  flex: { flex: 1 },
  tile: { flex: 1, minWidth: 140, minHeight: 118 },
  section: { flexDirection: 'row', alignItems: 'center' },
  empty: { alignItems: 'center' },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
