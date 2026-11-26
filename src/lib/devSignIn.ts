import { signInWithCustomToken, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { clearUserData } from './offlineDb/userSync';

/**
 * Development only: opening the app with `?devSignIn` signs in as the shared,
 * non-admin test user, using a token from the dev server's
 * `/__dev/sign-in-token` endpoint (`scripts/lib/devSignInPlugin.ts`).
 */

const URL_PARAM = 'devSignIn';
const TEST_USER_UID = 'dev-test-user';

export async function devSignInFromUrl(): Promise<void> {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(URL_PARAM)) return;
  url.searchParams.delete(URL_PARAM);
  window.history.replaceState(window.history.state, '', url);

  await auth.authStateReady();
  if (auth.currentUser?.uid === TEST_USER_UID) return;

  const response = await fetch('/__dev/sign-in-token', { method: 'POST' });
  if (!response.ok) {
    console.error(`Dev sign-in failed (${response.status}): ${await response.text()}`);
    return;
  }
  const { token } = (await response.json()) as { token: string };

  // Switching accounts: drop the previous user's offline data, as a normal sign-out does.
  if (auth.currentUser) {
    await signOut(auth);
    await clearUserData();
  }
  await signInWithCustomToken(auth, token);
}
