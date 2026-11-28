/**
 * Fixtures shared by the scheduling tests. Not a test file itself.
 *
 * Each deck's items and review store have their own shape. The adapters below
 * build them from one neutral description of each card, so the behaviour the
 * scheduler gives every deck can be checked with the same table.
 */
import { vi } from 'vitest';
import type { Card } from 'ts-fsrs';
import { DEFAULT_USER_FILTERS } from '../../src/types/userFilters';
import type { DeclensionCard, DeclensionReviewDataStore } from '../../src/types';
import type { VocabularyReviewDataStore, VocabularyWord } from '../../src/types/vocabulary';
import type { Sentence, SentenceReviewDataStore } from '../../src/types/sentences';
import type { ConjugationReviewDataStore, Verb } from '../../src/types/conjugation';
import type { AspectPairCard, AspectPairsReviewDataStore } from '../../src/types/aspectPairs';
import { DAY, fsrsCard, inDays, State } from '../helpers/fsrs';
import { stub } from '../helpers/stub';
import {
  getExtraNewCards,
  getPracticeAheadCards,
  getSessionCards,
  type ReviewDeck,
} from '../../src/lib/reviewSession/scheduler';
import type { CardReviewData, ReviewDataStore, SessionId } from '../../src/types/common';
import {
  aspectPairsDeck,
  conjugationDeck,
  declensionDeck,
  sentenceDeck,
  vocabularyDeck,
} from '../../src/lib/reviewSession/reviewDecks';
import { getDrillableFormsForVerb } from '../../src/lib/conjugationUtils';

export { State };

/** A weekday afternoon in Toronto: 15:00 EST (UTC-5). */
export const NOW = new Date('2026-11-26T15:00:00-05:00');
export const TODAY = '2026-11-26';

/**
 * Freezes the clock. Only `Date` is faked so IndexedDB, promises and timers
 * keep working; call again within a test to move the clock.
 */
export function freezeTime(at: Date | string = NOW) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at);
}

export const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000);

/** Card states a learner's review data can be in, relative to the frozen clock. */
export const learning = (dueInMinutes = 10) => fsrsCard(State.Learning, inMinutes(dueInMinutes));
export const relearning = (dueInMinutes = 10) =>
  fsrsCard(State.Relearning, inMinutes(dueInMinutes));
/**
 * A graduated card on a 10-day interval; negative days means overdue. It carries
 * real memory state because FSRS gives NaN due dates when rating a Review card
 * whose stability is 0.
 */
export const graduated = (dueInDays: number) => {
  const due = inDays(dueInDays);
  return fsrsCard(State.Review, due, {
    stability: 10,
    difficulty: 5,
    reps: 3,
    scheduled_days: 10,
    last_review: new Date(due.getTime() - 10 * DAY),
  });
};
export { DAY };

/** One card in a deck, described independently of the module it belongs to. */
export interface Item {
  id: string;
  custom?: boolean;
  /** Review data; omitted for a card the learner has never seen. */
  card?: Card;
  /** In today's new-card counter. */
  introducedToday?: boolean;
  /** In today's reviewed counter (left the session today). */
  reviewedToday?: boolean;
}

export interface ModuleAdapter {
  name: string;
  /** Whether the module has learner-made cards that must come before built-in ones. */
  hasCustomCards: boolean;
  session(items: Item[], newCardsPerDay: number): { review: string[]; new: string[] };
  practiceAhead(items: Item[], count: number): string[];
  extraNew(items: Item[], count: number): string[];
}

const ids = (items: Item[], pick: (item: Item) => boolean | undefined) =>
  items.filter(pick).map((item) => item.id);

/**
 * Freezes a fixture and everything it holds. The review store and deck are React state in
 * the app, so a scheduler that wrote to them would corrupt the learner's data; frozen
 * fixtures make any such write throw (modules run in strict mode).
 */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value) && !(value instanceof Date)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const reviewEntries = <R>(items: Item[], make: (id: string, card: Card) => R) =>
  Object.fromEntries(items.flatMap((i) => (i.card ? [[i.id, make(i.id, i.card)]] : [])));

const counters = (items: Item[]) => ({
  reviewedToday: ids(items, (i) => i.reviewedToday),
  newCardsToday: ids(items, (i) => i.introducedToday),
  lastReviewDate: TODAY,
});

export const vocabularyStore = (items: Item[]) =>
  deepFreeze(
    stub<VocabularyReviewDataStore>({
      cards: reviewEntries(items, (wordId, fsrsCard) => ({ wordId, fsrsCard })),
      ...counters(items),
    })
  );
const vocabularyItems = (items: Item[]) =>
  deepFreeze(items.map((i) => stub<VocabularyWord>({ id: i.id, isCustom: i.custom })));

export const sentenceStore = (items: Item[]) =>
  deepFreeze(
    stub<SentenceReviewDataStore>({
      cards: reviewEntries(items, (sentenceId, fsrsCard) => ({ sentenceId, fsrsCard })),
      ...counters(items),
    })
  );
