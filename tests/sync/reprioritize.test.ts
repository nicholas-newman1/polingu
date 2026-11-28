import { describe, expect, test } from 'vitest';
import { createEmptyCard, State } from 'ts-fsrs';
import reprioritizeVocabularyWord, {
  canReprioritizeVocabularyWord,
  prioritizeNewVocabularyWord,
} from '../../src/lib/storage/reprioritizeVocabularyWord';
import reprioritizeSentence, {
  canReprioritizeSentence,
} from '../../src/lib/storage/reprioritizeSentence';
import reprioritizeDeclensionCard, {
  canReprioritizeDeclensionCard,
} from '../../src/lib/storage/reprioritizeDeclensionCard';
import { getTodayString } from '../../src/lib/storage/helpers';
import type { VocabularyReviewDataStore, VocabularyWord } from '../../src/types/vocabulary';
import type { SentenceReviewDataStore } from '../../src/types/sentences';
import type { DeclensionReviewDataStore } from '../../src/types';
import type { ConjugationReviewDataStore } from '../../src/types/conjugation';
import type { AspectPairsReviewDataStore } from '../../src/types/aspectPairs';
import { stub, stubs } from '../helpers/stub';
import { freezeTime, ratedCard } from './support/harness';
import { vocabularyStorage } from '../../src/lib/storage/reviewDeckStorage';
import { placeItems, reviewDataFor } from '../../src/lib/reviewSession/scheduler';
import {
  aspectPairsDeck,
  conjugationDeck,
  declensionDeck,
  sentenceDeck,
  vocabularyDeck,
} from '../../src/lib/reviewSession/reviewDecks';

const NOW = new Date('2026-11-26T15:00:00Z');
const RATED = '2026-11-20T10:00:00Z';

const vocabStore = (): VocabularyReviewDataStore => ({
  cards: {
    5: { wordId: 5, fsrsCard: ratedCard(RATED) },
    6: { wordId: 6, fsrsCard: ratedCard(RATED) },
    custom_1: { wordId: 'custom_1', fsrsCard: createEmptyCard(new Date(RATED)) },
  },
  reviewedToday: [5, 6],
  newCardsToday: ['5', 6],
  lastReviewDate: '2026-11-26',
});

describe('"Study next" puts a word not studied yet first among the new words', () => {
  test('an unseen word gets a new card stamped with the time it was asked for', () => {
    const next = prioritizeNewVocabularyWord(vocabStore(), 79, NOW);

    expect(next.cards[79].fsrsCard.state).toBe(State.New);
    expect(next.cards[79].prioritizedAt).toBe(NOW.getTime());
    expect(next.cards[5]).toEqual(vocabStore().cards[5]);
  });

  test("a word introduced today but not yet rated leaves today's new list", () => {
    const next = prioritizeNewVocabularyWord(
      { ...vocabStore(), newCardsToday: ['5', 6, 'custom_1'] },
      'custom_1',
      NOW
    );

    expect(next.cards.custom_1.prioritizedAt).toBe(NOW.getTime());
    expect(next.newCardsToday).toEqual(['5', 6]);
  });

  test('a word already studied is left as it is', () => {
    const store = vocabStore();

    expect(prioritizeNewVocabularyWord(store, 5, NOW)).toBe(store);
  });
});

describe('"Review again" puts a studied card back in the new queue', () => {
  test("vocabulary: the card becomes new, due now, and leaves today's counters", () => {
    const next = reprioritizeVocabularyWord(vocabStore(), 5, NOW);

    expect(next.cards[5].fsrsCard.state).toBe(State.New);
    expect(next.cards[5].fsrsCard.due).toEqual(NOW);
    expect(next.reviewedToday).toEqual([6]);
    expect(next.newCardsToday).toEqual([6]);
    expect(next.cards[6]).toEqual(vocabStore().cards[6]);
  });

  test('vocabulary: the reset word is put first in line among the new words', () => {
    const next = reprioritizeVocabularyWord(vocabStore(), 5, NOW);

    expect(next.cards[5].prioritizedAt).toBe(NOW.getTime());
    expect(next.cards[6].prioritizedAt).toBeUndefined();
  });

  test('vocabulary: the history of earlier reviews (reps, lapses) is kept', () => {
    const before = vocabStore().cards[5].fsrsCard;
    const next = reprioritizeVocabularyWord(vocabStore(), 5, NOW);

    expect(next.cards[5].fsrsCard.reps).toBe(before.reps);
    expect(next.cards[5].fsrsCard.last_review).toEqual(before.last_review);
  });

  test('vocabulary: the original store is not modified', () => {
    const store = vocabStore();
    reprioritizeVocabularyWord(store, 5, NOW);

    expect(store).toEqual(vocabStore());
  });

  test('vocabulary: an unknown or never-studied word leaves the store as it is', () => {
    const store = vocabStore();

    expect(reprioritizeVocabularyWord(store, 404, NOW)).toBe(store);
    expect(reprioritizeVocabularyWord(store, 'custom_1', NOW)).toBe(store);
  });

  test('vocabulary: offered when either direction has studied the word', () => {
    const empty = vocabularyStorage['pl-to-en'].emptyStore();

    expect(canReprioritizeVocabularyWord({ 'pl-to-en': empty, 'en-to-pl': vocabStore() }, 5)).toBe(
      true
    );
    expect(
      canReprioritizeVocabularyWord({ 'pl-to-en': vocabStore(), 'en-to-pl': empty }, '5')
    ).toBe(true);
    expect(
      canReprioritizeVocabularyWord({ 'pl-to-en': vocabStore(), 'en-to-pl': empty }, 'custom_1')
    ).toBe(false);
    expect(canReprioritizeVocabularyWord({ 'pl-to-en': empty, 'en-to-pl': empty }, 5)).toBe(false);
  });

  test('sentences: same rules, ids compared as strings', () => {
    const store: SentenceReviewDataStore = {
      cards: { s1: { sentenceId: 's1', fsrsCard: ratedCard(RATED) } },
      reviewedToday: ['s1', 's2'],
      newCardsToday: ['s1'],
      lastReviewDate: '2026-11-26',
    };
    const empty = { ...store, cards: {}, reviewedToday: [], newCardsToday: [] };

    const next = reprioritizeSentence(store, 's1', NOW);

    expect(next.cards.s1.fsrsCard.state).toBe(State.New);
    expect(next.reviewedToday).toEqual(['s2']);
    expect(next.newCardsToday).toEqual([]);
    expect(reprioritizeSentence(store, 'nope', NOW)).toBe(store);
    expect(canReprioritizeSentence({ 'pl-to-en': empty, 'en-to-pl': store }, 's1')).toBe(true);
    expect(canReprioritizeSentence({ 'pl-to-en': empty, 'en-to-pl': empty }, 's1')).toBe(false);
  });

  test('declension: numeric and string ids for the same card are treated alike', () => {
    const store: DeclensionReviewDataStore = {
      cards: { 3: { cardId: 3, fsrsCard: ratedCard(RATED) } },
      reviewedToday: ['3', 4],
      newCardsToday: [3],
      lastReviewDate: '2026-11-26',
    };

    const next = reprioritizeDeclensionCard(store, 3, NOW);

    expect(next.cards[3].fsrsCard.state).toBe(State.New);
    expect(next.reviewedToday).toEqual([4]);
    expect(next.newCardsToday).toEqual([]);
    expect(canReprioritizeDeclensionCard(store, 3)).toBe(true);
    expect(canReprioritizeDeclensionCard(next, 3)).toBe(false);
    expect(reprioritizeDeclensionCard(next, 3, NOW)).toBe(next);
  });
});

