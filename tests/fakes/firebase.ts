/**
 * Stand-in for src/lib/firebase.ts, installed for every unit test by
 * tests/setup/unit.ts. The real module connects to the production project as
 * soon as it is imported, which tests must never do.
 *
 * The handles below are inert. Code that passes them to the real Firebase SDK
 * (doc(db, ...), getDoc, httpsCallable(functions, ...), ...) fails, so a test
 * that exercises storage or callable code must also mock the `firebase/*` SDK
 * functions that code uses, with vi.mock('firebase/firestore', ...) and so on.
 */
import type { User } from 'firebase/auth';

const inert = <T extends string>(kind: T) => ({ __fake: kind }) as const;

export const app = inert('app');
export const db = inert('firestore');
export const storage = inert('storage');
export const functions = inert('functions');
export const googleProvider = inert('googleProvider');

/** Only `currentUser` is modelled. Use signInFakeUser / signOutFakeUser. */
export const auth: { currentUser: Pick<User, 'uid' | 'email' | 'displayName'> | null } = {
  currentUser: null,
};

export function signInFakeUser(uid = 'test-user', email: string | null = 'test@example.com') {
  auth.currentUser = { uid, email, displayName: 'Test User' };
  return auth.currentUser;
}

export function signOutFakeUser() {
  auth.currentUser = null;
}
