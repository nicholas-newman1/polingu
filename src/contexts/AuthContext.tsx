import { createContext, useEffect, useState, type ReactNode } from 'react';
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { getCachedUser, setCachedUser } from '../lib/cachedAuth';
import { clearUserData } from '../lib/offlineDb/userSync';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | null>(null);

function getInitialState(): { user: User | null; loading: boolean } {
  const cached = getCachedUser();
  if (cached) {
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setCachedUser(firebaseUser);
      setUser(firebaseUser);

      if (firebaseUser) {
        if (navigator.onLine) {
          try {
            const idTokenResult = await firebaseUser.getIdTokenResult();
            setIsAdmin(!!idTokenResult.claims.admin);
          } catch {
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
    await clearUserData();
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
