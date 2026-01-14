import type {
  VocabularyWord,
  VocabularyCardReviewData,
} from '../../types/vocabulary';

export interface VocabularySessionCard {
  word: VocabularyWord;
  reviewData: VocabularyCardReviewData;
  isNew: boolean;
}

