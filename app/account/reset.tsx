import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Controls';
import { Notice } from '@/components/ui/Feedback';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { describeAuthError, exchangeResetCode, MIN_PASSWORD, setNewPassword } from '@/lib/supabase/auth';
import { useTheme } from '@/theme/theme';

/** Opened from the password-reset email (bloom://account/reset?code=…). */
export default function ResetPassword() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { space } = useTheme();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError('This reset link is incomplete. Request a new one from the sign-in screen.');
      return;
    }
    exchangeResetCode(String(code)).then(
      () => setReady(true),
      (e) => setError(describeAuthError(e)),
    );
  }, [code]);

  const save = async () => {
    setBusy(true);
    try {
      await setNewPassword(password);
      router.replace('/account');
    } catch (e) {
      setError(describeAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen nav="close" navTitle="New password">
      <Text variant="title1" heading style={{ marginTop: space.sm, marginBottom: space.xl }}>
        Choose a new password
      </Text>
      {error ? (
        <View style={{ marginBottom: space.lg }}>
          <Notice tone="care">{error}</Notice>
        </View>
      ) : null}
      <TextField
        label="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint={`At least ${MIN_PASSWORD} characters.`}
        editable={ready}
      />
      <Button label="Save password" size="lg" fullWidth loading={busy} disabled={!ready || password.length < MIN_PASSWORD} onPress={save} />
    </Screen>
  );
}
