import { useMemo } from 'react';
import { State, type Card as FSRSCard } from 'ts-fsrs';
import { useReviewData, type ReviewDataContextType } from './useReviewData';
import getOrCreateDeclensionCardReviewData from '../lib/storage/getOrCreateDeclensionCardReviewData';
import getOrCreateVocabularyCardReviewData from '../lib/storage/getOrCreateVocabularyCardReviewData';
import getOrCreateSentenceCardReviewData from '../lib/storage/getOrCreateSentenceCardReviewData';
import getOrCreateConjugationFormReviewData from '../lib/storage/getOrCreateConjugationFormReviewData';
import getOrCreateAspectPairsCardReviewData from '../lib/storage/getOrCreateAspectPairsCardReviewData';
import getReviewBucket, { type ReviewBucket } from '../lib/fsrsUtils/getReviewBucket';
import {
  includesDeclensionCardId,
  includesSentenceId,
  includesFormKey,
  includesVerbId,
  includesWordId,
} from '../lib/storage/helpers';
import type { TranslationDirection } from '../types/common';
import type { CEFRLevel } from '../types/sentences';
import { ALL_LEVELS } from '../types/sentences';
import { getDrillableFormsForVerb } from '../lib/conjugationUtils';

export interface ProgressStats {
  total: number;
  learned: number;
  mastered: number;
  due: number;
}

export interface TranslationDirectionStats {
  total: ProgressStats;
  byLevel: Record<CEFRLevel, ProgressStats>;
}

export interface AllProgressStats {
  declension: ProgressStats;
  vocabulary: ProgressStats;
  vocabularyByDirection: Record<TranslationDirection, ProgressStats>;
  sentences: ProgressStats;
  sentencesByDirection: Record<TranslationDirection, TranslationDirectionStats>;
  conjugation: ProgressStats;
  conjugationByDirection: Record<TranslationDirection, ProgressStats>;
  aspectPairs: ProgressStats;
}

type Data = Pick<
  ReviewDataContextType,
  | 'declensionCards'
  | 'declensionReviewStore'
  | 'declensionSettings'
  | 'vocabularyWords'
  | 'vocabularyReviewStores'
  | 'vocabularySettings'
  | 'sentences'
  | 'sentenceReviewStores'
  | 'sentenceSettings'
  | 'verbs'
  | 'conjugationReviewStores'
  | 'conjugationSettings'
  | 'aspectPairCards'
  | 'aspectPairsReviewStore'
  | 'aspectPairsSettings'
>;

interface TrackedCard {
  fsrsCard: FSRSCard;
  bucket: ReviewBucket;
}

interface FlaggedCard {
  fsrsCard: FSRSCard;
  due: boolean;
}

/** Marks cards due for today, letting new cards in (in order) until the daily allowance runs out. */
function flagDue(cards: TrackedCard[], remainingNew: number): FlaggedCard[] {
  let newSlots = remainingNew;
  return cards.map(({ fsrsCard, bucket }) => {
    if (bucket === 'new' && newSlots > 0) {
      newSlots--;
      return { fsrsCard, due: true };
    }
    return { fsrsCard, due: bucket === 'review' };
  });
}

function summarize(cards: FlaggedCard[]): ProgressStats {
  return {
    total: cards.length,
    learned: cards.filter((c) => c.fsrsCard.state !== State.New).length,
    mastered: cards.filter((c) => c.fsrsCard.state === State.Review).length,
    due: cards.filter((c) => c.due).length,
  };
}

/** Learned if started in either direction; mastered only when mastered in both. */
function combineDirections(
  byDirection: Record<TranslationDirection, FlaggedCard[]>
): ProgressStats {
  const pl = byDirection['pl-to-en'];
  const en = byDirection['en-to-pl'];
  const states = pl.map((c, i) => [c.fsrsCard.state, en[i].fsrsCard.state]);
  return {
    total: pl.length,
    learned: states.filter((s) => s.some((state) => state !== State.New)).length,
    mastered: states.filter((s) => s.every((state) => state === State.Review)).length,
    due: pl.filter((c) => c.due).length + en.filter((c) => c.due).length,
  };
}

function mapDirections<T>(
  fn: (direction: TranslationDirection) => T
): Record<TranslationDirection, T> {
  return { 'pl-to-en': fn('pl-to-en'), 'en-to-pl': fn('en-to-pl') };
}

function flagDeclension(data: Data): FlaggedCard[] {
  const store = data.declensionReviewStore;
  const tracked = data.declensionCards.map((card) => {
    const { fsrsCard } = getOrCreateDeclensionCardReviewData(card.id, store);
    const bucket = getReviewBucket(
      fsrsCard,
      includesDeclensionCardId(store.newCardsToday, card.id),
      includesDeclensionCardId(store.reviewedToday, card.id)
    );
    return { fsrsCard, bucket };
  });
  return flagDue(tracked, data.declensionSettings.newCardsPerDay - store.newCardsToday.length);
}

