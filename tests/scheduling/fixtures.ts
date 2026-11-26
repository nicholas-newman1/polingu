/**
 * Fixtures shared by the scheduling tests. Not a test file itself.
 *
 * Every scheduler takes "a deck plus a review store" in its own shape. The
 * adapters below build those from one neutral description of each card, so the
 * behaviour all five schedulers share can be checked with the same table.
 */
import { vi } from 'vitest';
import type { Card } from 'ts-fsrs';
import getDeclensionSessionCards from '../../src/lib/declensionScheduler/getSessionCards';
import getDeclensionExtraCards from '../../src/lib/declensionScheduler/getExtraCards';
import getConjugationSessionCards from '../../src/lib/conjugationScheduler/getConjugationSessionCards';
import getConjugationExtraCards from '../../src/lib/conjugationScheduler/getConjugationExtraCards';
import getVocabularySessionCards from '../../src/lib/vocabularyScheduler/getVocabularySessionCards';
import getVocabularyPracticeAheadCards from '../../src/lib/vocabularyScheduler/getVocabularyPracticeAheadCards';
import getVocabularyExtraNewCards from '../../src/lib/vocabularyScheduler/getVocabularyExtraNewCards';
import getSentenceSessionCards from '../../src/lib/sentenceScheduler/getSentenceSessionCards';
import getSentencePracticeAheadCards from '../../src/lib/sentenceScheduler/getSentencePracticeAheadCards';
import getSentenceExtraNewCards from '../../src/lib/sentenceScheduler/getSentenceExtraNewCards';
import getAspectPairsSessionCards from '../../src/lib/aspectPairsScheduler/getAspectPairsSessionCards';
import getAspectPairsPracticeAheadCards from '../../src/lib/aspectPairsScheduler/getAspectPairsPracticeAheadCards';
import getAspectPairsExtraNewCards from '../../src/lib/aspectPairsScheduler/getAspectPairsExtraNewCards';
import { recordCardReview, type ReviewOutcome } from '../../src/lib/reviewSession/recordReview';
import { DEFAULT_USER_FILTERS } from '../../src/types/userFilters';
import type { DeclensionCard, DeclensionReviewDataStore } from '../../src/types';
import type {
  VocabularyCardReviewData,
  VocabularyReviewDataStore,
  VocabularyWord,
  VocabularyWordId,
} from '../../src/types/vocabulary';
import type { Sentence, SentenceReviewDataStore } from '../../src/types/sentences';
import type { ConjugationReviewDataStore, Verb } from '../../src/types/conjugation';
import type { AspectPairCard, AspectPairsReviewDataStore } from '../../src/types/aspectPairs';
import { DAY, fsrsCard, inDays, State } from '../helpers/fsrs';
import { stub } from '../helpers/stub';

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

/**
 * recordCardReview as the vocabulary page instantiates it. Calling the generic
 * directly with a literal id (`7`) would narrow the id type to that literal.
 */
export const recordWordReview = (
  store: VocabularyReviewDataStore,
  id: VocabularyWordId,
  reviewData: VocabularyCardReviewData,
  outcome: ReviewOutcome
): VocabularyReviewDataStore => recordCardReview(store, id, reviewData, outcome);

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
export const vocabularyDeck = (items: Item[]) =>
  deepFreeze(items.map((i) => stub<VocabularyWord>({ id: i.id, isCustom: i.custom })));

export const sentenceStore = (items: Item[]) =>
  deepFreeze(
    stub<SentenceReviewDataStore>({
      cards: reviewEntries(items, (sentenceId, fsrsCard) => ({ sentenceId, fsrsCard })),
      ...counters(items),
    })
  );
export const sentenceDeck = (items: Item[]) =>
  deepFreeze(items.map((i) => stub<Sentence>({ id: i.id, isCustom: i.custom, level: 'A1' })));

export const declensionStore = (items: Item[]) =>
  deepFreeze(
    stub<DeclensionReviewDataStore>({
      cards: reviewEntries(items, (cardId, fsrsCard) => ({ cardId, fsrsCard })),
      ...counters(items),
    })
  );
export const declensionDeck = (items: Item[]) =>
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
export const aspectPairsDeck = (items: Item[]) =>
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
      forms: Object.fromEntries(
        items.flatMap((i) =>
          i.card ? [[formKey(i.id), { formKey: formKey(i.id), fsrsCard: i.card }]] : []
        )
      ),
      reviewedToday: reviewedToday.map(formKey),
      newFormsToday: newCardsToday.map(formKey),
      lastReviewDate,
    })
  );
};
export const conjugationDeck = (items: Item[]) =>
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

