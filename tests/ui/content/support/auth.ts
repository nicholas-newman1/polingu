/**
 * Stand-in for `firebase/auth`, driving the app's real AuthProvider.
 *
 *   vi.mock('firebase/auth', () => import('./support/auth'));
 *
 * `accounts.signIn({ uid, admin })` before rendering makes Firebase report that
 * account on start-up; `accounts.popupAccount` is who "Sign in with Google" signs in,
 * and `accounts.popupError` makes that sign-in fail instead.
 * The shared fake `auth.currentUser` (tests/fakes/firebase.ts) follows along, so
 * the storage code sees the same user.
 */
import { signInFakeUser, signOutFakeUser } from '../../../fakes/firebase';

export interface Account {
  uid: string;
  email?: string;
  displayName?: string;
  admin?: boolean;
}

export interface FakeUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }>;
}

type Listener = (user: FakeUser | null) => void;

function toUser(account: Account): FakeUser {
  return {
    uid: account.uid,
    email: account.email ?? `${account.uid}@example.com`,
    displayName: account.displayName ?? null,
    getIdTokenResult: async () => ({ claims: account.admin ? { admin: true } : {} }),
  };
}

class Accounts {
  current: FakeUser | null = null;
  popupAccount: Account | null = null;
  /** Why "Sign in with Google" fails, if it should (blocked popup, network down). */
  popupError: Error | null = null;
  /** How many times the Google sign-in popup was opened. */
  popupCalls = 0;
  /** Firebase has not reported a user yet while true (the app shows its start-up spinner). */
  pending = false;
  private listeners = new Set<Listener>();

  signIn(account: Account) {
    this.current = toUser(account);
    signInFakeUser(account.uid, this.current.email);
    this.notify();
  }

  signOut() {
    this.current = null;
    signOutFakeUser();
    this.notify();
  }

  /** Report the current user to listeners (what Firebase does after start-up). */
  resolve() {
    this.pending = false;
    this.notify();
  }

  listen(listener: Listener) {
    this.listeners.add(listener);
    if (!this.pending) queueMicrotask(() => listener(this.current));
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    if (this.pending) return;
    for (const listener of this.listeners) listener(this.current);
  }

  reset() {
    this.current = null;
    this.popupAccount = null;
    this.popupError = null;
    this.popupCalls = 0;
    this.pending = false;
    this.listeners.clear();
  }
}

export const accounts = new Accounts();

export function getAuth() {
  return { __fake: 'auth' };
}

export class GoogleAuthProvider {}

export function onAuthStateChanged(_auth: unknown, listener: Listener) {
  return accounts.listen(listener);
}

export async function signInWithPopup() {
  accounts.popupCalls++;
  if (accounts.popupError) throw accounts.popupError;
  if (!accounts.popupAccount) throw new Error('auth/popup-closed-by-user');
  accounts.signIn(accounts.popupAccount);
}

export async function signOut() {
  accounts.signOut();
}

export async function signInWithCustomToken() {
  throw new Error('signInWithCustomToken is not available in tests');
}
