import { useMemo } from 'react';
import { State, type Card as FSRSCard } from 'ts-fsrs';
import {
  useAspectPairs,
  useConjugation,
  useDeclension,
  useSentences,
  useVocabulary,
} from './useReviewData';
import type {
  CardReviewData,
  ReviewDataStore,
  SessionId,
  TranslationDirection,
} from '../types/common';
import type { CEFRLevel, Sentence } from '../types/sentences';
import { ALL_LEVELS } from '../types/sentences';
import { getDrillableFormsForVerb } from '../lib/conjugationUtils';
import {
  newCardsLeftToday,
  placeItems,
  type PlacedItem,
  type ReviewDeck,
} from '../lib/reviewSession/scheduler';
import {
  aspectPairsDeck,
  conjugationDeck,
  declensionDeck,
  sentenceDeck,
  vocabularyDeck,
} from '../lib/reviewSession/reviewDecks';
import type { DeckPart } from '../lib/storage/reviewDeckDocs';
import type { DeckProgress, SentenceContextType } from '../contexts/review';
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

/** The five review decks, each with its overall stats in AllProgressStats. */
export type ReviewDeckName =
  | 'declension'
  | 'vocabulary'
  | 'sentences'
  | 'conjugation'
  | 'aspectPairs';

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
  let newSlots = newCardsLeftToday(store, settings);
  return placed.map(({ reviewData: { fsrsCard }, bucket }) => {
    if (bucket === 'new' && newSlots > 0) {
      newSlots--;
      return { fsrsCard, due: true };
    }
    return { fsrsCard, due: bucket === 'review' };
  });
}

/** The cards of one part of a deck, flagged due as that part's session today would serve them. */
function flagPart<
  Item,
  R extends CardReviewData,
  Id extends SessionId,
  Card,
  K extends DeckPart,
  F,
>(
  deck: ReviewDeck<Item, R, Id, Card, F>,
  items: readonly Item[],
  progress: DeckProgress<K, ReviewDataStore<R, Id>, { newCardsPerDay: number }>,
  part: K,
  filters?: F
): FlaggedCard[] {
  const store = progress.stores[part];
  return flagDue(placeItems(deck, items, store, filters), store, progress.settings[part]);
}

/** Every sentence is counted, but only those at the selected levels can be due. */
function flagSentences(
  sentences: Sentence[],
  progress: SentenceContextType['progress'],
  direction: TranslationDirection
): FlaggedCard[] {
  const store = progress.stores[direction];
  const settings = progress.settings[direction];
  const placed = placeItems(sentenceDeck, sentences, store).map((p) =>
    settings.selectedLevels.includes(p.item.level) ? p : { ...p, bucket: null }
  );
  return flagDue(placed, store, settings);
}

function summarize(cards: FlaggedCard[]): ProgressStats {
  return {
    total: cards.length,
    learned: cards.filter((c) => c.fsrsCard.state !== State.New).length,
    mastered: cards.filter((c) => c.fsrsCard.state === State.Review).length,
    due: cards.filter((c) => c.due).length,
  };
}

function summarizeSentencesByLevel(
  sentences: Sentence[],
  flagged: FlaggedCard[]
): TranslationDirectionStats {
  const byLevel = {} as Record<CEFRLevel, ProgressStats>;
  for (const level of ALL_LEVELS) {
    byLevel[level] = summarize(flagged.filter((_, i) => sentences[i].level === level));
  }
  return { total: summarize(flagged), byLevel };
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

/** Each deck is summarised on its own, so a change to one deck leaves the others' numbers be. */
export function useProgressStats(): AllProgressStats {
  const declension = useDeclension();
  const vocabulary = useVocabulary();
  const { sentences, progress: sentenceProgress } = useSentences();
  const conjugation = useConjugation();
  const aspectPairs = useAspectPairs();
  const filters = useSessionFilters();

  const declensionStats = useMemo(
    () =>
      summarize(
        flagPart(declensionDeck, declension.cards, declension.progress, 'all', filters.declension)
      ),
    [declension.cards, declension.progress, filters.declension]
  );

  const vocabularyStats = useMemo(() => {
    const flagged = mapDirections((d) =>
      flagPart(vocabularyDeck, vocabulary.words, vocabulary.progress, d)
    );
    return {
      vocabulary: combineDirections(flagged),
      vocabularyByDirection: mapDirections((d) => summarize(flagged[d])),
    };
  }, [vocabulary.words, vocabulary.progress]);

  const sentenceStats = useMemo(() => {
    const flagged = mapDirections((d) => flagSentences(sentences, sentenceProgress, d));
    return {
      sentences: combineDirections(flagged),
      sentencesByDirection: mapDirections((d) => summarizeSentencesByLevel(sentences, flagged[d])),
    };
  }, [sentences, sentenceProgress]);

  const conjugationStats = useMemo(() => {
    const forms = conjugation.verbs.flatMap(getDrillableFormsForVerb);
    const flagged = mapDirections((d) =>
      flagPart(conjugationDeck, forms, conjugation.progress, d, filters.conjugation)
    );
    return {
      conjugation: combineDirections(flagged),
      conjugationByDirection: mapDirections((d) => summarize(flagged[d])),
    };
  }, [conjugation.verbs, conjugation.progress, filters.conjugation]);

  const aspectPairsStats = useMemo(
    () => summarize(flagPart(aspectPairsDeck, aspectPairs.cards, aspectPairs.progress, 'all')),
    [aspectPairs.cards, aspectPairs.progress]
  );

  return useMemo(
    () => ({
      declension: declensionStats,
      ...vocabularyStats,
      ...sentenceStats,
      ...conjugationStats,
      aspectPairs: aspectPairsStats,
    }),
    [declensionStats, vocabularyStats, sentenceStats, conjugationStats, aspectPairsStats]
  );
}
