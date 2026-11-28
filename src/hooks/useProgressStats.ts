import { useMemo } from 'react';
import { State, type Card as FSRSCard } from 'ts-fsrs';
import { useReviewData, type ReviewDataContextType } from './useReviewData';
import type { CardReviewData, TranslationDirection } from '../types/common';
import type { CEFRLevel } from '../types/sentences';
import { ALL_LEVELS } from '../types/sentences';
import { getDrillableFormsForVerb } from '../lib/conjugationUtils';
import { placeItems, type PlacedItem } from '../lib/reviewSession/scheduler';
import {
  aspectPairsDeck,
  conjugationDeck,
  declensionDeck,
  sentenceDeck,
  vocabularyDeck,
} from '../lib/reviewSession/reviewDecks';
import type { DrillableForm } from '../types/conjugation';
import type { UserFilters } from '../types/userFilters';
import { useSessionFilters } from '../contexts/review/sessionFilters';

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

type Data = { filters: UserFilters } & Pick<
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

interface FlaggedCard {
  fsrsCard: FSRSCard;
  due: boolean;
}

/** Marks cards due for today, letting new cards in (in order) until the daily allowance runs out. */
function flagDue(
  placed: PlacedItem<unknown, CardReviewData>[],
  store: { newCardsToday: unknown[] },
  settings: { newCardsPerDay: number }
): FlaggedCard[] {
  let newSlots = settings.newCardsPerDay - store.newCardsToday.length;
  return placed.map(({ reviewData: { fsrsCard }, bucket }) => {
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
  const placed = placeItems(declensionDeck, data.declensionCards, store, data.filters.declension);
  return flagDue(placed, store, data.declensionSettings);
}

function flagVocabulary(data: Data, direction: TranslationDirection): FlaggedCard[] {
  const store = data.vocabularyReviewStores[direction];
  const placed = placeItems(vocabularyDeck, data.vocabularyWords, store);
  return flagDue(placed, store, data.vocabularySettings[direction]);
}

/** Every sentence is counted, but only those at the selected levels can be due. */
function flagSentences(data: Data, direction: TranslationDirection): FlaggedCard[] {
  const store = data.sentenceReviewStores[direction];
  const settings = data.sentenceSettings[direction];
  const placed = placeItems(sentenceDeck, data.sentences, store).map((p) =>
    settings.selectedLevels.includes(p.item.level) ? p : { ...p, bucket: null }
  );
  return flagDue(placed, store, settings);
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
  forms: DrillableForm[]
): FlaggedCard[] {
  const store = data.conjugationReviewStores[direction];
  const placed = placeItems(conjugationDeck, forms, store, data.filters.conjugation);
  return flagDue(placed, store, data.conjugationSettings[direction]);
}

function flagAspectPairs(data: Data): FlaggedCard[] {
  const store = data.aspectPairsReviewStore;
  const placed = placeItems(aspectPairsDeck, data.aspectPairCards, store);
  return flagDue(placed, store, data.aspectPairsSettings);
}

function computeAllStats(data: Data): AllProgressStats {
  const vocabulary = mapDirections((d) => flagVocabulary(data, d));
  const sentences = mapDirections((d) => flagSentences(data, d));
  const forms = data.verbs.flatMap(getDrillableFormsForVerb);
  const conjugation = mapDirections((d) => flagConjugation(data, d, forms));

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
  const filters = useSessionFilters();

  return useMemo(
    () =>
      computeAllStats({
        filters,
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
      filters,
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
