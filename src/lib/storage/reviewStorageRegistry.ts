import type { ReviewSubcollectionSync } from './createReviewSubcollectionStorage';
import { getUserId } from './helpers';
import { declensionReviewStorage } from './declensionReviewStorage';
import { aspectPairsReviewStorage } from './aspectPairsReviewStorage';
import { sentenceReviewStorage } from './sentenceReviewStorage';
import { vocabularyReviewStorage } from './vocabularyReviewStorage';
import { conjugationReviewStorage } from './conjugationReviewStorage';

const ALL_REVIEW_STORAGES: ReviewSubcollectionSync[] = [
  declensionReviewStorage,
  aspectPairsReviewStorage,
  sentenceReviewStorage('pl-to-en'),
  sentenceReviewStorage('en-to-pl'),
  vocabularyReviewStorage('pl-to-en'),
  vocabularyReviewStorage('en-to-pl'),
  conjugationReviewStorage('pl-to-en'),
  conjugationReviewStorage('en-to-pl'),
];

/**
 * A refresh reads every card document in all eight collections straight from the
 * server, so it is throttled: the background sync runs on every window focus and
 * visibility change, and pulling on each one would be needlessly expensive.
 */
const REFRESH_MIN_INTERVAL_MS = 60_000;
let lastRefresh: { userId: string; at: number } | null = null;

/** Returns how many collections succeeded, so a total failure is distinguishable. */
async function forEachStorage(
  label: string,
  run: (storage: ReviewSubcollectionSync) => Promise<void>
): Promise<number> {
  const results = await Promise.all(
    ALL_REVIEW_STORAGES.map(async (storage) => {
      try {
        await run(storage);
        return true;
      } catch (e) {
        console.error(`${label} failed for a review collection:`, e);
        return false;
      }
    })
  );
  return results.filter(Boolean).length;
}

export async function refreshAllReviewCardsFromFirestore(): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  const throttled =
    lastRefresh?.userId === userId && Date.now() - lastRefresh.at < REFRESH_MIN_INTERVAL_MS;
  if (throttled) return;

  const succeeded = await forEachStorage('Review card refresh', (storage) =>
    storage.refreshFromFirestore()
  );

  // Leave the throttle open when the server was unreachable so the next focus retries.
  if (succeeded > 0) lastRefresh = { userId, at: Date.now() };
}

export async function syncAllPendingReviewCards(): Promise<void> {
  await forEachStorage('Pending review card sync', (storage) => storage.syncPendingCards());
}
