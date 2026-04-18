import type { Sentence, CEFRLevel, SentenceReviewDataStore } from '../../types/sentences';
import type { ListeningOrdering, ListeningQueueItem } from '../../types/listening';
import getOrCreateSentenceCardReviewData from '../storage/getOrCreateSentenceCardReviewData';
import isDue from '../fsrsUtils/isDue';
import shuffleArray from '../utils/shuffleArray';
import isFsrsCardLearned from './isFsrsCardLearned';

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

  const withMeta = filtered.map((sentence) => {
    const reviewData = getOrCreateSentenceCardReviewData(sentence.id, reviewStore);
    return { sentence, reviewData };
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
      const custom = withMeta.filter((c) => c.sentence.isCustom);
      const system = withMeta.filter((c) => !c.sentence.isCustom);
      custom.sort((a, b) => {
        const aCreated = (a.sentence.createdAt as number | undefined) ?? 0;
        const bCreated = (b.sentence.createdAt as number | undefined) ?? 0;
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

  return sliced.map(({ sentence, reviewData }) => ({
    id: `sentence:${sentence.id}`,
    feature: 'sentences',
    audioUrl: sentence.audioUrl!,
    primaryText: sentence.polish,
    secondaryText: sentence.english,
    isLearned: isFsrsCardLearned(reviewData.fsrsCard),
  }));
}
