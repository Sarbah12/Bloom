import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FeatherName } from '@/components/ui/Button';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { GradientCard } from '@/components/ui/GradientCard';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { ARTICLES, articleBySlug, type Article, type ArticleCategory } from '@/lib/content/articles';
import { useTheme, type Theme } from '@/theme/theme';

const CATEGORIES: ArticleCategory[] = ['Basics', 'Symptoms', 'Mood', 'Fertility', 'Care'];
const FEATURED = 'cycle-phases';

function categoryStyle(category: ArticleCategory, colors: Theme['colors']): { bg: string; fg: string; icon: FeatherName } {
  switch (category) {
    case 'Basics':
      return { bg: colors.phase.luteal.soft, fg: colors.phase.luteal.onSoft, icon: 'compass' };
    case 'Symptoms':
      return { bg: colors.phase.menstrual.soft, fg: colors.phase.menstrual.onSoft, icon: 'activity' };
    case 'Mood':
      return { bg: colors.primarySoft, fg: colors.onPrimarySoft, icon: 'smile' };
    case 'Fertility':
      return { bg: colors.phase.ovulatory.soft, fg: colors.phase.ovulatory.onSoft, icon: 'sun' };
    case 'Care':
      return { bg: colors.phase.follicular.soft, fg: colors.phase.follicular.onSoft, icon: 'heart' };
  }
}

function ArrowCircle({ bg, fg }: { bg: string; fg: string }) {
  return (
    <View style={[styles.arrow, { backgroundColor: bg }]}>
      <Feather name="arrow-right" size={16} color={fg} />
    </View>
  );
}

function ArticleTile({ article }: { article: Article }) {
  const { colors, radii, space } = useTheme();
  const c = categoryStyle(article.category, colors);
  return (
    <Pressable
      onPress={() => router.push(`/learn/${article.slug}`)}
      accessibilityRole="button"
      accessibilityLabel={`${article.title}. ${article.category}, ${article.minutes} minute read.`}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: c.bg, borderRadius: radii.lg, padding: space.lg, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.tileFooter}>
        <View style={[styles.tileIcon, { backgroundColor: colors.surface }]}>
          <Feather name={c.icon} size={18} color={c.fg} />
        </View>
        <ArrowCircle bg={colors.surface} fg={c.fg} />
      </View>
      <View style={{ marginTop: space.lg }}>
        <Text variant="title3" color={c.fg} numberOfLines={3}>
          {article.title}
        </Text>
        <Text variant="caption" color={c.fg} style={{ marginTop: space.xs }}>
          {article.minutes} min read
        </Text>
      </View>
    </Pressable>
  );
}

export default function Learn() {
  const { colors, space } = useTheme();
  const [category, setCategory] = useState<ArticleCategory | null>(null);
  const featured = articleBySlug(FEATURED)!;
  const care = articleBySlug('when-to-seek-care')!;
  const list = (category ? ARTICLES.filter((a) => a.category === category) : ARTICLES).filter((a) => category || a.slug !== FEATURED);

  return (
    <Screen withTabBar title="Learn" subtitle="Clear, sourced guidance on menstrual health." testID="learn">
      {!category ? (
        <GradientCard
          onPress={() => router.push(`/learn/${featured.slug}`)}
          accessibilityLabel={`Featured: ${featured.title}. ${featured.minutes} minute read.`}
          style={{ marginBottom: space.xl }}
        >
          <Text variant="eyebrow" color={colors.onHeroMuted}>
            Start here · {featured.minutes} min read
          </Text>
          <Text variant="title1" color={colors.onHero} style={{ marginTop: space.sm, maxWidth: 260 }}>
            {featured.title}
          </Text>
          <View style={[styles.tileFooter, { marginTop: space.lg }]}>
            <Text variant="callout" color={colors.onHeroMuted} style={{ flex: 1, marginRight: space.md }} numberOfLines={2}>
              {featured.summary}
            </Text>
            <ArrowCircle bg={colors.onHero} fg={colors.heroStart} />
          </View>
        </GradientCard>
      ) : null}

      <ChipGroup scroll>
        <Chip role="radio" label="All" selected={!category} onPress={() => setCategory(null)} />
        {CATEGORIES.map((c) => (
          <Chip key={c} role="radio" label={c} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </ChipGroup>

      <View style={[styles.grid, { gap: space.md, marginTop: space.xl }]}>
        {list.map((a) => (
          <ArticleTile key={a.slug} article={a} />
        ))}
      </View>

      <GradientCard
        variant="tint"
        onPress={() => router.push('/relief')}
        accessibilityLabel="Cramp relief. A breathing exercise, gentle stretches and what helps you."
        style={{ marginTop: space.xl }}
        testID="learn-relief"
      >
        <View style={styles.tileFooter}>
          <View style={{ flex: 1, marginRight: space.md }}>
            <Text variant="headline">Cramp relief</Text>
            <Text variant="footnote" tone="muted" style={{ marginTop: 2 }}>
              Breathing, gentle stretches and what helps you
            </Text>
          </View>
          <ArrowCircle bg={colors.primary} fg={colors.onPrimary} />
        </View>
      </GradientCard>

      <GradientCard
        variant="tint"
        onPress={() => router.push(`/learn/${care.slug}`)}
        accessibilityLabel={`${care.title}. ${care.summary}`}
        style={{ marginTop: space.md }}
      >
        <View style={styles.tileFooter}>
          <View style={{ flex: 1, marginRight: space.md }}>
            <Text variant="headline">Not sure if something’s normal?</Text>
            <Text variant="footnote" tone="muted" style={{ marginTop: 2 }}>
              When to talk to a healthcare professional
            </Text>
          </View>
          <ArrowCircle bg={colors.primary} fg={colors.onPrimary} />
        </View>
      </GradientCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { flexBasis: '46%', flexGrow: 1, minHeight: 150 },
  tileIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  tileFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
