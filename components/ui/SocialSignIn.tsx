import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { appleAvailable, googleConfigured } from '@/lib/supabase/social';
import { useTheme } from '@/theme/theme';

import { Text } from './Text';

const HEIGHT = 56;

interface Props {
  busy: boolean;
  onApple: () => void;
  onGoogle: () => void;
}

/**
 * "Sign in with Apple" and "Sign in with Google", shown above the email form.
 * Apple's button is Apple's own control (required by its guidelines); Google's
 * follows Google's branding rules: the four-colour G on a plain button.
 */
export function SocialSignIn({ busy, onApple, onGoogle }: Props) {
  const { colors, radii, scheme, space } = useTheme();
  const [apple, setApple] = useState(false);

  useEffect(() => {
    appleAvailable().then(setApple, () => setApple(false));
  }, []);

  if (!apple && !googleConfigured) return null;

  return (
    <View style={{ gap: space.md, marginBottom: space.xl }}>
      {apple ? (
        <View pointerEvents={busy ? 'none' : 'auto'} style={{ opacity: busy ? 0.5 : 1 }}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              scheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={HEIGHT / 2}
            style={{ height: HEIGHT, width: '100%' }}
            onPress={onApple}
          />
        </View>
      ) : null}
      {googleConfigured ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onGoogle}
          style={({ pressed }) => [
            styles.google,
            {
              borderRadius: radii.pill,
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
              borderColor: colors.borderStrong,
              opacity: busy ? 0.5 : 1,
            },
          ]}
        >
          <GoogleG />
          <Text variant="headline" style={{ marginLeft: space.md }}>
            Continue with Google
          </Text>
        </Pressable>
      ) : null}
      <View style={styles.dividerRow}>
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
        <Text variant="footnote" tone="muted" style={{ marginHorizontal: space.md }}>
          or use email
        </Text>
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
      </View>
    </View>
  );
}

function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  google: {
    height: HEIGHT,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : null),
  },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
});