describe('getOrCreate*ReviewData', () => {
  test('returns the saved progress when there is some, else a fresh new card for that id', () => {
    const saved = { fsrsCard: ratedCard(RATED) };
    const cases = [
      () => [
        reviewDataFor(
          vocabularyDeck,
          stub<VocabularyReviewDataStore>({ cards: { '5': { wordId: 5, ...saved } } }),
          5
        ),
        reviewDataFor(vocabularyDeck, stub<VocabularyReviewDataStore>({ cards: {} }), 6),
      ],
      () => [
        reviewDataFor(
          sentenceDeck,
          stub<SentenceReviewDataStore>({ cards: { s: { sentenceId: 's', ...saved } } }),
          's'
        ),
        reviewDataFor(sentenceDeck, stub<SentenceReviewDataStore>({ cards: {} }), 't'),
      ],
      () => [
        reviewDataFor(
          declensionDeck,
          stub<DeclensionReviewDataStore>({ cards: { 3: { cardId: 3, ...saved } } }),
          3
        ),
        reviewDataFor(declensionDeck, stub<DeclensionReviewDataStore>({ cards: {} }), 4),
      ],
      () => [
        reviewDataFor(
          conjugationDeck,
          stub<ConjugationReviewDataStore>({ cards: { f: { formKey: 'f', ...saved } } }),
          'f'
        ),
        reviewDataFor(conjugationDeck, stub<ConjugationReviewDataStore>({ cards: {} }), 'g'),
      ],
      () => [
        reviewDataFor(
          aspectPairsDeck,
          stub<AspectPairsReviewDataStore>({ cards: { v: { verbId: 'v', ...saved } } }),
          'v'
        ),
        reviewDataFor(aspectPairsDeck, stub<AspectPairsReviewDataStore>({ cards: {} }), 'w'),
      ],
    ];

    for (const run of cases) {
      const [existing, created] = run();
      expect(existing.fsrsCard).toBe(saved.fsrsCard);
      expect(created.fsrsCard.state).toBe(State.New);
      expect(created.fsrsCard.reps).toBe(0);
    }
    expect(
      reviewDataFor(vocabularyDeck, stub<VocabularyReviewDataStore>({ cards: {} }), 6)
    ).toMatchObject({ wordId: 6 });
    expect(
      reviewDataFor(conjugationDeck, stub<ConjugationReviewDataStore>({ cards: {} }), 'g')
    ).toMatchObject({ formKey: 'g' });
  });
});

describe('helpers', () => {
  test('today is the local calendar date, even after UTC has rolled over', () => {
    freezeTime('2026-11-26T23:30:00-05:00');
    expect(getTodayString()).toBe('2026-11-26');

    freezeTime('2026-01-01T00:00:00-05:00');
    expect(getTodayString()).toBe('2026-01-01');
  });

  test('session lists match numeric and string forms of the same id', () => {
    const words = stubs<VocabularyWord>([{ id: 5 }, { id: 50 }, { id: 'custom_1' }]);
    const store = stub<VocabularyReviewDataStore>({
      cards: {},
      reviewedToday: [],
      newCardsToday: ['5', 'custom_1'],
    });
    const buckets = placeItems(vocabularyDeck, words, store).map((p) => p.bucket);
    expect(buckets).toEqual([null, 'new', null]);
  });
});
