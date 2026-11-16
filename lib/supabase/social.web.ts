/** The browser preview has no native Apple or Google sign-in. */
export const googleConfigured = false;

export async function appleAvailable(): Promise<boolean> {
  return false;
}

export async function signInWithApple(): Promise<boolean> {
  return false;
}

export async function signInWithGoogle(): Promise<boolean> {
  return false;
}

export async function signOutSocial(): Promise<void> {}
