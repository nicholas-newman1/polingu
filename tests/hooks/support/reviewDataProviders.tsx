/**
 * Renders a hook inside the real review-data providers (Declension, Vocabulary, Sentence,
 * Conjugation, AspectPairs, and the loading flag), seeded the way ReviewDataProvider seeds
 * them once loading finishes. Only the loading itself (IndexedDB, Firestore) is skipped.
 *
 * The providers open live custom-collection listeners for a signed-in user, so a test
 * file using this must mock those storage modules (the listeners are the boundary):
 *
 *   vi.mock('../../src/lib/storage/customVocabulary', () => ({
 *     loadCustomVocabulary: vi.fn(), subscribeCustomVocabulary: vi.fn() }));
 *   vi.mock('../../src/lib/storage/customDeclension', () => ({
 *     loadCustomDeclension: vi.fn(), subscribeCustomDeclension: vi.fn() }));
 *   vi.mock('../../src/lib/storage/customSentences', () => ({
 *     loadCustomSentences: vi.fn(), subscribeCustomSentences: vi.fn() }));
 *
 * `emitCustom*` then push a snapshot into the open listener, as Firestore does when a
 * custom item is added on this or another device. `remount` mounts the hook afresh under
 * the same (still mounted) providers, as when the learner opens another page.
 */
