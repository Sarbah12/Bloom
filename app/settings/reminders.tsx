import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Controls';
import { Notice } from '@/components/ui/Feedback';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { useData } from '@/lib/data/store';
import type { Reminders } from '@/lib/data/types';
import { requestReminderPermission, supportsReminders } from '@/lib/notifications';
import { notify } from '@/lib/platform';
import { useTheme } from '@/theme/theme';

const EVENING = [18, 19, 20, 21].map((hour) => {
  let label = `${hour}:00`;
  try {
    label = new Date(2026, 0, 1, hour).toLocaleTimeString([], { hour: 'numeric' });
  } catch {
    // keep the plain label
  }
  return { value: hour, label };
});

/** Shown in the phone's own clock style (8 AM or 08:00). Includes the 20:00 default. */
const TIMES = [8, 12, 18, 20].map((hour) => {
  let label = `${hour}:00`;
  try {
    label = new Date(2026, 0, 1, hour).toLocaleTimeString([], { hour: 'numeric', minute: hour % 1 ? '2-digit' : undefined });
  } catch {
    // keep the plain label
  }
  return { value: hour, label };
});

export default function RemindersScreen() {
  const { data, actions } = useData();
  const { space } = useTheme();
  const r = data.reminders;
  const periodCare = r.periodCare ?? { enabled: false, hour: 19 };
  const periodDue = r.periodDue ?? { enabled: false };
  const nothingOn = !r.periodSoon.enabled && !periodDue.enabled && !periodCare.enabled && !r.dailyCheckIn.enabled;

  const turnOnRecommended = () =>
    enable(
      { periodSoon: { ...r.periodSoon, enabled: true }, periodDue: { enabled: true }, periodCare: { ...periodCare, enabled: true } },
      true,
    );

  const enable = async (patch: Partial<Reminders>, turningOn: boolean) => {
    if (turningOn && !(await requestReminderPermission())) {
      notify('Notifications are off', 'Allow notifications for Bloom in your phone’s Settings to get reminders.');
      return;
    }
    actions.updateReminders(patch);
  };

  return (
    <Screen nav="back" title="Reminders" subtitle="Gentle nudges, scheduled on this phone." testID="reminders">
      {!supportsReminders ? (
        <View style={{ marginBottom: space.xl }}>
          <Notice tone="info">Reminders work in the iOS and Android apps, not in the browser preview.</Notice>
        </View>
      ) : null}

      {nothingOn && supportsReminders ? (
        <View style={{ marginBottom: space.xl }}>
          <Notice
            tone="info"
            title="Let Bloom keep track for you"
            action={<Button label="Turn on period reminders" onPress={turnOnRecommended} testID="reminders-recommended" />}
          >
            A heads-up before your period, a nudge on the day it’s due, and a gentle check-in while it lasts. Discreet on the lock
            screen unless you change it below.
          </Notice>
        </View>
      ) : null}

      <ListGroup title="Period">
        <ListRow
          icon="droplet"
          title="Period coming up"
          subtitle="A heads-up before your estimated start"
          toggle={{
            value: r.periodSoon.enabled,
            disabled: !supportsReminders,
            onChange: (v) => enable({ periodSoon: { ...r.periodSoon, enabled: v } }, v),
          }}
        />
        {r.periodSoon.enabled ? (
          <View style={{ padding: space.lg }}>
            <Segmented<1 | 2 | 3>
              label="Days before"
              options={[
                { value: 1, label: '1 day before' },
                { value: 2, label: '2 days' },
                { value: 3, label: '3 days' },
              ]}
              value={r.periodSoon.daysBefore}
              onChange={(daysBefore) => actions.updateReminders({ periodSoon: { ...r.periodSoon, daysBefore } })}
            />
          </View>
        ) : null}
        <ListRow
          icon="sunrise"
          title="On the day it’s due"
          subtitle="Tap “It started” from the notification. If it hasn’t been logged three days later, Bloom asks again."
          toggle={{
            value: periodDue.enabled,
            disabled: !supportsReminders,
            onChange: (v) => enable({ periodDue: { enabled: v } }, v),
          }}
          testID="reminder-period-due"
        />
        <ListRow
          icon="heart"
          title="During your period"
          subtitle={
            r.dailyCheckIn.enabled
              ? 'Asks whether it has ended. Your daily check-in covers the evenings.'
              : 'An evening “how are you feeling?” on each period day, and whether it has ended'
          }
          toggle={{
            value: periodCare.enabled,
            disabled: !supportsReminders,
            onChange: (v) => enable({ periodCare: { ...periodCare, enabled: v } }, v),
          }}
          last={!periodCare.enabled}
          testID="reminder-period-care"
        />
        {periodCare.enabled ? (
          <View style={{ padding: space.lg }}>
            <Segmented
              label="Evening time"
              options={EVENING}
              value={periodCare.hour}
              onChange={(hour) => actions.updateReminders({ periodCare: { ...periodCare, hour } })}
            />
          </View>
        ) : null}
      </ListGroup>

      <ListGroup title="Daily check-in">
        <ListRow
          icon="edit-3"
          title="Daily check-in"
          subtitle="A reminder to log how you feel"
          toggle={{
            value: r.dailyCheckIn.enabled,
            disabled: !supportsReminders,
            onChange: (v) => enable({ dailyCheckIn: { ...r.dailyCheckIn, enabled: v } }, v),
          }}
          last={!r.dailyCheckIn.enabled}
        />
        {r.dailyCheckIn.enabled ? (
          <View style={{ padding: space.lg }}>
            <Segmented
              label="Reminder time"
              options={TIMES}
              value={r.dailyCheckIn.hour}
              onChange={(hour) => actions.updateReminders({ dailyCheckIn: { ...r.dailyCheckIn, hour, minute: 0 } })}
            />
          </View>
        ) : null}
      </ListGroup>

      {data.preferences.showFertility ? (
        <ListGroup title="Fertility">
          <ListRow
            icon="sun"
            title="Fertile window"
            subtitle="The day before your estimated fertile window. Not contraception."
            toggle={{
              value: r.fertileWindow.enabled,
              disabled: !supportsReminders,
              onChange: (v) => enable({ fertileWindow: { enabled: v } }, v),
            }}
            last
          />
        </ListGroup>
      ) : null}

      <ListGroup title="Privacy">
        <ListRow
          icon="eye-off"
          title="Discreet notifications"
          subtitle={
            r.discreet
              ? 'Lock screen shows “A gentle reminder from Bloom”, and the app icon’s menu shows only “Check in”'
              : 'Lock screen may mention your period, fertile window or medication names, and the app icon’s menu offers “Period started”'
          }
          toggle={{ value: r.discreet, onChange: (v) => actions.updateReminders({ discreet: v }) }}
          last
        />
      </ListGroup>
    </Screen>
  );
}