const sentenceItems = (items: Item[]) =>
  deepFreeze(items.map((i) => stub<Sentence>({ id: i.id, isCustom: i.custom, level: 'A1' })));

export const declensionStore = (items: Item[]) =>
  deepFreeze(
    stub<DeclensionReviewDataStore>({
      cards: reviewEntries(items, (cardId, fsrsCard) => ({ cardId, fsrsCard })),
      ...counters(items),
    })
  );
const declensionItems = (items: Item[]) =>
  deepFreeze(
    items.map((i) =>
      stub<DeclensionCard>({
        id: i.id,
        isCustom: i.custom,
        case: 'Genitive',
        gender: 'Feminine',
        number: 'Singular',
      })
    )
  );

export const aspectPairsStore = (items: Item[]) =>
  deepFreeze(
    stub<AspectPairsReviewDataStore>({
      cards: reviewEntries(items, (verbId, fsrsCard) => ({ verbId, fsrsCard })),
      ...counters(items),
    })
  );
const aspectPairsItems = (items: Item[]) =>
  deepFreeze(
    items.map((i) =>
      stub<AspectPairCard>({
        verb: stub<Verb>({ id: i.id }),
        pairVerb: stub<Verb>({ id: `${i.id}-pair` }),
      })
    )
  );

/** Each item becomes a verb with a single drillable form, present 1sg. */
export const formKey = (verbId: string) => `${verbId}:present:1sg`;
export const conjugationStore = (items: Item[]) => {
  const { reviewedToday, newCardsToday, lastReviewDate } = counters(items);
  return deepFreeze(
    stub<ConjugationReviewDataStore>({
      cards: Object.fromEntries(
        items.flatMap((i) =>
          i.card ? [[formKey(i.id), { formKey: formKey(i.id), fsrsCard: i.card }]] : []
        )
      ),
      reviewedToday: reviewedToday.map(formKey),
      newCardsToday: newCardsToday.map(formKey),
      lastReviewDate,
    })
  );
};
const conjugationVerbs = (items: Item[]) =>
  deepFreeze(
    items.map((i) =>
      stub<Verb>({
        id: i.id,
        aspect: 'Imperfective',
        verbClass: '-ić',
        conjugations: {
          present: stub<NonNullable<Verb['conjugations']['present']>>({
            '1sg': { pl: 'robię', en: ['I do'] },
          }),
        },
      })
    )
  );

/** One deck's adapter: its items, store and filters built from `Item`s, and each card's id. */
function moduleAdapter<DeckItem, R extends CardReviewData, Id extends SessionId, Card, Filters>(
  name: string,
  hasCustomCards: boolean,
  deck: ReviewDeck<DeckItem, R, Id, Card, Filters>,
  build: { items(items: Item[]): DeckItem[]; store(items: Item[]): ReviewDataStore<R, Id> },
  idOf: (card: Card) => string,
  filters?: Filters
): ModuleAdapter {
  return {
    name,
    hasCustomCards,
    session: (items, newCardsPerDay) => {
      const session = getSessionCards(
        deck,
        build.items(items),
        build.store(items),
        { newCardsPerDay },
        filters
      );
      return { review: session.reviewCards.map(idOf), new: session.newCards.map(idOf) };
    },
    practiceAhead: (items, count) =>
      getPracticeAheadCards(deck, build.items(items), build.store(items), count, filters).map(idOf),
    extraNew: (items, count) =>
      getExtraNewCards(deck, build.items(items), build.store(items), count, filters).map(idOf),
  };
}

export const MODULES: ModuleAdapter[] = [
  moduleAdapter(
    'vocabulary',
    true,
    vocabularyDeck,
    { items: vocabularyItems, store: vocabularyStore },
    (c) => String(c.word.id)
  ),
  moduleAdapter(
    'sentences',
    true,
    sentenceDeck,
    { items: sentenceItems, store: sentenceStore },
    (c) => c.sentence.id
  ),
  moduleAdapter(
    'declension',
    true,
    declensionDeck,
    { items: declensionItems, store: declensionStore },
    (c) => String(c.card.id),
    DEFAULT_USER_FILTERS.declension
  ),
  moduleAdapter(
    'conjugation',
    false,
    conjugationDeck,
    {
      items: (items) => conjugationVerbs(items).flatMap(getDrillableFormsForVerb),
      store: conjugationStore,
    },
    (c) => c.form.verb.id,
    DEFAULT_USER_FILTERS.conjugation
  ),
  moduleAdapter(
    'aspect pairs',
    false,
    aspectPairsDeck,
    { items: aspectPairsItems, store: aspectPairsStore },
    (c) => c.card.verb.id
  ),
];

/** Whether every custom id comes before every built-in id in `order`. */
export function customFirst(order: string[], items: Item[]): boolean {
  const isCustom = new Map(items.map((i) => [i.id, i.custom === true]));
  const flags = order.map((id) => isCustom.get(id));
  const firstSystem = flags.indexOf(false);
  return firstSystem === -1 || !flags.slice(firstSystem).includes(true);
}
