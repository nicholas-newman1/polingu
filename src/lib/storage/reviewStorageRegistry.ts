import type { ReviewSubcollectionSync } from './createReviewSubcollectionStorage';
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

async function forEachStorage(
  label: string,
  run: (storage: ReviewSubcollectionSync) => Promise<void>
): Promise<void> {
  await Promise.all(
    ALL_REVIEW_STORAGES.map(async (storage) => {
      try {
        await run(storage);
      } catch (e) {
        console.error(`${label} failed for a review collection:`, e);
      }
    })
  );
}

export async function refreshAllReviewCardsFromFirestore(): Promise<void> {
  await forEachStorage('Review card refresh', (storage) => storage.refreshFromFirestore());
}

export async function syncAllPendingReviewCards(): Promise<void> {
  await forEachStorage('Pending review card sync', (storage) => storage.syncPendingCards());
}
