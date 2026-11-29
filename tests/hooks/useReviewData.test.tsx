import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useAspectPairs,
  useConjugation,
  useDeclension,
  useReviewDataLoading,
  useSentences,
  useVocabulary,
} from '../../src/hooks/useReviewData';
import { DeclensionProvider } from '../../src/contexts/review/DeclensionContext';
import { VocabularyProvider } from '../../src/contexts/review/VocabularyContext';
import { SentenceProvider } from '../../src/contexts/review/SentenceContext';
import { ConjugationProvider } from '../../src/contexts/review/ConjugationContext';
import { AspectPairsProvider } from '../../src/contexts/review/AspectPairsContext';
import { SnackbarProvider } from '../../src/contexts/SnackbarContext';
import type { CustomDeclensionCard, DeclensionCard } from '../../src/types';
import type { CustomVocabularyWord, VocabularyWord } from '../../src/types/vocabulary';
import type { CustomSentence, Sentence } from '../../src/types/sentences';
import type { Verb } from '../../src/types/conjugation';
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

describe('the review data hooks', () => {
  test('each deck hook returns its own deck, listing custom items before built-in ones', () => {
    const { result } = renderWithReviewData(
      () => ({
        declension: useDeclension(),
        vocabulary: useVocabulary(),
        sentences: useSentences(),
        conjugation: useConjugation(),
        aspectPairs: useAspectPairs(),
      }),
      {
        systemWords,
        customWords,
        systemDeclensionCards,
        customDeclensionCards,
        systemSentences,
        customSentences,
        verbs,
      }
    );
    const { declension, vocabulary, sentences, conjugation, aspectPairs } = result.current;

    expect(ids(vocabulary.words)).toEqual(['custom_w', 1, 2]);
    expect(ids(vocabulary.customWords)).toEqual(['custom_w']);
    expect(ids(vocabulary.systemWords)).toEqual([1, 2]);
    expect(ids(declension.cards)).toEqual(['custom_d', 10]);
    expect(ids(sentences.sentences)).toEqual(['custom_s', 's1']);
    expect(ids(conjugation.verbs)).toEqual(['robic', 'zrobic']);
    expect(aspectPairs.cards.map(({ verb, pairVerb }) => [verb.id, pairVerb.id])).toEqual([
      ['robic', 'zrobic'],
    ]);
  });

  test('useReviewDataLoading passes through the loading flag of the review data provider', () => {
    const loading = renderWithReviewData(useReviewDataLoading, { loading: true });
    expect(loading.result.current).toBe(true);

    const loaded = renderWithReviewData(useReviewDataLoading, { loading: false });
    expect(loaded.result.current).toBe(false);
  });

  test('useReviewDataLoading throws when the loading flag is missing, even inside the deck providers', () => {
    const auth = withAuth(null);
    const decksOnly = ({ children }: { children: ReactNode }) => (
      <SnackbarProvider>
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
      </SnackbarProvider>
    );

    expect(() => renderHook(useReviewDataLoading, { wrapper: decksOnly })).toThrow(
      'useReviewDataLoading must be used within a ReviewDataProvider'
    );
  });

  test.each<[string, () => unknown]>([
    ['useDeclension', useDeclension],
    ['useVocabulary', useVocabulary],
    ['useSentences', useSentences],
    ['useConjugation', useConjugation],
    ['useAspectPairs', useAspectPairs],
    ['useReviewDataLoading', useReviewDataLoading],
  ])('%s throws a clear error outside ReviewDataProvider', (name, useSection) => {
    expect(() => renderHook(useSection)).toThrow(
      `${name} must be used within a ReviewDataProvider`
    );
  });
});
