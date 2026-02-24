import { createContext, useEffect, useState, type ReactNode } from 'react';
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | null>(null);

const CACHED_USER_KEY = 'polingu_cached_user';

interface CachedUser {
  uid: string;
  email: string | null;
}

function getCachedUser(): CachedUser | null {
  try {
    const cached = localStorage.getItem(CACHED_USER_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function setCachedUser(user: User | null) {
  try {
    if (user) {
      localStorage.setItem(CACHED_USER_KEY, JSON.stringify({ uid: user.uid, email: user.email }));
    } else {
      localStorage.removeItem(CACHED_USER_KEY);
    }
  } catch {
    // localStorage might be unavailable
  }
}

function getInitialState(): { user: User | null; loading: boolean } {
  const cached = getCachedUser();
  if (cached) {
    console.log('[Auth] Using cached user:', cached.email);
    return {
      user: { uid: cached.uid, email: cached.email } as User,
      loading: false,
    };
  }
  return { user: null, loading: true };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = getInitialState();
  const [user, setUser] = useState<User | null>(initial.user);
  const [loading, setLoading] = useState(initial.loading);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    console.log('[Auth] Setting up auth listener');

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[Auth] onAuthStateChanged fired, user:', firebaseUser?.email ?? 'null');

      // Cache the user for future offline use
      setCachedUser(firebaseUser);

      // Update with the real Firebase user
      setUser(firebaseUser);

      if (firebaseUser) {
        if (navigator.onLine) {
          console.log('[Auth] Online - getting token...');
          try {
            const idTokenResult = await firebaseUser.getIdTokenResult();
            console.log('[Auth] Got token result');
            setIsAdmin(!!idTokenResult.claims.admin);
          } catch (e) {
            console.warn('[Auth] Token error:', e);
            setIsAdmin(false);
          }
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
