import type { Sentence, CEFRLevel, SentenceReviewDataStore } from '../../types/sentences';
import type { ListeningOrdering, ListeningQueueItem } from '../../types/listening';
import getOrCreateSentenceCardReviewData from '../storage/getOrCreateSentenceCardReviewData';
import isFsrsCardLearned from './isFsrsCardLearned';
import orderListeningPool from './orderListeningPool';

export interface BuildSentenceListeningQueueArgs {
  sentences: Sentence[];
  reviewStore: SentenceReviewDataStore;
  ordering: ListeningOrdering;
  levels?: CEFRLevel[];
  limit?: number;
}

export default function buildSentenceListeningQueue({
  sentences,
  reviewStore,
  ordering,
  levels,
  limit,
}: BuildSentenceListeningQueueArgs): ListeningQueueItem[] {
  const filtered = sentences.filter((s) => {
    if (!s.audioUrl) return false;
    if (levels && levels.length > 0 && !levels.includes(s.level)) return false;
    return true;
  });

  const pool = orderListeningPool(
    filtered.map((sentence) => ({
      item: sentence,
      reviewData: getOrCreateSentenceCardReviewData(sentence.id, reviewStore),
    })),
    ordering,
    limit
  );

  return pool.map(({ item: sentence, reviewData }) => ({
    id: `sentence:${sentence.id}`,
    feature: 'sentences',
    audioUrl: sentence.audioUrl!,
    primaryText: sentence.polish,
    secondaryText: sentence.english,
    isLearned: isFsrsCardLearned(reviewData.fsrsCard),
  }));
}
