import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useData } from '@/lib/data/store';
import { useToday } from '@/lib/data/today';
import { formatDate } from '@/lib/format';
import { confirm } from '@/lib/platform';
import { useTheme } from '@/theme/theme';

/** A quiet writing page: a title and the entry, nothing that looks like a form. */
export default function JournalEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, actions } = useData();
  const { colors, space, type } = useTheme();
  const today = useToday();
  const existing = data.journal.find((j) => j.id === id && !j.deletedAt);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const savedId = useRef<string | undefined>(existing?.id);
  const date = existing?.date ?? today;
  const empty = !title.trim() && !body.trim();

  const save = () => {
    if (empty) return;
    savedId.current = actions.saveJournal({ id: savedId.current, title: title.trim(), body, date });
  };

  const remove = async () => {
    if (!savedId.current) return router.back();
    if (await confirm('Delete this entry?', 'It will be removed from this phone and your backup.', 'Delete', true)) {
      actions.deleteJournal(savedId.current);
      router.back();
    }
  };

  return (
    <Screen
      nav="back"
      navTitle={existing ? 'Journal entry' : 'New entry'}
      navRight={
        existing ? (
          <Pressable onPress={remove} accessibilityRole="button" accessibilityLabel="Delete entry" hitSlop={8}>
            <Feather name="trash-2" size={20} color={colors.danger} />
          </Pressable>
        ) : null
      }
      footer={
        <Button
          label="Save"
          size="lg"
          fullWidth
          disabled={empty}
          onPress={() => {
            save();
            router.back();
          }}
        />
      }
    >
      <View style={[styles.dateRow, { marginTop: space.lg, marginBottom: space.md, gap: space.xs }]}>
        <Feather name="lock" size={13} color={colors.inkMuted} />
        <Text variant="caption" tone="muted">
          {formatDate(date, 'long')} · Private and encrypted
        </Text>
      </View>
      <Card>
        <TextInput
          value={title}
          onChangeText={setTitle}
          onBlur={save}
          placeholder="Title"
          placeholderTextColor={colors.inkSubtle}
          accessibilityLabel="Title"
          maxLength={200}
          returnKeyType="next"
          maxFontSizeMultiplier={1.35}
          style={[type.title2, { color: colors.ink, paddingVertical: space.xs }]}
        />
        <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: space.md }]} />
        <TextInput
          value={body}
          onChangeText={setBody}
          onBlur={save}
          placeholder="Write freely. Only you can read this."
          placeholderTextColor={colors.inkSubtle}
          accessibilityLabel="Entry"
          multiline
          maxLength={20000}
          maxFontSizeMultiplier={1.7}
          style={[type.body, { color: colors.ink, minHeight: 280, textAlignVertical: 'top' }]}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  divider: { height: StyleSheet.hairlineWidth },
});
