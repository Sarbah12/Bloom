import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Notice } from '@/components/ui/Feedback';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useData } from '@/lib/data/store';
import { vaultIsDeviceSecure } from '@/lib/storage/vault';
import { useTheme } from '@/theme/theme';

const PROMISES = [
  {
    icon: 'smartphone',
    title: 'On this phone first',
    body: 'Everything you log is stored on this phone, encrypted (AES-256-GCM) with a key held in its secure keychain and never included in phone backups.',
  },
  {
    icon: 'cloud-off',
    title: 'Cloud only if you ask',
    body: 'Backup is off until you create an account and turn it on. Backed-up data is encrypted in transit and at rest, and only your account can read it.',
  },
  {
    icon: 'eye-off',
    title: 'No ads, no data sales',
    body: 'Bloom has no advertising, no third-party trackers, and never sells or shares your health information.',
  },
  {
    icon: 'bell-off',
    title: 'Discreet by default',
    body: 'Notifications never mention periods or fertility on the lock screen unless you choose detailed reminders.',
  },
  {
    icon: 'download',
    title: 'Yours to take or delete',
    body: 'Export everything as a file, or delete it all — on this phone and in the cloud — from Profile.',
  },
] as const;

export default function Privacy() {
  const { data } = useData();
  const { colors, space } = useTheme();

  return (
    <Screen
      nav="back"
      title="Privacy"
      subtitle="Menstrual and reproductive health records are deeply personal. Here's how Bloom protects yours."
      testID="privacy"
    >
      {!vaultIsDeviceSecure ? (
        <View style={{ marginBottom: space.xl }}>
          <Notice tone="care" title="Browser preview">
            In this browser preview, data sits in local storage without the protection the mobile apps give it.
          </Notice>
        </View>
      ) : null}
      <View style={{ gap: space.xl, marginBottom: space.xxl }}>
        {PROMISES.map((p) => (
          <View key={p.title} style={{ flexDirection: 'row', gap: space.lg }}>
            <Feather name={p.icon} size={20} color={colors.primary} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text variant="headline">{p.title}</Text>
              <Text variant="callout" tone="muted" style={{ marginTop: 2 }}>
                {p.body}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <ListGroup title="Your permissions">
        <ListRow
          icon="cloud"
          title="Cloud backup"
          value={data.consents.cloudBackup ? 'On' : 'Off'}
          onPress={() => router.push('/account')}
        />
        <ListRow
          icon="message-circle"
          title="AI assistant"
          value="Not available yet"
          subtitle="When it arrives, it will ask before reading anything."
        />
        <ListRow icon="bar-chart-2" title="Usage analytics" value="None collected" last />
      </ListGroup>
    </Screen>
  );
}
