/**
 * Minimal stand-ins for the app's context providers. They supply the real context
 * objects with fixed values, so hooks under test run without AuthProvider's
 * Firebase listener.
 */
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import type { User } from 'firebase/auth';
import { AuthContext } from '../../../src/contexts/AuthContext';
import { SnackbarContext, type SnackbarContextType } from '../../../src/contexts/SnackbarContext';

type Children = { children: ReactNode };

/** Supplies SnackbarContext and records every snackbar shown. */
export function withSnackbar() {
  const showSnackbar = vi.fn<SnackbarContextType['showSnackbar']>();
  const value: SnackbarContextType = { snackbar: null, showSnackbar, hideSnackbar: vi.fn() };
  const wrapper = ({ children }: Children) => (
    <SnackbarContext.Provider value={value}>{children}</SnackbarContext.Provider>
  );
  return { wrapper, showSnackbar };
}

export const fakeUser = (uid: string) => ({ uid, email: `${uid}@example.com` }) as User;

/**
 * Supplies AuthContext. Change the signed-in user with `signInAs` / `signOut`,
 * then call the render result's `rerender()` so consumers see it. User objects
 * are created once per uid, so their identity is stable like AuthProvider's state.
 */
export function withAuth(initialUid: string | null) {
  const users = new Map<string, User>();
  const userFor = (uid: string) => {
    if (!users.has(uid)) users.set(uid, fakeUser(uid));
    return users.get(uid)!;
  };
  const state = { user: initialUid ? userFor(initialUid) : null };

  const wrapper = ({ children }: Children) => (
    <AuthContext.Provider
      value={{
        user: state.user,
        loading: false,
        isAdmin: false,
        signInWithGoogle: async () => {},
        signOut: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );

  return {
    wrapper,
    signInAs: (uid: string) => {
      state.user = userFor(uid);
    },
    signOut: () => {
      state.user = null;
    },
  };
}
