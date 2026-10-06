import { createContext, useMemo, type ReactNode, useContext } from 'react';
import type { DeclensionCard, DeclensionReviewDataStore, DeclensionSettings } from '../../types';
import type {
  VocabularyWord,
  VocabularyReviewDataStore,
  VocabularyDirectionSettings,
} from '../../types/vocabulary';
import type {
  Sentence,
  SentenceReviewDataStore,
  SentenceDirectionSettings,
} from '../../types/sentences';
import type {
  Verb,
  ConjugationReviewDataStore,
  ConjugationDirectionSettings,
} from '../../types/conjugation';
import type {
  AspectPairCard,
  AspectPairsReviewDataStore,
  AspectPairsSettings,
} from '../../types/aspectPairs';
import getReviewBucket from '../../lib/fsrsUtils/getReviewBucket';
import countDueCards from '../../lib/fsrsUtils/countDueCards';
import getOrCreateDeclensionCardReviewData from '../../lib/storage/getOrCreateDeclensionCardReviewData';
import getOrCreateVocabularyCardReviewData from '../../lib/storage/getOrCreateVocabularyCardReviewData';
import getOrCreateSentenceCardReviewData from '../../lib/storage/getOrCreateSentenceCardReviewData';
import getOrCreateConjugationFormReviewData from '../../lib/storage/getOrCreateConjugationFormReviewData';
import getOrCreateAspectPairsCardReviewData from '../../lib/storage/getOrCreateAspectPairsCardReviewData';
import {
  getUserId,
  includesDeclensionCardId,
  includesSentenceId,
  includesFormKey,
  includesVerbId,
  includesWordId,
} from '../../lib/storage/helpers';
import { getDrillableFormsForVerb } from '../../lib/conjugationUtils';
import { DeclensionContext } from './DeclensionContext';
import { VocabularyContext } from './VocabularyContext';
import { SentenceContext } from './SentenceContext';
import { ConjugationContext } from './ConjugationContext';
import { AspectPairsContext } from './AspectPairsContext';

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

function computeDeclensionDueCount(
  cards: DeclensionCard[],
  reviewStore: DeclensionReviewDataStore,
  settings: DeclensionSettings
): number {
  const { newCardsToday, reviewedToday } = reviewStore;
  const buckets = cards.map((card) =>
    getReviewBucket(
      getOrCreateDeclensionCardReviewData(card.id, reviewStore).fsrsCard,
      includesDeclensionCardId(newCardsToday, card.id),
      includesDeclensionCardId(reviewedToday, card.id)
    )
  );
  return countDueCards(buckets, settings.newCardsPerDay - newCardsToday.length);
}

function computeVocabularyDueCount(
  words: VocabularyWord[],
  reviewStore: VocabularyReviewDataStore,
  settings: VocabularyDirectionSettings
): number {
  const { newCardsToday, reviewedToday } = reviewStore;
  const buckets = words.map((word) =>
    getReviewBucket(
      getOrCreateVocabularyCardReviewData(word.id, reviewStore).fsrsCard,
      includesWordId(newCardsToday, word.id),
      includesWordId(reviewedToday, word.id)
    )
  );
  return countDueCards(buckets, settings.newCardsPerDay - newCardsToday.length);
}

function computeSentenceDueCount(
  sentences: Sentence[],
  reviewStore: SentenceReviewDataStore,
  settings: SentenceDirectionSettings
): number {
  const { newCardsToday, reviewedToday } = reviewStore;
  const buckets = sentences
    .filter((sentence) => settings.selectedLevels.includes(sentence.level))
    .map((sentence) =>
      getReviewBucket(
        getOrCreateSentenceCardReviewData(sentence.id, reviewStore).fsrsCard,
        includesSentenceId(newCardsToday, sentence.id),
        includesSentenceId(reviewedToday, sentence.id)
      )
    );
  return countDueCards(buckets, settings.newCardsPerDay - newCardsToday.length);
}

function computeConjugationDueCount(
  verbs: Verb[],
  reviewStore: ConjugationReviewDataStore,
  settings: ConjugationDirectionSettings
): number {
  const { newFormsToday, reviewedToday } = reviewStore;
  const buckets = verbs.flatMap(getDrillableFormsForVerb).map(({ fullFormKey }) =>
    getReviewBucket(
      getOrCreateConjugationFormReviewData(fullFormKey, reviewStore).fsrsCard,
      includesFormKey(newFormsToday, fullFormKey),
      includesFormKey(reviewedToday, fullFormKey)
    )
  );
  return countDueCards(buckets, settings.newCardsPerDay - newFormsToday.length);
}

function computeAspectPairsDueCount(
  aspectPairCards: AspectPairCard[],
  reviewStore: AspectPairsReviewDataStore,
  settings: AspectPairsSettings
): number {
  const { newCardsToday, reviewedToday } = reviewStore;
  const buckets = aspectPairCards.map(({ verb }) =>
    getReviewBucket(
      getOrCreateAspectPairsCardReviewData(verb.id, reviewStore).fsrsCard,
      includesVerbId(newCardsToday, verb.id),
      includesVerbId(reviewedToday, verb.id)
    )
  );
  return countDueCards(buckets, settings.newCardsPerDay - newCardsToday.length);
}

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

    const declensionCount = computeDeclensionDueCount(
      declensionCtx.declensionCards,
      declensionCtx.declensionReviewStore,
      declensionCtx.declensionSettings
    );

    const plToEnCount = computeVocabularyDueCount(
      vocabularyCtx.vocabularyWords,
      vocabularyCtx.vocabularyReviewStores['pl-to-en'],
      vocabularyCtx.vocabularySettings['pl-to-en']
    );
    const enToPlCount = computeVocabularyDueCount(
      vocabularyCtx.vocabularyWords,
      vocabularyCtx.vocabularyReviewStores['en-to-pl'],
      vocabularyCtx.vocabularySettings['en-to-pl']
    );

    const sentencePlToEnCount = computeSentenceDueCount(
      sentenceCtx.sentences,
      sentenceCtx.sentenceReviewStores['pl-to-en'],
      sentenceCtx.sentenceSettings['pl-to-en']
    );
    const sentenceEnToPlCount = computeSentenceDueCount(
      sentenceCtx.sentences,
      sentenceCtx.sentenceReviewStores['en-to-pl'],
      sentenceCtx.sentenceSettings['en-to-pl']
    );

    const conjugationPlToEnCount = computeConjugationDueCount(
      conjugationCtx.verbs,
      conjugationCtx.conjugationReviewStores['pl-to-en'],
      conjugationCtx.conjugationSettings['pl-to-en']
    );
    const conjugationEnToPlCount = computeConjugationDueCount(
      conjugationCtx.verbs,
      conjugationCtx.conjugationReviewStores['en-to-pl'],
      conjugationCtx.conjugationSettings['en-to-pl']
    );

    const aspectPairsCount = computeAspectPairsDueCount(
      aspectPairsCtx.aspectPairCards,
      aspectPairsCtx.aspectPairsReviewStore,
      aspectPairsCtx.aspectPairsSettings
    );

    return {
      declension: declensionCount,
      vocabulary: plToEnCount + enToPlCount,
      sentences: sentencePlToEnCount + sentenceEnToPlCount,
      conjugation: conjugationPlToEnCount + conjugationEnToPlCount,
      aspectPairs: aspectPairsCount,
    };
  }, [declensionCtx, vocabularyCtx, sentenceCtx, conjugationCtx, aspectPairsCtx]);

  return (
    <ReviewCountsContext.Provider value={{ counts, loading }}>
      {children}
    </ReviewCountsContext.Provider>
  );
}
