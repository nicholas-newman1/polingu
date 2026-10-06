import { userDb } from './userDb';

/**
 * Clear all user data from IndexedDB (for logout or reset)
 */
export async function clearUserData(): Promise<void> {
  await userDb.userData.clear();
  await userDb.customCards.clear();
  await userDb.reviewCards.clear();
}
