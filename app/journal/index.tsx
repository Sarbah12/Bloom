import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useData } from '@/lib/data/store';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/theme/theme';

export default function Journal() {
  const { data } = useData();
  const { space } = useTheme();
  const entries = data.journal
    .filter((j) => !j.deletedAt)
    .sort((a, b) => (a.date === b.date ? b.updatedAt.localeCompare(a.updatedAt) : b.date.localeCompare(a.date)));

  return (
    <Screen
      nav="back"
      title="Journal"
      subtitle="Private notes, encrypted on this phone."
      testID="journal"
      footer={<Button label="New entry" icon="plus" size="lg" fullWidth onPress={() => router.push('/journal/new')} />}
    >
      {entries.length === 0 ? (
        <EmptyState
          icon="book"
          title="Nothing here yet"
          body="Write about anything — how you're feeling, questions for your doctor, what helped this month."
        />
      ) : (
        <View style={{ gap: space.md }}>
          {entries.map((e) => (
            <Card
              key={e.id}
              onPress={() => router.push(`/journal/${e.id}`)}
              accessibilityLabel={`${e.title || 'Untitled'}, ${formatDate(e.date, 'long')}`}
            >
              <Text variant="eyebrow" tone="muted">
                {formatDate(e.date, 'weekday')}
              </Text>
              <Text variant="title3" style={{ marginTop: space.xs }}>
                {e.title || 'Untitled'}
              </Text>
              {e.body ? (
                <Text variant="callout" tone="muted" numberOfLines={2} style={{ marginTop: space.xs }}>
                  {e.body}
                </Text>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