function flagVocabulary(data: Data, direction: TranslationDirection): FlaggedCard[] {
  const store = data.vocabularyReviewStores[direction];
  const tracked = data.vocabularyWords.map((word) => {
    const { fsrsCard } = getOrCreateVocabularyCardReviewData(word.id, store);
    const bucket = getReviewBucket(
      fsrsCard,
      includesWordId(store.newCardsToday, word.id),
      includesWordId(store.reviewedToday, word.id)
    );
    return { fsrsCard, bucket };
  });
  return flagDue(
    tracked,
    data.vocabularySettings[direction].newCardsPerDay - store.newCardsToday.length
  );
}

function flagSentences(data: Data, direction: TranslationDirection): FlaggedCard[] {
  const store = data.sentenceReviewStores[direction];
  const settings = data.sentenceSettings[direction];
  const tracked = data.sentences.map((sentence) => {
    const { fsrsCard } = getOrCreateSentenceCardReviewData(sentence.id, store);
    const bucket = settings.selectedLevels.includes(sentence.level)
      ? getReviewBucket(
          fsrsCard,
          includesSentenceId(store.newCardsToday, sentence.id),
          includesSentenceId(store.reviewedToday, sentence.id)
        )
      : null;
    return { fsrsCard, bucket };
  });
  return flagDue(tracked, settings.newCardsPerDay - store.newCardsToday.length);
}

function summarizeSentencesByLevel(data: Data, flagged: FlaggedCard[]): TranslationDirectionStats {
  const byLevel = {} as Record<CEFRLevel, ProgressStats>;
  for (const level of ALL_LEVELS) {
    byLevel[level] = summarize(flagged.filter((_, i) => data.sentences[i].level === level));
  }
  return { total: summarize(flagged), byLevel };
}

function flagConjugation(
  data: Data,
  direction: TranslationDirection,
  formKeys: string[]
): FlaggedCard[] {
  const store = data.conjugationReviewStores[direction];
  const tracked = formKeys.map((key) => {
    const { fsrsCard } = getOrCreateConjugationFormReviewData(key, store);
    const bucket = getReviewBucket(
      fsrsCard,
      includesFormKey(store.newFormsToday, key),
      includesFormKey(store.reviewedToday, key)
    );
    return { fsrsCard, bucket };
  });
  return flagDue(
    tracked,
    data.conjugationSettings[direction].newCardsPerDay - store.newFormsToday.length
  );
}

function flagAspectPairs(data: Data): FlaggedCard[] {
  const store = data.aspectPairsReviewStore;
  const tracked = data.aspectPairCards.map(({ verb }) => {
    const { fsrsCard } = getOrCreateAspectPairsCardReviewData(verb.id, store);
    const bucket = getReviewBucket(
      fsrsCard,
      includesVerbId(store.newCardsToday, verb.id),
      includesVerbId(store.reviewedToday, verb.id)
    );
    return { fsrsCard, bucket };
  });
  return flagDue(tracked, data.aspectPairsSettings.newCardsPerDay - store.newCardsToday.length);
}

function computeAllStats(data: Data): AllProgressStats {
  const vocabulary = mapDirections((d) => flagVocabulary(data, d));
  const sentences = mapDirections((d) => flagSentences(data, d));
  const formKeys = data.verbs.flatMap((verb) =>
    getDrillableFormsForVerb(verb).map((form) => form.fullFormKey)
  );
  const conjugation = mapDirections((d) => flagConjugation(data, d, formKeys));

  return {
    declension: summarize(flagDeclension(data)),
    vocabulary: combineDirections(vocabulary),
    vocabularyByDirection: mapDirections((d) => summarize(vocabulary[d])),
    sentences: combineDirections(sentences),
    sentencesByDirection: mapDirections((d) => summarizeSentencesByLevel(data, sentences[d])),
    conjugation: combineDirections(conjugation),
    conjugationByDirection: mapDirections((d) => summarize(conjugation[d])),
    aspectPairs: summarize(flagAspectPairs(data)),
  };
}

export function useProgressStats(): AllProgressStats {
  const {
    declensionCards,
    declensionReviewStore,
    declensionSettings,
    vocabularyWords,
    vocabularyReviewStores,
    vocabularySettings,
    sentences,
    sentenceReviewStores,
    sentenceSettings,
    verbs,
    conjugationReviewStores,
    conjugationSettings,
    aspectPairCards,
    aspectPairsReviewStore,
    aspectPairsSettings,
  } = useReviewData();

  return useMemo(
    () =>
      computeAllStats({
        declensionCards,
        declensionReviewStore,
        declensionSettings,
        vocabularyWords,
        vocabularyReviewStores,
        vocabularySettings,
        sentences,
        sentenceReviewStores,
        sentenceSettings,
        verbs,
        conjugationReviewStores,
        conjugationSettings,
        aspectPairCards,
        aspectPairsReviewStore,
        aspectPairsSettings,
      }),
    [
      declensionCards,
      declensionReviewStore,
      declensionSettings,
      vocabularyWords,
      vocabularyReviewStores,
      vocabularySettings,
      sentences,
      sentenceReviewStores,
      sentenceSettings,
      verbs,
      conjugationReviewStores,
      conjugationSettings,
      aspectPairCards,
      aspectPairsReviewStore,
      aspectPairsSettings,
    ]
  );
}