const split = <T>(result: { reviewCards: T[]; newCards: T[] }, id: (card: T) => string) => ({
  review: result.reviewCards.map(id),
  new: result.newCards.map(id),
});

export const MODULES: ModuleAdapter[] = [
  {
    name: 'vocabulary',
    hasCustomCards: true,
    session: (items, newCardsPerDay) =>
      split(
        getVocabularySessionCards(vocabularyDeck(items), vocabularyStore(items), {
          newCardsPerDay,
        }),
        (c) => String(c.word.id)
      ),
    practiceAhead: (items, count) =>
      getVocabularyPracticeAheadCards(vocabularyDeck(items), vocabularyStore(items), count).map(
        (c) => String(c.word.id)
      ),
    extraNew: (items, count) =>
      getVocabularyExtraNewCards(vocabularyDeck(items), vocabularyStore(items), count).map((c) =>
        String(c.word.id)
      ),
  },
  {
    name: 'sentences',
    hasCustomCards: true,
    session: (items, newCardsPerDay) =>
      split(
        getSentenceSessionCards(sentenceDeck(items), sentenceStore(items), {
          newCardsPerDay,
          selectedLevels: ['A1'],
        }),
        (c) => c.sentence.id
      ),
    practiceAhead: (items, count) =>
      getSentencePracticeAheadCards(sentenceDeck(items), sentenceStore(items), count).map(
        (c) => c.sentence.id
      ),
    extraNew: (items, count) =>
      getSentenceExtraNewCards(sentenceDeck(items), sentenceStore(items), count).map(
        (c) => c.sentence.id
      ),
  },
  {
    name: 'declension',
    hasCustomCards: true,
    session: (items, newCardsPerDay) =>
      split(
        getDeclensionSessionCards(
          declensionDeck(items),
          declensionStore(items),
          DEFAULT_USER_FILTERS.declension,
          { newCardsPerDay }
        ),
        (c) => String(c.card.id)
      ),
    practiceAhead: (items, count) =>
      getDeclensionExtraCards(declensionDeck(items), declensionStore(items), {
        ...DEFAULT_USER_FILTERS.declension,
      })
        .getPracticeAheadCards(count)
        .map((c) => String(c.card.id)),
    extraNew: (items, count) =>
      getDeclensionExtraCards(declensionDeck(items), declensionStore(items), {
        ...DEFAULT_USER_FILTERS.declension,
      })
        .getExtraNewCards(count)
        .map((c) => String(c.card.id)),
  },
  {
    name: 'conjugation',
    hasCustomCards: false,
    session: (items, newCardsPerDay) =>
      split(
        getConjugationSessionCards(
          conjugationDeck(items),
          conjugationStore(items),
          DEFAULT_USER_FILTERS.conjugation,
          { newCardsPerDay }
        ),
        (c) => c.form.verb.id
      ),
    practiceAhead: (items, count) =>
      getConjugationExtraCards(
        conjugationDeck(items),
        conjugationStore(items),
        DEFAULT_USER_FILTERS.conjugation
      )
        .getPracticeAheadCards(count)
        .map((c) => c.form.verb.id),
    extraNew: (items, count) =>
      getConjugationExtraCards(
        conjugationDeck(items),
        conjugationStore(items),
        DEFAULT_USER_FILTERS.conjugation
      )
        .getExtraNewCards(count)
        .map((c) => c.form.verb.id),
  },
  {
    name: 'aspect pairs',
    hasCustomCards: false,
    session: (items, newCardsPerDay) =>
      split(
        getAspectPairsSessionCards(aspectPairsDeck(items), aspectPairsStore(items), {
          newCardsPerDay,
        }),
        (c) => c.card.verb.id
      ),
    practiceAhead: (items, count) =>
      getAspectPairsPracticeAheadCards(aspectPairsDeck(items), aspectPairsStore(items), count).map(
        (c) => c.card.verb.id
      ),
    extraNew: (items, count) =>
      getAspectPairsExtraNewCards(aspectPairsDeck(items), aspectPairsStore(items), count).map(
        (c) => c.card.verb.id
      ),
  },
];

/** Whether every custom id comes before every built-in id in `order`. */
export function customFirst(order: string[], items: Item[]): boolean {
  const isCustom = new Map(items.map((i) => [i.id, i.custom === true]));
  const flags = order.map((id) => isCustom.get(id));
  const firstSystem = flags.indexOf(false);
  return firstSystem === -1 || !flags.slice(firstSystem).includes(true);
}
