import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';

import { EmptyState, Notice } from '@/components/ui/Feedback';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { articleBySlug } from '@/lib/content/articles';
import { MEDICAL_DISCLAIMER } from '@/lib/content/phases';
import { useTheme } from '@/theme/theme';

export default function ArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors, space } = useTheme();
  const article = articleBySlug(String(slug));

  if (!article) {
    return (
      <Screen nav="back">
        <EmptyState icon="book" title="Article not found" body="It may have moved. Head back to Learn to browse." />
      </Screen>
    );
  }

  return (
    <Screen
      nav="back"
      eyebrow={`${article.category} · ${article.minutes} min read`}
      title={article.title}
      subtitle={article.summary}
      testID="article"
    >
      {article.sections.map((s, i) => (
        <View key={i} style={{ marginBottom: space.xl }}>
          {s.heading ? (
            <Text variant="title3" heading style={{ marginBottom: space.sm }}>
              {s.heading}
            </Text>
          ) : null}
          {s.paragraphs?.map((p, j) => (
            <Text key={j} variant="body" style={{ marginBottom: space.md }}>
              {p}
            </Text>
          ))}
          {s.bullets?.map((b, j) => (
            <View key={j} style={{ flexDirection: 'row', marginBottom: space.sm }}>
              <Text variant="body" tone="primary" style={{ width: 20 }} accessibilityElementsHidden importantForAccessibility="no">
                •
              </Text>
              <Text variant="body" style={{ flex: 1 }}>
                {b}
              </Text>
            </View>
          ))}
        </View>
      ))}

      <Notice tone="info">{MEDICAL_DISCLAIMER}</Notice>

      <Text variant="eyebrow" tone="muted" style={{ marginTop: space.xxl, marginBottom: space.sm }} heading>
        Sources
      </Text>
      {article.sources.map((src) => (
        <Pressable
          key={src.url}
          accessibilityRole="link"
          accessibilityLabel={`${src.label}, opens in your browser`}
          onPress={() => Linking.openURL(src.url)}
          style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}
        >
          <Feather name="external-link" size={15} color={colors.primary} style={{ marginRight: space.sm }} />
          <Text variant="callout" tone="primary" style={{ flex: 1 }}>
            {src.label}
          </Text>
        </Pressable>
      ))}
      <Text variant="footnote" tone="muted" style={{ marginTop: space.lg }}>
        {article.review.status === 'reviewed'
          ? `Clinically reviewed by ${article.review.by} on ${article.review.on}.`
          : 'Written from the guidance above. Independent clinical review pending.'}
      </Text>
    </Screen>
  );
}
