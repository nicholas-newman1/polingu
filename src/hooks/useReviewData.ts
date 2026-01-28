import { useContext } from 'react';
import {
  DeclensionContext,
  VocabularyContext,
  SentenceContext,
  ConjugationContext,
  ReviewCountsContext,
  type DeclensionContextType,
  type VocabularyContextType,
  type SentenceContextType,
  type ConjugationContextType,
  type ReviewCountsContextType,
} from '../contexts/review';

export function useDeclension(): DeclensionContextType {
  const context = useContext(DeclensionContext);
  if (!context) {
    throw new Error('useDeclension must be used within a ReviewDataProvider');
  }
  return context;
}

export function useVocabulary(): VocabularyContextType {
  const context = useContext(VocabularyContext);
  if (!context) {
    throw new Error('useVocabulary must be used within a ReviewDataProvider');
  }
  return context;
}

export function useSentences(): SentenceContextType {
  const context = useContext(SentenceContext);
  if (!context) {
    throw new Error('useSentences must be used within a ReviewDataProvider');
  }
  return context;
}

export function useConjugation(): ConjugationContextType {
  const context = useContext(ConjugationContext);
  if (!context) {
    throw new Error('useConjugation must be used within a ReviewDataProvider');
  }
  return context;
}

export function useReviewCounts(): ReviewCountsContextType {
  const context = useContext(ReviewCountsContext);
  if (!context) {
    throw new Error('useReviewCounts must be used within a ReviewDataProvider');
  }
  return context;
}

export interface ReviewDataContextType
  extends DeclensionContextType,
    VocabularyContextType,
    SentenceContextType,
    ConjugationContextType {
  loading: boolean;
  counts: ReviewCountsContextType['counts'];
}

export function useReviewData(): ReviewDataContextType {
  const declension = useDeclension();
  const vocabulary = useVocabulary();
  const sentences = useSentences();
  const conjugation = useConjugation();
  const { counts, loading } = useReviewCounts();

  return {
    ...declension,
    ...vocabulary,
    ...sentences,
    ...conjugation,
    loading,
    counts,
  };
}
