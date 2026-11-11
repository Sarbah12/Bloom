import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';

import { supabase } from './client';

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

function requireClient() {
  if (!supabase) throw new Error('Cloud backup is not configured in this build.');
  return supabase;
}

/** Friendly messages for the errors people actually hit. */
export function describeAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match an account.';
  if (/already registered|already exists/i.test(message)) return 'An account with this email already exists. Try signing in.';
  if (/email not confirmed/i.test(message)) return 'Please confirm your email first — check your inbox for a link.';
  if (/password/i.test(message) && /(short|least|weak)/i.test(message)) return 'Choose a longer password — at least 10 characters.';
  if (/network|fetch/i.test(message)) return 'Couldn’t reach the server. Check your connection and try again.';
  return message;
}

export const MIN_PASSWORD = 10;

export async function signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await requireClient().auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: Linking.createURL('/account') },
  });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await requireClient().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await requireClient().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: Linking.createURL('/account/reset'),
  });
  if (error) throw error;
}

/** Completes a reset link: swaps its one-time code for a session. */
export async function exchangeResetCode(code: string): Promise<void> {
  const { error } = await requireClient().auth.exchangeCodeForSession(code);
  if (error) throw error;
}

export async function setNewPassword(password: string): Promise<void> {
  const { error } = await requireClient().auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/** Deletes the account and every row of cloud data (see delete_my_account). */
export async function deleteCloudAccount(): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc('delete_my_account');
  if (error) throw error;
  await client.auth.signOut({ scope: 'local' });
}
