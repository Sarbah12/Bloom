import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { supabase } from './client';

/**
 * Native "Sign in with Apple" and "Sign in with Google".
 *
 * Both run the provider's own sheet on the phone, get an OpenID ID token and
 * hand it to Supabase (signInWithIdToken). No browser, no redirect URL.
 * Each returns false when the person cancels, so callers can stay quiet.
 */

const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/** Google needs the web client ID: it's the audience Supabase checks. */
export const googleConfigured = !!supabase && !!googleWebClientId && (Platform.OS !== 'ios' || !!googleIosClientId);

let googleReady = false;
function configureGoogle() {
  if (googleReady) return;
  GoogleSignin.configure({ iosClientId: googleIosClientId, webClientId: googleWebClientId });
  googleReady = true;
}

/** Sign in with Apple exists only on Apple platforms (iOS 13+). */
export async function appleAvailable(): Promise<boolean> {
  if (!supabase || Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

function requireClient() {
  if (!supabase) throw new Error('Cloud backup is not configured in this build.');
  return supabase;
}

export async function signInWithApple(): Promise<boolean> {
  const client = requireClient();
  // Apple puts the SHA-256 of the nonce in the token; Supabase checks it
  // against the raw value, so a stolen token can't be replayed.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw e;
  }
  if (!credential.identityToken) throw new Error('Apple didn’t return a sign-in token. Please try again.');

  const { error } = await client.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;

  // Apple shares the name only on the very first sign-in; keep it.
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
  if (name) await client.auth.updateUser({ data: { full_name: name } });
  return true;
}

export async function signInWithGoogle(): Promise<boolean> {
  const client = requireClient();
  configureGoogle();
  try {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    if (result.type === 'cancelled') return false;
    const token = result.data.idToken;
    if (!token) throw new Error('Google didn’t return a sign-in token. Please try again.');
    const { error } = await client.auth.signInWithIdToken({ provider: 'google', token });
    if (error) throw error;
    return true;
  } catch (e) {
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) {
      return false;
    }
    throw e;
  }
}

/** Forgets the Google account choice too, so the next sign-in asks again. */
export async function signOutSocial(): Promise<void> {
  if (!googleConfigured) return;
  configureGoogle();
  await GoogleSignin.signOut().catch(() => {});
}
