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

const AUTH_TIMEOUT_MS = 5000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const authResolved = useRef(false);

  useEffect(() => {
    console.log('[Auth] Setting up onAuthStateChanged listener');

    // Timeout fallback - if auth doesn't resolve in time, proceed without user
    const timeout = setTimeout(() => {
      if (!authResolved.current) {
        console.warn('[Auth] Timeout waiting for auth state - proceeding without user');
        setLoading(false);
      }
    }, AUTH_TIMEOUT_MS);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      authResolved.current = true;
      clearTimeout(timeout);
      console.log('[Auth] onAuthStateChanged fired, user:', user?.email ?? 'null');
      console.log('[Auth] navigator.onLine:', navigator.onLine);
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
          console.log('[Auth] Offline - skipping token');
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      console.log('[Auth] Setting loading to false');
      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
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