import { Fragment, type ComponentType, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { DeclensionProvider } from '../../../src/contexts/review/DeclensionContext';
import { VocabularyProvider } from '../../../src/contexts/review/VocabularyContext';
import { SentenceProvider } from '../../../src/contexts/review/SentenceContext';
import { ConjugationProvider } from '../../../src/contexts/review/ConjugationContext';
import { AspectPairsProvider } from '../../../src/contexts/review/AspectPairsContext';
import { ReviewDataLoadingContext } from '../../../src/contexts/review/ReviewDataLoadingContext';
import { SnackbarProvider } from '../../../src/contexts/SnackbarContext';
import {
  useAspectPairs,
  useConjugation,
  useDeclension,
  useReviewDataLoading,
  useSentences,
  useVocabulary,
} from '../../../src/hooks/useReviewData';
import { subscribeCustomVocabulary } from '../../../src/lib/storage/customVocabulary';
import { subscribeCustomDeclension } from '../../../src/lib/storage/customDeclension';
import { subscribeCustomSentences } from '../../../src/lib/storage/customSentences';
import type {
  CustomDeclensionCard,
  DeclensionCard,
  DeclensionReviewDataStore,
  DeclensionSettings,
} from '../../../src/types';
import type {
  CardReviewData,
  ReviewDataStore,
  SessionId,
  TranslationDirection,
} from '../../../src/types/common';
import type {
  CustomVocabularyWord,
  VocabularyReviewDataStore,
  VocabularySettings,
  VocabularyWord,
} from '../../../src/types/vocabulary';
import type {
  CustomSentence,
  Sentence,
  SentenceReviewDataStore,
  SentenceSettings,
} from '../../../src/types/sentences';
import type {
  ConjugationReviewDataStore,
  ConjugationSettings,
  Verb,
} from '../../../src/types/conjugation';
import type {
  AspectPairsReviewDataStore,
  AspectPairsSettings,
} from '../../../src/types/aspectPairs';
import { signInFakeUser, signOutFakeUser } from '../../fakes/firebase';
import { withAuth } from './providers';
import { emptyReviewStore } from '../../../src/lib/storage/reviewDeckStorage';

type ByDirection<T> = Partial<Record<TranslationDirection, T>>;

/** Every review context at once, with the loading flag, for tests that read across decks. */
export function useAllReviewData() {
  return {
    loading: useReviewDataLoading(),
    declension: useDeclension(),
    vocabulary: useVocabulary(),
    sentences: useSentences(),
    conjugation: useConjugation(),
    aspectPairs: useAspectPairs(),
  };
}

export type ReviewData = ReturnType<typeof useAllReviewData>;

/** What ReviewDataProvider would have loaded. Anything left out gets the provider's default. */
export interface ReviewDataSeed {
  systemDeclensionCards?: DeclensionCard[];
  customDeclensionCards?: CustomDeclensionCard[];
  declensionStore?: DeclensionReviewDataStore;
  declensionSettings?: DeclensionSettings;
  systemWords?: VocabularyWord[];
  customWords?: CustomVocabularyWord[];
  vocabularyStores?: ByDirection<VocabularyReviewDataStore>;
  vocabularySettings?: VocabularySettings;
  systemSentences?: Sentence[];
  customSentences?: CustomSentence[];
  sentenceStores?: ByDirection<SentenceReviewDataStore>;
  sentenceSettings?: SentenceSettings;
  verbs?: Verb[];
  conjugationStores?: ByDirection<ConjugationReviewDataStore>;
  conjugationSettings?: ConjugationSettings;
  aspectPairsStore?: AspectPairsReviewDataStore;
  aspectPairsSettings?: AspectPairsSettings;
  loading?: boolean;
}

const bothDirections = <R extends CardReviewData, Id extends SessionId>(
  given: ByDirection<ReviewDataStore<R, Id>> | undefined
) =>
  given && {
    'pl-to-en': given['pl-to-en'] ?? emptyReviewStore<R, Id>(),
    'en-to-pl': given['en-to-pl'] ?? emptyReviewStore<R, Id>(),
  };

/** Provider props for a seed, built once so their identity is stable across renders. */
function toProviderProps(seed: ReviewDataSeed) {
  return {
    ...seed,
    vocabularyStores: bothDirections(seed.vocabularyStores),
    sentenceStores: bothDirections(seed.sentenceStores),
    conjugationStores: bothDirections(seed.conjugationStores),
  };
}

/** Captures the listener a provider opens, so the test can push snapshots into it. */
function captureListener<T>(
  subscribe: (onChange: (items: T[]) => void) => () => void
): (items: T[]) => void {
  let listener: ((items: T[]) => void) | null = null;
  vi.mocked(subscribe).mockImplementation((onChange) => {
    listener = onChange;
    return () => {
      if (listener === onChange) listener = null;
    };
  });
  return (items) => {
    const current = listener;
    if (!current) throw new Error('No custom-collection listener is open');
    act(() => current(items));
  };
}

interface Options {
  /** The signed-in learner, or null for a signed-out visitor. */
  uid?: string | null;
  /** Page-level providers that sit inside the review data in the app (filters, snackbar). */
  wrapper?: ComponentType<{ children: ReactNode }>;
}

export function renderWithReviewData<T>(
  useHook: () => T,
  seed: ReviewDataSeed = {},
  { uid = 'learner', wrapper: Inner }: Options = {}
) {
  if (uid) signInFakeUser(uid);
  else signOutFakeUser();
  const auth = withAuth(uid);
  const emitCustomWords = captureListener(subscribeCustomVocabulary);
  const emitCustomDeclensionCards = captureListener(subscribeCustomDeclension);
  const emitCustomSentences = captureListener(subscribeCustomSentences);

  let props = toProviderProps(seed);
  let mountKey = 0;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <SnackbarProvider>
      <auth.wrapper>
        <DeclensionProvider
          initialSystemCards={props.systemDeclensionCards}
          initialCustomCards={props.customDeclensionCards}
          initialReviewStore={props.declensionStore}
          initialSettings={props.declensionSettings}
        >
          <VocabularyProvider
            initialSystemWords={props.systemWords}
            initialCustomWords={props.customWords}
            initialReviewStores={props.vocabularyStores}
            initialSettings={props.vocabularySettings}
          >
            <SentenceProvider
              initialSystemSentences={props.systemSentences}
              initialCustomSentences={props.customSentences}
              initialReviewStores={props.sentenceStores}
              initialSettings={props.sentenceSettings}
            >
              <ConjugationProvider
                initialVerbs={props.verbs}
                initialReviewStores={props.conjugationStores}
                initialSettings={props.conjugationSettings}
              >
                <AspectPairsProvider
                  verbs={props.verbs}
                  initialReviewStore={props.aspectPairsStore}
                  initialSettings={props.aspectPairsSettings}
                >
                  <ReviewDataLoadingContext.Provider value={props.loading ?? false}>
                    {Inner ? (
                      <Inner>
                        <Fragment key={mountKey}>{children}</Fragment>
                      </Inner>
                    ) : (
                      <Fragment key={mountKey}>{children}</Fragment>
                    )}
                  </ReviewDataLoadingContext.Provider>
                </AspectPairsProvider>
              </ConjugationProvider>
            </SentenceProvider>
          </VocabularyProvider>
        </DeclensionProvider>
      </auth.wrapper>
    </SnackbarProvider>
  );

  const hook = renderHook(useHook, { wrapper });

  return {
    ...hook,
    /** Replaces the loaded data, as ReviewDataProvider does after a background sync. */
    reseed: (next: ReviewDataSeed) => {
      props = toProviderProps(next);
      hook.rerender();
    },
    /** Unmounts the hook and mounts it again, keeping the providers and their state. */
    remount: () => {
      mountKey++;
      hook.rerender();
    },
    emitCustomWords,
    emitCustomDeclensionCards,
    emitCustomSentences,
  };
}
