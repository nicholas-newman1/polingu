import { getApps, initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

if (getApps().length === 0) {
  initializeApp();
}

setGlobalOptions({ maxInstances: 10 });

export const db = getFirestore();
export const storage = getStorage();
