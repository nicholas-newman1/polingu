import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useAspectPairs,
  useConjugation,
  useDeclension,
  useReviewData,
  useSentences,
  useVocabulary,
} from '../../src/hooks/useReviewData';
import { DeclensionProvider } from '../../src/contexts/review/DeclensionContext';
import { VocabularyProvider } from '../../src/contexts/review/VocabularyContext';
import { SentenceProvider } from '../../src/contexts/review/SentenceContext';
import { ConjugationProvider } from '../../src/contexts/review/ConjugationContext';
import { AspectPairsProvider } from '../../src/contexts/review/AspectPairsContext';
import type { CustomDeclensionCard, DeclensionCard } from '../../src/types';
import type { CustomVocabularyWord, VocabularyWord } from '../../src/types/vocabulary';
import type { CustomSentence, Sentence } from '../../src/types/sentences';
import type { Verb } from '../../src/types/conjugation';
import { fsrsCard, inDays, State } from '../helpers/fsrs';
import { stub, stubs } from '../helpers/stub';
import { withAuth } from './support/providers';
import { renderWithReviewData } from './support/reviewDataProviders';

// The providers' live custom-collection listeners are the Firestore boundary.
vi.mock('../../src/lib/storage/customVocabulary', () => ({
  loadCustomVocabulary: vi.fn(),
  subscribeCustomVocabulary: vi.fn(),
}));
vi.mock('../../src/lib/storage/customDeclension', () => ({
  loadCustomDeclension: vi.fn(),
  subscribeCustomDeclension: vi.fn(),
}));
vi.mock('../../src/lib/storage/customSentences', () => ({
  loadCustomSentences: vi.fn(),
  subscribeCustomSentences: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-10T12:00:00'));
  // React reports the error thrown by a hook used outside its provider; keep the log quiet.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const systemWords = stubs<VocabularyWord>([{ id: 1 }, { id: 2 }]);
const customWords = stubs<CustomVocabularyWord>([{ id: 'custom_w', isCustom: true }]);
const systemDeclensionCards = stubs<DeclensionCard>([{ id: 10 }]);
const customDeclensionCards = stubs<CustomDeclensionCard>([{ id: 'custom_d', isCustom: true }]);
const systemSentences = stubs<Sentence>([{ id: 's1', level: 'A1' }]);
const customSentences = stubs<CustomSentence>([{ id: 'custom_s', level: 'A1', isCustom: true }]);
const verbs = [
  stub<Verb>({ id: 'robic', aspectPair: 'zrobic', conjugations: {} }),
  stub<Verb>({ id: 'zrobic', aspectPair: 'robic', conjugations: {} }),
];

const ids = (items: Array<{ id: string | number }>) => items.map((item) => item.id);

describe('useReviewData', () => {
  test('combines every review section, listing custom items before built-in ones', () => {
    const { result } = renderWithReviewData(useReviewData, {
      systemWords,
      customWords,
      systemDeclensionCards,
      customDeclensionCards,
      systemSentences,
      customSentences,
      verbs,
    });
    const data = result.current;

    expect(ids(data.vocabularyWords)).toEqual(['custom_w', 1, 2]);
    expect(ids(data.customWords)).toEqual(['custom_w']);
    expect(ids(data.systemWords)).toEqual([1, 2]);
    expect(ids(data.declensionCards)).toEqual(['custom_d', 10]);
    expect(ids(data.sentences)).toEqual(['custom_s', 's1']);
    expect(ids(data.verbs)).toEqual(['robic', 'zrobic']);
    expect(data.aspectPairCards.map(({ verb, pairVerb }) => [verb.id, pairVerb.id])).toEqual([
      ['robic', 'zrobic'],
    ]);
  });

  test('passes through the loading flag of the review data provider', () => {
    const loading = renderWithReviewData(useReviewData, { loading: true });
    expect(loading.result.current.loading).toBe(true);

    const loaded = renderWithReviewData(useReviewData, { loading: false });
    expect(loaded.result.current.loading).toBe(false);
  });

  test('exposes review counts that add up both directions', () => {
    const { result } = renderWithReviewData(useReviewData, {
      systemWords,
      vocabularySettings: {
        'pl-to-en': { newCardsPerDay: 0 },
        'en-to-pl': { newCardsPerDay: 1 },
      },
      vocabularyStores: {
        'pl-to-en': {
          cards: { 1: { wordId: 1, fsrsCard: fsrsCard(State.Review, inDays(-2)) } },
          reviewedToday: [],
          newCardsToday: [],
          lastReviewDate: '2026-03-10',
        },
      },
    });

    // pl-to-en: word 1 is overdue; en-to-pl: one new word is allowed.
    expect(result.current.counts.vocabulary).toBe(2);
  });

  test('review counts are zero for a signed-out visitor, who has no reviews to do', () => {
    const { result } = renderWithReviewData(
      useReviewData,
      { systemWords, systemSentences, verbs },
      { uid: null }
    );

    expect(result.current.counts).toEqual({
      declension: 0,
      vocabulary: 0,
      sentences: 0,
      conjugation: 0,
      aspectPairs: 0,
    });
    // The content itself is still there to browse.
    expect(result.current.vocabularyWords).toHaveLength(2);
  });

  test('throws a clear error when used outside ReviewDataProvider', () => {
    expect(() => renderHook(useReviewData)).toThrow(
      'useDeclension must be used within a ReviewDataProvider'
    );
  });

  test('throws when the review counts are missing, even inside the section providers', () => {
    const auth = withAuth(null);
    const sectionsOnly = ({ children }: { children: ReactNode }) => (
      <auth.wrapper>
        <DeclensionProvider>
          <VocabularyProvider>
            <SentenceProvider>
              <ConjugationProvider>
                <AspectPairsProvider>{children}</AspectPairsProvider>
              </ConjugationProvider>
            </SentenceProvider>
          </VocabularyProvider>
        </DeclensionProvider>
      </auth.wrapper>
    );

    expect(() => renderHook(useReviewData, { wrapper: sectionsOnly })).toThrow(
      'useReviewCounts must be used within a ReviewDataProvider'
    );
  });

  test.each<[string, () => unknown]>([
    ['useDeclension', useDeclension],
    ['useVocabulary', useVocabulary],
    ['useSentences', useSentences],
    ['useConjugation', useConjugation],
    ['useAspectPairs', useAspectPairs],
  ])('%s throws a clear error outside ReviewDataProvider', (name, useSection) => {
    expect(() => renderHook(useSection)).toThrow(
      `${name} must be used within a ReviewDataProvider`
    );
  });

  test("hands on every section's data and actions unchanged, none hiding another's", () => {
    const { result } = renderWithReviewData(
      () => ({
        all: useReviewData(),
        sections: [
          useDeclension(),
          useVocabulary(),
          useSentences(),
          useConjugation(),
          useAspectPairs(),
        ],
      }),
      { systemWords, customWords, systemDeclensionCards, systemSentences, verbs }
    );
    const { all, sections } = result.current;

    const keys = sections.flatMap((section) => Object.keys(section));
    expect(new Set(keys).size).toBe(keys.length);
    for (const section of sections) {
      for (const [key, value] of Object.entries(section)) {
        expect(all[key as keyof typeof all], key).toBe(value);
      }
    }
  });

  test('each section hook returns its own section of the review data', () => {
    const { result } = renderWithReviewData(
      () => ({
        declension: useDeclension(),
        vocabulary: useVocabulary(),
        sentences: useSentences(),
        conjugation: useConjugation(),
        aspectPairs: useAspectPairs(),
      }),
      { systemWords, systemDeclensionCards, systemSentences, verbs }
    );

    expect(ids(result.current.declension.declensionCards)).toEqual([10]);
    expect(ids(result.current.vocabulary.vocabularyWords)).toEqual([1, 2]);
    expect(ids(result.current.sentences.sentences)).toEqual(['s1']);
    expect(ids(result.current.conjugation.verbs)).toEqual(['robic', 'zrobic']);
    expect(result.current.aspectPairs.aspectPairCards).toHaveLength(1);
  });
});
