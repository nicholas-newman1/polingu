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

export function getCurrentUser(): User | CachedUser | null {
  // Try Firebase auth first
  if (auth.currentUser) {
    return auth.currentUser;
  }
  // Fall back to cached user for offline mode
  return getCachedUser();
}
