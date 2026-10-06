import type { VocabularyWord, VocabularyReviewDataStore } from '../../types/vocabulary';
import type { ListeningOrdering, ListeningQueueItem } from '../../types/listening';
import getOrCreateVocabularyCardReviewData from '../storage/getOrCreateVocabularyCardReviewData';
import isFsrsCardLearned from './isFsrsCardLearned';
import orderListeningPool from './orderListeningPool';

export interface BuildVocabularyListeningQueueArgs {
  words: VocabularyWord[];
  reviewStore: VocabularyReviewDataStore;
  ordering: ListeningOrdering;
  limit?: number;
}

export default function buildVocabularyListeningQueue({
  words,
  reviewStore,
  ordering,
  limit,
}: BuildVocabularyListeningQueueArgs): ListeningQueueItem[] {
  const filtered = words.filter((w) => !!w.audioUrl);

  const pool = orderListeningPool(
    filtered.map((word) => ({
      item: word,
      reviewData: getOrCreateVocabularyCardReviewData(word.id, reviewStore),
    })),
    ordering,
    limit
  );

  return pool.map(({ item: word, reviewData }) => ({
    id: `vocabulary:${word.id}`,
    feature: 'vocabulary',
    audioUrl: word.audioUrl!,
    primaryText: word.polish,
    secondaryText: word.english,
    isLearned: isFsrsCardLearned(reviewData.fsrsCard),
  }));
}
