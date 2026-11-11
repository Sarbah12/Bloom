import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Segmented, TextField } from '@/components/ui/Controls';
import { EmptyState, Notice } from '@/components/ui/Feedback';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useData } from '@/lib/data/store';
import { formatDate } from '@/lib/format';
import { confirm, notify } from '@/lib/platform';
import { describeAuthError, MIN_PASSWORD, sendPasswordReset, signIn, signOut, signUp } from '@/lib/supabase/auth';
import { cloudConfigured } from '@/lib/supabase/client';
import { recordConsent } from '@/lib/supabase/sync';
import { useCloudSync } from '@/lib/supabase/useCloudSync';
import { useTheme } from '@/theme/theme';

type Mode = 'sign-in' | 'sign-up' | 'reset';

export default function Account() {
  const { session, status, error, run, lastSyncedAt } = useCloudSync();
  const { data, actions } = useData();
  const { space } = useTheme();

  if (!cloudConfigured) {
    return (
      <Screen nav="close" navTitle="Account & backup">
        <EmptyState
          icon="cloud-off"
          title="Backup isn't set up in this build"
          body="Bloom works fully on this phone without an account. Cloud backup will be available once the service is connected."
        />
      </Screen>
    );
  }

  if (!session) return <AuthForm />;

  const toggleBackup = async (next: boolean) => {
    if (next) {
      const ok = await confirm(
        'Back up to your account?',
        'Your periods, check-ins, journal and settings will be copied to Bloom’s secure servers so you can restore them on a new phone. Only your account can read them, and you can turn this off or delete the backup at any time.',
        'Turn on backup',
      );
      if (!ok) return;
    }
    try {
      await recordConsent('cloud_backup', next);
      actions.updateConsents({ cloudBackup: next });
    } catch (e) {
      notify('Couldn’t update backup', describeAuthError(e));
    }
  };

  return (
    <Screen nav="close" navTitle="Account & backup" testID="account">
      <Text variant="title1" heading style={{ marginTop: space.sm }}>
        Your account
      </Text>
      <Text variant="callout" tone="muted" style={{ marginTop: space.xs, marginBottom: space.xl }}>
        Signed in as {session.user.email}
      </Text>

      <ListGroup title="Backup">
        <ListRow
          icon="cloud"
          title="Back up to my account"
          subtitle="Restore your history on a new phone"
          toggle={{ value: data.consents.cloudBackup, onChange: toggleBackup }}
          last={!data.consents.cloudBackup}
        />
        {data.consents.cloudBackup ? (
          <ListRow
            icon="refresh-cw"
            title={status === 'syncing' ? 'Backing up…' : 'Back up now'}
            subtitle={
              lastSyncedAt
                ? `Last backed up ${formatDate(lastSyncedAt.slice(0, 10))}, ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Not backed up yet'
            }
            onPress={status === 'syncing' ? undefined : run}
            last
          />
        ) : null}
      </ListGroup>
      {status === 'error' && error ? (
        <View style={{ marginBottom: space.xl }}>
          <Notice tone="care" title="Backup didn’t finish">
            {error}
          </Notice>
        </View>
      ) : null}

      <Button label="Sign out" variant="secondary" fullWidth onPress={() => signOut()} />
      <Text variant="footnote" tone="muted" align="center" style={{ marginTop: space.md }}>
        Signing out keeps everything on this phone. To delete your account and backup, use Delete all my data in Profile.
      </Text>
    </Screen>
  );
}

function AuthForm() {
  const { space } = useTheme();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'care'; text: string } | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = mode === 'reset' || password.length >= (mode === 'sign-up' ? MIN_PASSWORD : 1);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'sign-in') await signIn(email, password);
      else if (mode === 'sign-up') {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) setMessage({ tone: 'info', text: 'Check your inbox to confirm your email, then sign in.' });
      } else {
        await sendPasswordReset(email);
        setMessage({ tone: 'info', text: 'If an account exists for that email, a reset link is on its way.' });
      }
    } catch (e) {
      setMessage({ tone: 'care', text: describeAuthError(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen nav="close" navTitle="Account & backup" testID="auth">
      <Text variant="title1" heading style={{ marginTop: space.sm }}>
        {mode === 'reset' ? 'Reset your password' : 'Back up your history'}
      </Text>
      <Text variant="callout" tone="muted" style={{ marginTop: space.xs, marginBottom: space.xl }}>
        An account is optional. It lets you restore your data on a new phone. Nothing is uploaded until you turn backup on.
      </Text>
      {mode !== 'reset' ? (
        <View style={{ marginBottom: space.xl }}>
          <Segmented<Mode>
            label="Account"
            options={[
              { value: 'sign-in', label: 'Sign in' },
              { value: 'sign-up', label: 'Create account' },
            ]}
            value={mode}
            onChange={(m) => {
              setMode(m);
              setMessage(null);
            }}
          />
        </View>
      ) : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="you@example.com"
      />
      {mode !== 'reset' ? (
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
          textContentType={mode === 'sign-up' ? 'newPassword' : 'password'}
          hint={mode === 'sign-up' ? `At least ${MIN_PASSWORD} characters.` : undefined}
        />
      ) : null}
      {message ? (
        <View style={{ marginBottom: space.lg }}>
          <Notice tone={message.tone}>{message.text}</Notice>
        </View>
      ) : null}
      <Button
        label={mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Send reset link'}
        size="lg"
        fullWidth
        loading={busy}
        disabled={!emailValid || !passwordValid}
        onPress={submit}
      />
      <View style={{ marginTop: space.md }}>
        <Button
          label={mode === 'reset' ? 'Back to sign in' : 'Forgot password?'}
          variant="ghost"
          fullWidth
          onPress={() => {
            setMode(mode === 'reset' ? 'sign-in' : 'reset');
            setMessage(null);
          }}
        />
      </View>
    </Screen>
  );
}
