import { describe, expect, test } from 'vitest';
import { createEmptyCard, State } from 'ts-fsrs';
import reprioritizeVocabularyWord, {
  canReprioritizeVocabularyWord,
} from '../../src/lib/storage/reprioritizeVocabularyWord';
import reprioritizeSentence, {
  canReprioritizeSentence,
} from '../../src/lib/storage/reprioritizeSentence';
import reprioritizeDeclensionCard, {
  canReprioritizeDeclensionCard,
} from '../../src/lib/storage/reprioritizeDeclensionCard';
import getOrCreateVocabularyCardReviewData from '../../src/lib/storage/getOrCreateVocabularyCardReviewData';
import getOrCreateSentenceCardReviewData from '../../src/lib/storage/getOrCreateSentenceCardReviewData';
import getOrCreateDeclensionCardReviewData from '../../src/lib/storage/getOrCreateDeclensionCardReviewData';
import getOrCreateConjugationFormReviewData from '../../src/lib/storage/getOrCreateConjugationFormReviewData';
import getOrCreateAspectPairsCardReviewData from '../../src/lib/storage/getOrCreateAspectPairsCardReviewData';
import {
  getDefaultVocabularyReviewStore,
  getTodayString,
  includesDeclensionCardId,
  includesWordId,
} from '../../src/lib/storage/helpers';
import type { VocabularyReviewDataStore } from '../../src/types/vocabulary';
import type { SentenceReviewDataStore } from '../../src/types/sentences';
import type { DeclensionReviewDataStore } from '../../src/types';
import type { ConjugationReviewDataStore } from '../../src/types/conjugation';
import type { AspectPairsReviewDataStore } from '../../src/types/aspectPairs';
import { stub } from '../helpers/stub';
import { freezeTime, ratedCard } from './support/harness';

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

describe('"Review again" puts a studied card back in the new queue', () => {
  test("vocabulary: the card becomes new, due now, and leaves today's counters", () => {
    const next = reprioritizeVocabularyWord(vocabStore(), 5, NOW);

    expect(next.cards[5].fsrsCard.state).toBe(State.New);
    expect(next.cards[5].fsrsCard.due).toEqual(NOW);
    expect(next.reviewedToday).toEqual([6]);
    expect(next.newCardsToday).toEqual([6]);
    expect(next.cards[6]).toEqual(vocabStore().cards[6]);
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
    const empty = getDefaultVocabularyReviewStore();

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
        getOrCreateVocabularyCardReviewData(
          5,
          stub<VocabularyReviewDataStore>({ cards: { '5': { wordId: 5, ...saved } } })
        ),
        getOrCreateVocabularyCardReviewData(6, stub<VocabularyReviewDataStore>({ cards: {} })),
      ],
      () => [
        getOrCreateSentenceCardReviewData(
          's',
          stub<SentenceReviewDataStore>({ cards: { s: { sentenceId: 's', ...saved } } })
        ),
        getOrCreateSentenceCardReviewData('t', stub<SentenceReviewDataStore>({ cards: {} })),
      ],
      () => [
        getOrCreateDeclensionCardReviewData(
          3,
          stub<DeclensionReviewDataStore>({ cards: { 3: { cardId: 3, ...saved } } })
        ),
        getOrCreateDeclensionCardReviewData(4, stub<DeclensionReviewDataStore>({ cards: {} })),
      ],
      () => [
        getOrCreateConjugationFormReviewData(
          'f',
          stub<ConjugationReviewDataStore>({ forms: { f: { formKey: 'f', ...saved } } })
        ),
        getOrCreateConjugationFormReviewData('g', stub<ConjugationReviewDataStore>({ forms: {} })),
      ],
      () => [
        getOrCreateAspectPairsCardReviewData(
          'v',
          stub<AspectPairsReviewDataStore>({ cards: { v: { verbId: 'v', ...saved } } })
        ),
        getOrCreateAspectPairsCardReviewData('w', stub<AspectPairsReviewDataStore>({ cards: {} })),
      ],
    ];

    for (const run of cases) {
      const [existing, created] = run();
      expect(existing.fsrsCard).toBe(saved.fsrsCard);
      expect(created.fsrsCard.state).toBe(State.New);
      expect(created.fsrsCard.reps).toBe(0);
    }
    expect(
      getOrCreateVocabularyCardReviewData(6, stub<VocabularyReviewDataStore>({ cards: {} }))
    ).toMatchObject({ wordId: 6 });
    expect(
      getOrCreateConjugationFormReviewData('g', stub<ConjugationReviewDataStore>({ forms: {} }))
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

  test('id lookups match numeric and string forms of the same id', () => {
    expect(includesWordId([5, 'custom_1'], '5')).toBe(true);
    expect(includesWordId(['5'], 5)).toBe(true);
    expect(includesWordId([50], 5)).toBe(false);
    expect(includesDeclensionCardId(['3'], 3)).toBe(true);
  });
});
