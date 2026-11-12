import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';

import { Segmented } from '@/components/ui/Controls';
import { Notice } from '@/components/ui/Feedback';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { supportsWidget } from '@/lib/widget';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { PRIVACY_POLICY_URL, SUPPORT_URL } from '@/lib/content/links';
import { MEDICAL_DISCLAIMER } from '@/lib/content/phases';
import { useData } from '@/lib/data/store';
import { useRestore } from '@/lib/data/useRestore';
import { shareExport } from '@/lib/export-file';
import { confirm, notify } from '@/lib/platform';
import { biometricsAvailable, confirmIdentity } from '@/lib/security/AppLock';
import { vaultIsDeviceSecure } from '@/lib/storage/vault';
import { deleteCloudAccount, useSession } from '@/lib/supabase/auth';
import { cloudConfigured } from '@/lib/supabase/client';
import { useTheme } from '@/theme/theme';

export default function Profile() {
  const { data, actions } = useData();
  const { space } = useTheme();
  const { session } = useSession();
  const [canLock, setCanLock] = useState(false);
  const prefs = data.preferences;

  useEffect(() => {
    biometricsAvailable().then(setCanLock);
  }, []);

  const toggleLock = async (next: boolean) => {
    if (next && !(await confirmIdentity('Turn on App Lock'))) return;
    actions.updatePreferences({ appLock: next });
  };

  const exportData = async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const shared = await shareExport(`bloom-export-${stamp}.json`, actions.exportJSON());
    if (!shared) notify('Export unavailable', 'Sharing isn’t available on this device.');
  };

  const restoreBackup = useRestore();
  const restore = async () => {
    if (await restoreBackup()) notify('Backup restored', 'Your periods, check-ins and journal are back.');
  };

  const eraseAll = async () => {
    const cloud = session ? ' and your cloud backup account' : '';
    const ok = await confirm(
      'Delete all your data?',
      `This permanently deletes every period, check-in and journal entry on this phone${cloud}. It cannot be undone. Consider exporting first.`,
      'Delete everything',
      true,
    );
    if (!ok) return;
    try {
      if (session) await deleteCloudAccount();
      await actions.eraseEverything();
      router.replace('/onboarding');
    } catch (e) {
      notify(
        'Couldn’t delete your cloud account',
        `${e instanceof Error ? e.message : String(e)}\n\nNothing on this phone was deleted. Check your connection and try again.`,
      );
    }
  };

  const reminderCount = [
    data.reminders.periodSoon.enabled,
    data.reminders.dailyCheckIn.enabled,
    data.reminders.fertileWindow.enabled,
  ].filter(Boolean).length;

  return (
    <Screen
      withTabBar
      title={data.profile.name ? data.profile.name : 'Profile'}
      subtitle="Your settings, privacy and data."
      testID="profile"
    >
      <ListGroup title="Tracking">
        <ListRow
          icon="sliders"
          title="Cycle settings"
          value={`${data.cycle.typicalCycleLength} / ${data.cycle.typicalPeriodLength} days`}
          onPress={() => router.push('/settings/cycle')}
        />
        <ListRow
          icon="book"
          title="Private journal"
          value={String(data.journal.filter((j) => !j.deletedAt).length)}
          onPress={() => router.push('/journal')}
        />
        <ListRow
          icon="package"
          title="Medications"
          value={String(data.medications.filter((m) => !m.deletedAt).length)}
          onPress={() => router.push('/medications')}
          testID="profile-medications"
        />
        <ListRow
          icon="file-text"
          title="Doctor visit report"
          subtitle="A PDF summary to share at an appointment"
          onPress={() => router.push('/report')}
          testID="profile-report"
        />
        <ListRow
          icon="bell"
          title="Reminders"
          value={reminderCount ? `${reminderCount} on` : 'Off'}
          onPress={() => router.push('/settings/reminders')}
        />
        <ListRow
          icon="sun"
          title="Show fertility estimates"
          subtitle="Fertile window and ovulation in the calendar and insights"
          toggle={{ value: prefs.showFertility, onChange: (v) => actions.updatePreferences({ showFertility: v }) }}
          last
        />
      </ListGroup>

      <ListGroup title="Privacy & security">
        {canLock ? (
          <ListRow
            icon="lock"
            title="App Lock"
            subtitle="Require Face ID, fingerprint or passcode to open Bloom"
            toggle={{ value: prefs.appLock, onChange: toggleLock }}
          />
        ) : null}
        {supportsWidget ? (
          <ListRow
            icon="grid"
            title="Detailed home screen widget"
            subtitle={
              prefs.widgetDetailed
                ? 'The widget says “Period in 5 days”'
                : 'Off: the widget shows only numbers, like “Day 14 · 14 days to go”'
            }
            toggle={{ value: prefs.widgetDetailed, onChange: (widgetDetailed) => actions.updatePreferences({ widgetDetailed }) }}
            testID="widget-detail"
          />
        ) : null}
        <ListRow icon="shield" title="Privacy & permissions" onPress={() => router.push('/settings/privacy')} />
        <ListRow
          icon="cloud"
          title="Account & backup"
          value={!cloudConfigured ? 'Unavailable' : session ? (data.consents.cloudBackup ? 'Backing up' : 'Signed in') : 'Off'}
          onPress={() => router.push('/account')}
          last
        />
      </ListGroup>

      <ListGroup title="Display">
        <View style={{ padding: space.lg, gap: space.md }}>
          <Text variant="headline">Appearance</Text>
          <Segmented
            label="Appearance"
            options={[
              { value: 'system', label: 'Automatic' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={prefs.appearance}
            onChange={(appearance) => actions.updatePreferences({ appearance })}
          />
          <Text variant="headline" style={{ marginTop: space.sm }}>
            Week starts on
          </Text>
          <Segmented
            label="Week starts on"
            options={[
              { value: 1, label: 'Monday' },
              { value: 0, label: 'Sunday' },
            ]}
            value={prefs.weekStartsOn}
            onChange={(weekStartsOn) => actions.updatePreferences({ weekStartsOn })}
          />
          <Text variant="headline" style={{ marginTop: space.sm }}>
            Units
          </Text>
          <Segmented
            label="Units for weight and temperature"
            options={[
              { value: 'metric', label: 'kg · °C' },
              { value: 'imperial', label: 'lb · °F' },
            ]}
            value={prefs.units}
            onChange={(units) => actions.updatePreferences({ units })}
          />
        </View>
      </ListGroup>

      <ListGroup title="Your data">
        <ListRow icon="download" title="Export my data" subtitle="Save everything you've logged as a backup file" onPress={exportData} />
        <ListRow icon="upload" title="Restore from a backup" subtitle="Bring your history to this phone" onPress={restore} />
        <ListRow icon="trash-2" title="Delete all my data" destructive onPress={eraseAll} last />
      </ListGroup>

      {!vaultIsDeviceSecure ? (
        <View style={{ marginBottom: space.xxl }}>
          <Notice tone="care" title="Browser preview">
            This preview stores data in the browser without device-level protection. Use the iOS or Android app for real records.
          </Notice>
        </View>
      ) : null}

      <ListGroup title="About">
        <ListRow icon="info" title="About Bloom" subtitle={MEDICAL_DISCLAIMER} />
        <ListRow icon="shield" title="Privacy policy" onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} testID="privacy-policy-link" />
        <ListRow icon="help-circle" title="Help & support" onPress={() => Linking.openURL(SUPPORT_URL)} />
        {__DEV__ ? (
          <ListRow
            icon="layout"
            title="Design system"
            subtitle="Tokens and components (development builds only)"
            onPress={() => router.push('/design')}
          />
        ) : null}
        <ListRow
          icon="smartphone"
          title="Version"
          value={`0.1.0 · ${Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web'}`}
          last
        />
      </ListGroup>
    </Screen>
  );
}
