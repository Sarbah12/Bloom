import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { EmptyState, Notice, SectionHeader } from '@/components/ui/Feedback';
import { GradientCard } from '@/components/ui/GradientCard';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { CONTRACEPTION_DISCLAIMER, PHASES } from '@/lib/content/phases';
import { diffDays, toLocalISO } from '@/lib/cycle/dates';
import { moodLabel, symptomLabel } from '@/lib/data/catalog';
import { useToday } from '@/lib/data/today';
import { formatDate, formatRange } from '@/lib/format';
import { supportTips, type PartnerView } from '@/lib/partner/summary';
import { getPartnerViews } from '@/lib/supabase/partner';
import { useTheme } from '@/theme/theme';

function updatedText(iso: string | undefined, today: string): string {
  if (!iso) return 'Not updated yet — it appears once they open Bloom.';
  const days = diffDays(toLocalISO(new Date(iso)), today);
  return days <= 0 ? 'Updated today' : days === 1 ? 'Updated yesterday' : `Updated ${days} days ago`;
}

/** What a partner sees: only the parts the person chose to share. */
export default function PartnerViewScreen() {
  const { colors, space } = useTheme();
  const today = useToday();
  const [views, setViews] = useState<PartnerView[] | null>(null);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      setViews(await getPartnerViews());
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Reload whenever the screen is opened, so it shows their latest summary.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const v = views?.[0];
  const name = v?.label || 'Your partner';
  const dayOfYear = Number(today.slice(5, 7)) * 31 + Number(today.slice(8, 10));

  return (
    <Screen
      nav="back"
      eyebrow="Partner mode"
      title={v ? name : 'Partner'}
      subtitle={v ? updatedText(v.updated_at, today) : undefined}
      testID="partner-view"
    >
      {error ? (
        <Notice tone="care" title="Couldn’t load">
          {error}
        </Notice>
      ) : views && !v ? (
        <EmptyState icon="heart" title="Nothing shared with you" body="When someone shares their cycle with you, it appears here." />
      ) : v ? (
        <>
          {v.period ? (
            <GradientCard>
              <Text variant="eyebrow" color={colors.onHeroMuted}>
                {v.period.isPeriodDay ? 'Period' : v.period.isLate ? 'Period' : 'Next period'}
              </Text>
              <Text variant="display" color={colors.onHero} style={{ marginTop: space.xs }}>
                {v.period.isPeriodDay
                  ? `Day ${v.period.periodDay ?? 1}`
                  : v.period.isLate
                    ? `${v.period.daysLate} days later than expected`
                    : v.period.nextStart
                      ? `In about ${Math.max(0, diffDays(today, v.period.nextStart))} days`
                      : 'Not enough data yet'}
              </Text>
              {!v.period.isPeriodDay && v.period.windowStart && v.period.windowEnd ? (
                <Text variant="callout" color={colors.onHeroMuted} style={{ marginTop: space.xs }}>
                  Expected {formatRange(v.period.windowStart, v.period.windowEnd)}
                </Text>
              ) : null}
            </GradientCard>
          ) : null}

          {v.phase?.phase ? (
            <Card style={{ marginTop: space.lg }}>
              <Text variant="eyebrow" tone="muted">
                {v.phase.cycleDay ? `Cycle day ${v.phase.cycleDay}` : 'Phase'}
              </Text>
              <Text variant="title3" style={{ marginTop: 2 }}>
                {PHASES[v.phase.phase].label}
              </Text>
            </Card>
          ) : null}

          {v.today && (v.today.moods.length || v.today.symptoms.length) ? (
            <>
              <SectionHeader title="Today" />
              <Card>
                {v.today.symptoms.length ? (
                  <Text variant="callout">
                    <Text variant="headline">Symptoms: </Text>
                    {v.today.symptoms.map(symptomLabel).join(', ')}
                  </Text>
                ) : null}
                {v.today.moods.length ? (
                  <Text variant="callout" style={{ marginTop: v.today.symptoms.length ? space.xs : 0 }}>
                    <Text variant="headline">Mood: </Text>
                    {v.today.moods.map(moodLabel).join(', ')}
                  </Text>
                ) : null}
              </Card>
            </>
          ) : null}

          {supportTips(v, dayOfYear).length ? (
            <>
              <SectionHeader title="How you can help" />
              <View style={{ gap: space.md }}>
                {supportTips(v, dayOfYear).map((t) => (
                  <Card key={t}>
                    <Text variant="callout">{t}</Text>
                  </Card>
                ))}
              </View>
            </>
          ) : null}

          {v.fertile ? (
            <>
              <SectionHeader title="Fertile window (estimate)" />
              <Card>
                <Text variant="headline">{formatRange(v.fertile.start, v.fertile.end)}</Text>
                <Text variant="footnote" tone="muted" style={{ marginTop: space.xs }}>
                  {CONTRACEPTION_DISCLAIMER}
                </Text>
              </Card>
            </>
          ) : null}

          <Text variant="footnote" tone="muted" style={{ marginTop: space.xl }}>
            {name} chooses what you see here and can stop sharing at any time. Dates are estimates from {name}’s own logs
            {v.as_of ? ` (as of ${formatDate(v.as_of)})` : ''}.
          </Text>
        </>
      ) : null}
    </Screen>
  );
}
