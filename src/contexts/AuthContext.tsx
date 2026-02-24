import { createContext, useEffect, useState, useRef, type ReactNode } from 'react';
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

function getInitialState(): { user: User | null; loading: boolean; resolved: boolean } {
  if (!navigator.onLine) {
    const cached = getCachedUser();
    if (cached) {
      console.log('[Auth] Offline - using cached user:', cached.email);
      return {
        user: { uid: cached.uid, email: cached.email } as User,
        loading: false,
        resolved: true,
      };
    }
  }
  return { user: null, loading: true, resolved: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = getInitialState();
  const [user, setUser] = useState<User | null>(initial.user);
  const [loading, setLoading] = useState(initial.loading);
  const [isAdmin, setIsAdmin] = useState(false);
  const authResolved = useRef(initial.resolved);

  useEffect(() => {
    console.log('[Auth] Setting up auth listener, online:', navigator.onLine);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[Auth] onAuthStateChanged fired, user:', user?.email ?? 'null');

      // Cache the user for offline use
      setCachedUser(user);

      // If we already resolved with cached user and this matches, skip
      if (authResolved.current && !navigator.onLine) {
        console.log('[Auth] Already resolved offline, skipping update');
        return;
      }

      authResolved.current = true;
      setUser(user);

      if (user) {
        if (navigator.onLine) {
          console.log('[Auth] Online - getting token...');
          try {
            const idTokenResult = await user.getIdTokenResult();
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

      console.log('[Auth] Setting loading to false');
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
