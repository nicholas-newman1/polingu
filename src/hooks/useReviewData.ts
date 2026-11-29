import { useContext, type Context } from 'react';
import {
  DeclensionContext,
  VocabularyContext,
  SentenceContext,
  ConjugationContext,
  AspectPairsContext,
  ReviewDataLoadingContext,
  type DeclensionContextType,
  type VocabularyContextType,
  type SentenceContextType,
  type ConjugationContextType,
  type AspectPairsContextType,
} from '../contexts/review';

function useProvided<T>(context: Context<T | null>, hookName: string): T {
  const value = useContext(context);
  if (value === null) {
    throw new Error(`${hookName} must be used within a ReviewDataProvider`);
  }
  return value;
}

export function useDeclension(): DeclensionContextType {
  return useProvided(DeclensionContext, 'useDeclension');
}

export function useVocabulary(): VocabularyContextType {
  return useProvided(VocabularyContext, 'useVocabulary');
}

export function useSentences(): SentenceContextType {
  return useProvided(SentenceContext, 'useSentences');
}

export function useConjugation(): ConjugationContextType {
  return useProvided(ConjugationContext, 'useConjugation');
}

export function useAspectPairs(): AspectPairsContextType {
  return useProvided(AspectPairsContext, 'useAspectPairs');
}

/** Whether the review data is still loading, so pages show a spinner rather than empty decks. */
export function useReviewDataLoading(): boolean {
  return useProvided(ReviewDataLoadingContext, 'useReviewDataLoading');
}
