import type { VocabularyWord, VocabularyReviewDataStore } from '../../types/vocabulary';
import type { ListeningOrdering, ListeningQueueItem } from '../../types/listening';
import getOrCreateVocabularyCardReviewData from '../storage/getOrCreateVocabularyCardReviewData';
import isDue from '../fsrsUtils/isDue';
import shuffleArray from '../utils/shuffleArray';
import isFsrsCardLearned from './isFsrsCardLearned';

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

  const withMeta = filtered.map((word) => {
    const reviewData = getOrCreateVocabularyCardReviewData(word.id, reviewStore);
    return { word, reviewData };
  });

  let pool: typeof withMeta;
  switch (ordering) {
    case 'due':
      pool = withMeta.filter(
        (c) => c.reviewData.fsrsCard.state !== 0 && isDue(c.reviewData.fsrsCard)
      );
      pool.sort(
        (a, b) =>
          new Date(a.reviewData.fsrsCard.due).getTime() -
          new Date(b.reviewData.fsrsCard.due).getTime()
      );
      break;
    case 'practice-ahead':
      pool = withMeta.filter(
        (c) => c.reviewData.fsrsCard.state !== 0 && !isDue(c.reviewData.fsrsCard)
      );
      pool.sort(
        (a, b) =>
          new Date(a.reviewData.fsrsCard.due).getTime() -
          new Date(b.reviewData.fsrsCard.due).getTime()
      );
      break;
    case 'learned':
      pool = withMeta.filter((c) => isFsrsCardLearned(c.reviewData.fsrsCard));
      pool = shuffleArray(pool);
      break;
    case 'recently-added': {
      const custom = withMeta.filter((c) => c.word.isCustom);
      const system = withMeta.filter((c) => !c.word.isCustom);
      custom.sort((a, b) => {
        const aCreated = ((a.word as { createdAt?: number }).createdAt as number | undefined) ?? 0;
        const bCreated = ((b.word as { createdAt?: number }).createdAt as number | undefined) ?? 0;
        return bCreated - aCreated;
      });
      system.reverse();
      pool = [...custom, ...system];
      break;
    }
    case 'random':
    default:
      pool = shuffleArray(withMeta);
      break;
  }

  const sliced = typeof limit === 'number' ? pool.slice(0, limit) : pool;

  return sliced.map(({ word, reviewData }) => ({
    id: `vocabulary:${word.id}`,
    feature: 'vocabulary',
    audioUrl: word.audioUrl!,
    primaryText: word.polish,
    secondaryText: word.english,
    isLearned: isFsrsCardLearned(reviewData.fsrsCard),
  }));
}
