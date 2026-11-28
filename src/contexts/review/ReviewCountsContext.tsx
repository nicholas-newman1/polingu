import { createContext, useMemo, type ReactNode, useContext } from 'react';
import { getUserId } from '../../lib/storage/helpers';
import { getDrillableFormsForVerb } from '../../lib/conjugationUtils';
import { countDueToday } from '../../lib/reviewSession/scheduler';
import {
  aspectPairsDeck,
  conjugationDeck,
  declensionDeck,
  sentenceDeck,
  vocabularyDeck,
} from '../../lib/reviewSession/reviewDecks';
import type { TranslationDirection } from '../../types/common';
import { DeclensionContext } from './DeclensionContext';
import { VocabularyContext } from './VocabularyContext';
import { SentenceContext } from './SentenceContext';
import { ConjugationContext } from './ConjugationContext';
import { AspectPairsContext } from './AspectPairsContext';
import { useSessionFilters } from './sessionFilters';

export interface ReviewCounts {
  declension: number;
  vocabulary: number;
  sentences: number;
  conjugation: number;
  aspectPairs: number;
}

export interface ReviewCountsContextType {
  counts: ReviewCounts;
  loading: boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ReviewCountsContext = createContext<ReviewCountsContextType | null>(null);

const DIRECTIONS: TranslationDirection[] = ['pl-to-en', 'en-to-pl'];
const sumDirections = (count: (direction: TranslationDirection) => number) =>
  DIRECTIONS.reduce((sum, direction) => sum + count(direction), 0);

interface ReviewCountsProviderProps {
  children: ReactNode;
  loading: boolean;
}

export function ReviewCountsProvider({ children, loading }: ReviewCountsProviderProps) {
  const declensionCtx = useContext(DeclensionContext);
  const vocabularyCtx = useContext(VocabularyContext);
  const sentenceCtx = useContext(SentenceContext);
  const conjugationCtx = useContext(ConjugationContext);
  const aspectPairsCtx = useContext(AspectPairsContext);
  const filters = useSessionFilters();

  const counts = useMemo<ReviewCounts>(() => {
    const userId = getUserId();
    if (
      !userId ||
      !declensionCtx ||
      !vocabularyCtx ||
      !sentenceCtx ||
      !conjugationCtx ||
      !aspectPairsCtx
    ) {
      return { declension: 0, vocabulary: 0, sentences: 0, conjugation: 0, aspectPairs: 0 };
    }

    const forms = conjugationCtx.verbs.flatMap(getDrillableFormsForVerb);

    return {
      declension: countDueToday(
        declensionDeck,
        declensionCtx.declensionCards,
        declensionCtx.declensionReviewStore,
        declensionCtx.declensionSettings,
        filters.declension
      ),
      vocabulary: sumDirections((d) =>
        countDueToday(
          vocabularyDeck,
          vocabularyCtx.vocabularyWords,
          vocabularyCtx.vocabularyReviewStores[d],
          vocabularyCtx.vocabularySettings[d]
        )
      ),
      sentences: sumDirections((d) => {
        const settings = sentenceCtx.sentenceSettings[d];
        return countDueToday(
          sentenceDeck,
          sentenceCtx.sentences.filter((s) => settings.selectedLevels.includes(s.level)),
          sentenceCtx.sentenceReviewStores[d],
          settings
        );
      }),
      conjugation: sumDirections((d) =>
        countDueToday(
          conjugationDeck,
          forms,
          conjugationCtx.conjugationReviewStores[d],
          conjugationCtx.conjugationSettings[d],
          filters.conjugation
        )
      ),
      aspectPairs: countDueToday(
        aspectPairsDeck,
        aspectPairsCtx.aspectPairCards,
        aspectPairsCtx.aspectPairsReviewStore,
        aspectPairsCtx.aspectPairsSettings
      ),
    };
  }, [declensionCtx, vocabularyCtx, sentenceCtx, conjugationCtx, aspectPairsCtx, filters]);

  const value = useMemo(() => ({ counts, loading }), [counts, loading]);

  return <ReviewCountsContext.Provider value={value}>{children}</ReviewCountsContext.Provider>;
}
