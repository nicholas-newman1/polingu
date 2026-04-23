import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/https';

export type KillSwitchFlag = 'translate' | 'audio' | 'books';

interface KillSwitchDoc {
  translateDisabled?: boolean;
  audioDisabled?: boolean;
  booksDisabled?: boolean;
  reason?: string;
  updatedAt?: number;
}

const CACHE_TTL_MS = 30_000;

let cache: { data: KillSwitchDoc; expiresAt: number } | null = null;

async function loadKillSwitch(): Promise<KillSwitchDoc> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.data;

  try {
    const snap = await getFirestore().collection('config').doc('killSwitch').get();
    const data = (snap.data() as KillSwitchDoc | undefined) ?? {};
    cache = { data, expiresAt: now + CACHE_TTL_MS };
    return data;
  } catch (error) {
    console.warn('Failed to load kill switch; fail-open:', error);
    cache = { data: {}, expiresAt: now + CACHE_TTL_MS };
    return cache.data;
  }
}

function isDisabled(doc: KillSwitchDoc, flag: KillSwitchFlag): boolean {
  switch (flag) {
    case 'translate':
      return !!doc.translateDisabled;
    case 'audio':
      return !!doc.audioDisabled;
    case 'books':
      return !!doc.booksDisabled;
  }
}

export async function assertNotKilled(flag: KillSwitchFlag): Promise<void> {
  const doc = await loadKillSwitch();
  if (isDisabled(doc, flag)) {
    throw new HttpsError(
      'unavailable',
      'This service is temporarily unavailable while we investigate a cost spike. Please try again later.'
    );
  }
}

export async function isKilled(flag: KillSwitchFlag): Promise<boolean> {
  const doc = await loadKillSwitch();
  return isDisabled(doc, flag);
}
