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

async function resolveUser(
  user: User | null,
  setUser: (u: User | null) => void,
  setIsAdmin: (a: boolean) => void
) {
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
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const authResolved = useRef(false);

  useEffect(() => {
    console.log('[Auth] Setting up auth resolution');

    // Poll auth.currentUser - Firebase often loads from IndexedDB before callback fires
    const pollInterval = setInterval(() => {
      if (!authResolved.current && auth.currentUser) {
        console.log('[Auth] Found user via polling:', auth.currentUser.email);
        authResolved.current = true;
        clearInterval(pollInterval);
        resolveUser(auth.currentUser, setUser, setIsAdmin).then(() => setLoading(false));
      }
    }, 100);

    // Stop polling after 3s regardless
    const pollTimeout = setTimeout(() => clearInterval(pollInterval), 3000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (authResolved.current) {
        // Already resolved via polling, but still update if user changed
        console.log(
          '[Auth] onAuthStateChanged fired (already resolved), user:',
          user?.email ?? 'null'
        );
        await resolveUser(user, setUser, setIsAdmin);
        return;
      }
      authResolved.current = true;
      clearInterval(pollInterval);
      clearTimeout(pollTimeout);
      console.log('[Auth] onAuthStateChanged fired, user:', user?.email ?? 'null');
      console.log('[Auth] navigator.onLine:', navigator.onLine);
      await resolveUser(user, setUser, setIsAdmin);
      console.log('[Auth] Setting loading to false');
      setLoading(false);
    });

    return () => {
      clearInterval(pollInterval);
      clearTimeout(pollTimeout);
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
