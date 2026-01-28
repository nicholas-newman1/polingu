import type { Sentence, SentenceCardReviewData } from '../../types/sentences';

export interface SentenceSessionCard {
  sentence: Sentence;
  reviewData: SentenceCardReviewData;
  isNew: boolean;
}
