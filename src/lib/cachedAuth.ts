import { auth } from './firebase';
import type { User } from 'firebase/auth';

const CACHED_USER_KEY = 'polingu_cached_user';

export interface CachedUser {
  uid: string;
  email: string | null;
}

export function getCachedUser(): CachedUser | null {
  try {
    const cached = localStorage.getItem(CACHED_USER_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user: User | null): void {
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

export function getCurrentUserId(): string | null {
  // Try Firebase auth first
  if (auth.currentUser?.uid) {
    return auth.currentUser.uid;
  }
  // Fall back to cached user for offline mode
  return getCachedUser()?.uid ?? null;
}

const DATA_OWNER_KEY = 'polingu_data_owner';

/**
 * The account whose data is cached in IndexedDB. The cache is not keyed by user,
 * so when a different account signs in, the previous account's data has to be
 * cleared first. This outlives the cached user: Firebase can end a session by
 * itself (revoked or expired token) without the app's sign-out running.
 */
export function getDataOwner(): string | null {
  try {
    return localStorage.getItem(DATA_OWNER_KEY);
  } catch {
    return null;
  }
}

export function setDataOwner(uid: string | null): void {
  try {
    if (uid) localStorage.setItem(DATA_OWNER_KEY, uid);
    else localStorage.removeItem(DATA_OWNER_KEY);
  } catch {
    // localStorage might be unavailable
  }
}
