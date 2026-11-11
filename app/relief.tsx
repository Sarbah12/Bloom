import Feather from '@expo/vector-icons/Feather';
import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { BreathingExercise } from '@/components/relief/BreathingExercise';
import { StretchCard } from '@/components/relief/StretchCard';
import { Card } from '@/components/ui/Card';
import { Notice, SectionHeader } from '@/components/ui/Feedback';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { MEDICAL_DISCLAIMER } from '@/lib/content/phases';
import { GET_URGENT_HELP_IF, RELIEF_IDEAS, RELIEF_SOURCES, SEE_SOMEONE_IF, STRETCHES } from '@/lib/content/relief';
import { reliefStats } from '@/lib/cycle/changes';
import { RELIEF, reliefLabel } from '@/lib/data/catalog';
import { useData } from '@/lib/data/store';
import { useTheme } from '@/theme/theme';

/** Cramp relief: what has helped you, a breathing exercise, stretches, and when to get help. */
export default function Relief() {
  const { data } = useData();
  const { colors, space } = useTheme();
  const stats = useMemo(() => reliefStats(Object.values(data.days)), [data.days]);
  const crampDays = useMemo(() => Object.values(data.days).filter((d) => d.symptoms.includes('cramps')).length, [data.days]);

  return (
    <Screen
      nav="back"
      eyebrow="Feel better"
      title="Cramp relief"
      subtitle="Gentle ways to ease period pain, and what has worked for you."
      testID="relief"
    >
      {stats.length ? (
        <Card>
          <Text variant="title3">What helps you</Text>
          <Text variant="footnote" tone="muted" style={{ marginTop: 2, marginBottom: space.md }}>
            From the {crampDays} {crampDays === 1 ? 'day' : 'days'} you logged cramps
          </Text>
          <View style={{ gap: space.md }}>
            {stats.slice(0, 4).map((s, i) => {
              const icon = RELIEF.find((r) => r.key === s.key)?.icon ?? 'check';
              const share = crampDays ? s.days / crampDays : 0;
              return (
                <View
                  key={s.key}
                  style={[styles.row, { gap: space.md }]}
                  accessible
                  accessibilityLabel={`${reliefLabel(s.key)} helped on ${s.days} days`}
                >
                  <View style={[styles.tile, { backgroundColor: i === 0 ? colors.primary : colors.primarySoft }]}>
                    <Feather name={icon} size={17} color={i === 0 ? colors.onPrimary : colors.onPrimarySoft} />
                  </View>
                  <View style={styles.flex}>
                    <Text variant="headline">{reliefLabel(s.key)}</Text>
                    <View style={[styles.track, { backgroundColor: colors.surfaceMuted, marginTop: 6 }]}>
                      <View style={[styles.fill, { backgroundColor: colors.primary, width: `${Math.max(8, Math.round(share * 100))}%` }]} />
                    </View>
                  </View>
                  <Text variant="caption" tone="muted">
                    helped {s.days}×
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>
      ) : (
        <Notice tone="privacy" icon="heart" title="Learn what works for you">
          When you log cramps, add what helped. Bloom will show which relief works best for you.
        </Notice>
      )}

      <View style={{ marginTop: space.lg }}>
        <BreathingExercise />
      </View>

      <SectionHeader title="Gentle stretches" />
      <View style={{ gap: space.md }}>
        {STRETCHES.map((s) => (
          <StretchCard key={s.key} stretch={s} />
        ))}
      </View>

      <SectionHeader title="Other things that help" />
      <Card padded={false}>
        {RELIEF_IDEAS.map((idea, i) => (
          <View
            key={idea.title}
            style={[
              styles.row,
              {
                alignItems: 'flex-start',
                padding: space.lg,
                gap: space.md,
                borderBottomWidth: i < RELIEF_IDEAS.length - 1 ? StyleSheet.hairlineWidth : 0,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View style={[styles.tile, { backgroundColor: colors.primarySoft }]}>
              <Feather name={idea.icon} size={17} color={colors.onPrimarySoft} />
            </View>
            <View style={styles.flex}>
              <Text variant="headline">{idea.title}</Text>
              <Text variant="callout" tone="muted" style={{ marginTop: 2 }}>
                {idea.body}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <SectionHeader title="When to get help" />
      <View style={{ gap: space.md }}>
        <Notice tone="care" title="Talk to a doctor or nurse if">
          <View style={{ gap: space.xs }}>
            {SEE_SOMEONE_IF.map((t) => (
              <Text key={t} variant="footnote" color={colors.onWarningSoft}>
                • {t}
              </Text>
            ))}
          </View>
        </Notice>
        <Notice tone="info" icon="alert-triangle" title="Get urgent help if">
          <View style={{ gap: space.xs }}>
            {GET_URGENT_HELP_IF.map((t) => (
              <Text key={t} variant="footnote">
                • {t}
              </Text>
            ))}
          </View>
        </Notice>
      </View>

      <Text variant="eyebrow" tone="muted" style={{ marginTop: space.xxl, marginBottom: space.sm }} heading>
        Sources
      </Text>
      {RELIEF_SOURCES.map((src) => (
        <Pressable
          key={src.url}
          accessibilityRole="link"
          accessibilityLabel={`${src.label}, opens in your browser`}
          onPress={() => Linking.openURL(src.url)}
          style={[styles.row, { minHeight: 44, gap: space.sm }]}
        >
          <Feather name="external-link" size={15} color={colors.primary} />
          <Text variant="callout" tone="primary" style={styles.flex}>
            {src.label}
          </Text>
        </Pressable>
      ))}
      <Text variant="footnote" tone="muted" style={{ marginTop: space.lg }}>
        {MEDICAL_DISCLAIMER}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  tile: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
