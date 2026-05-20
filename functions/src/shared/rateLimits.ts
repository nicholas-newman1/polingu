import { HttpsError } from 'firebase-functions/https';
import { db } from './firebase.js';

const MAX_REQUESTS_PER_MINUTE = 120;
const MAX_CHARS_PER_DAY = 1500;

interface RateLimitDoc {
  dailyCharsUsed: number;
  dailyCharsDate: string;
  recentRequests: number[];
}

export function getUTCDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export function getNextMidnightUTC(): string {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
  );
  return tomorrow.toISOString();
}

function filterRecentRequests(recentRequests: number[]): number[] {
  const oneMinuteAgo = Date.now() - 60000;
  return recentRequests.filter((ts) => ts > oneMinuteAgo);
}

export async function reserveTranslationBudget(
  userId: string,
  charCount: number,
  isAdmin: boolean,
  resetTime: string
): Promise<{ charsUsedAfter: number }> {
  const ref = db.collection('userRateLimits').doc(userId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const today = getUTCDateString();
    const data = snap.exists ? (snap.data() as RateLimitDoc | undefined) : undefined;

    const dailyCharsUsed = !data || data.dailyCharsDate !== today ? 0 : data.dailyCharsUsed || 0;
    const recentRequests = filterRecentRequests(data?.recentRequests || []);

    if (!isAdmin) {
      if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
        throw new HttpsError('resource-exhausted', 'RATE_LIMIT_MINUTE');
      }
      if (dailyCharsUsed + charCount > MAX_CHARS_PER_DAY) {
        throw new HttpsError('resource-exhausted', `RATE_LIMIT_DAILY:${resetTime}`);
      }
    }

    const charsUsedAfter = dailyCharsUsed + charCount;
    tx.set(ref, {
      dailyCharsUsed: charsUsedAfter,
      dailyCharsDate: today,
      recentRequests: [...recentRequests, Date.now()],
    } satisfies RateLimitDoc);

    return { charsUsedAfter };
  });
}

export function cleanTextForCacheKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9ąćęłńóśźż ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

export function cacheKeyAppearsInSource(cacheKey: string, sourceText: string): boolean {
  if (!cacheKey || !sourceText) return false;
  const cleanedSource = cleanTextForCacheKey(sourceText);
  if (!cleanedSource) return false;
  return ` ${cleanedSource} `.includes(` ${cacheKey} `);
}
