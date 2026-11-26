/**
 * Stand-in for `firebase/auth`, for AuthProvider's listener. Install with
 *
 *   vi.mock('firebase/auth', () => import('./support/fakeAuth'));
 *
 * The listener reports whoever `signInFakeUser()` put in `auth.currentUser`,
 * as a non-admin, the way the SDK reports a restored session.
 */
import { auth } from '../../../fakes/firebase';

type Listener = (user: unknown) => void | Promise<void>;

export function onAuthStateChanged(_auth: unknown, listener: Listener) {
  const current = auth.currentUser;
  const user = current && {
    ...current,
    getIdTokenResult: async () => ({ claims: {} }),
  };
  queueMicrotask(() => void listener(user));
  return () => {};
}

export async function signInWithPopup(): Promise<never> {
  throw new Error('Sign-in popups are not available in UI tests');
}

export async function signInWithCustomToken(): Promise<never> {
  throw new Error('Custom-token sign-in is not available in UI tests');
}

export async function signOut(): Promise<void> {
  auth.currentUser = null;
}

export class GoogleAuthProvider {}
export const getAuth = () => auth;
