import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { EmptyState, Notice } from '@/components/ui/Feedback';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { medicationKind } from '@/lib/data/catalog';
import { activeMeds } from '@/lib/data/meds';
import { useData } from '@/lib/data/store';
import { formatTime } from '@/lib/format';
import { useTheme } from '@/theme/theme';

/** Medications and supplements, with optional daily reminders. */
export default function Medications() {
  const { data } = useData();
  const { space } = useTheme();
  const meds = activeMeds(data.medications);

  return (
    <Screen
      nav="back"
      title="Medications"
      subtitle="Tick them off in your check-in and get a gentle reminder."
      testID="medications"
      footer={
        <Button
          label="Add a medication"
          icon="plus"
          size="lg"
          fullWidth
          onPress={() => router.push('/medications/new')}
          testID="add-medication"
        />
      }
    >
      {meds.length ? (
        <ListGroup>
          {meds.map((m, i) => (
            <ListRow
              key={m.id}
              icon={medicationKind(m.kind).icon}
              title={m.name}
              subtitle={[m.dose, m.reminder.enabled ? `Reminder at ${formatTime(m.reminder.hour, m.reminder.minute)}` : 'No reminder']
                .filter(Boolean)
                .join(' · ')}
              onPress={() => router.push(`/medications/${m.id}`)}
              last={i === meds.length - 1}
            />
          ))}
        </ListGroup>
      ) : (
        <EmptyState
          icon="package"
          title="No medications yet"
          body="Add the pill, pain relief, iron or anything else you take. You can tick it off each day and include it in your doctor visit report."
        />
      )}
      <View style={{ marginTop: space.xl }}>
        <Notice tone="privacy">
          Medication names are encrypted on this phone. Reminders say only “A gentle reminder from Bloom” while Discreet notifications is
          on.
        </Notice>
      </View>
    </Screen>
  );
}
