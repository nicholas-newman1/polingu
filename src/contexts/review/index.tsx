import { useState, useEffect, useCallback, useRef, memo, type ReactNode } from 'react';
import type { DeclensionCard } from '../../types';
import type { VocabularyWord } from '../../types/vocabulary';
import type { Sentence } from '../../types/sentences';
import type { Verb } from '../../types/conjugation';
import { getUserId } from '../../lib/storage/helpers';
import { useAuthContext } from '../../hooks/useAuthContext';
import { loadContentData, syncContentFromFirestore } from '../../lib/offlineDb/contentSync';
import {
  refreshAllUserDataFromFirestore,
  syncAllPendingToFirestore,
  cleanupLegacyReviewUserDataRows,
} from '../../lib/offlineDb/userDataWrapper';
import { refreshSentenceTagsFromFirestore } from '../../lib/storage/sentenceTags';
import {
  refreshAllReviewCardsFromFirestore,
  syncAllPendingReviewCards,
} from '../../lib/storage/reviewStorageRegistry';
import { DeclensionProvider, DeclensionContext, loadDeclensionData } from './DeclensionContext';
import { VocabularyProvider, VocabularyContext, loadVocabularyData } from './VocabularyContext';
import { SentenceProvider, SentenceContext, loadSentenceData } from './SentenceContext';
import { ConjugationProvider, ConjugationContext, loadConjugationData } from './ConjugationContext';
import { AspectPairsProvider, AspectPairsContext, loadAspectPairsData } from './AspectPairsContext';
import { ReviewCountsProvider, ReviewCountsContext } from './ReviewCountsContext';

export type { DeclensionContextType } from './DeclensionContext';
export type { VocabularyContextType } from './VocabularyContext';
export type { SentenceContextType } from './SentenceContext';
export type { ConjugationContextType } from './ConjugationContext';
export type { AspectPairsContextType } from './AspectPairsContext';
export type { ReviewCounts, ReviewCountsContextType } from './ReviewCountsContext';

export {
  DeclensionContext,
  VocabularyContext,
  SentenceContext,
  ConjugationContext,
  AspectPairsContext,
  ReviewCountsContext,
};

export interface ReviewDataProviderProps {
  children: ReactNode;
}

type Section<T extends () => Promise<unknown>> = Partial<Awaited<ReturnType<T>>>;

interface LoadedData {
  declensionData: Section<typeof loadDeclensionData>;
  vocabularyData: Section<typeof loadVocabularyData>;
  sentenceData: Section<typeof loadSentenceData>;
  conjugationData: Section<typeof loadConjugationData>;
  aspectPairsData: Section<typeof loadAspectPairsData>;
  systemDeclensionCards?: DeclensionCard[];
  systemWords?: VocabularyWord[];
  systemSentences?: Sentence[];
  verbs?: Verb[];
}

/** Signed-out users only get system content, so the user-data sections stay empty. */
const EMPTY_DATA: LoadedData = {
  declensionData: {},
  vocabularyData: {},
  sentenceData: {},
  conjugationData: {},
  aspectPairsData: {},
};

async function fetchAllData(): Promise<LoadedData> {
  const loadUserData = getUserId()
    ? Promise.all([
        loadDeclensionData(),
        loadVocabularyData(),
        loadSentenceData(),
        loadConjugationData(),
        loadAspectPairsData(),
      ])
    : null;
  const [userData, content] = await Promise.all([loadUserData, loadContentData()]);
  const [declensionData, vocabularyData, sentenceData, conjugationData, aspectPairsData] =
    userData ?? [];

  return {
    ...EMPTY_DATA,
    ...(userData && {
      declensionData,
      vocabularyData,
      sentenceData,
      conjugationData,
      aspectPairsData,
    }),
    systemDeclensionCards: content.declensionCards,
    systemWords: content.vocabulary,
    systemSentences: content.sentences,
    verbs: content.verbs,
  };
}

const MemoizedChildTree = memo(function MemoizedChildTree({ children }: { children: ReactNode }) {
  return children;
});

export function ReviewDataProvider({ children }: ReviewDataProviderProps) {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LoadedData | null>(null);

  const [prevUid, setPrevUid] = useState(user?.uid);
  if (prevUid !== user?.uid) {
    setPrevUid(user?.uid);
    setData(null);
    setLoading(true);
  }

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const syncInFlightRef = useRef(false);
  const freshDataAppliedRef = useRef(false);
  const performBackgroundSync = useCallback(async () => {
    if (!navigator.onLine || !getUserId()) return;
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    const syncUid = getUserId();
    try {
      await Promise.all([syncAllPendingToFirestore(), syncAllPendingReviewCards()]);
      await Promise.all([
        refreshAllUserDataFromFirestore(),
        refreshAllReviewCardsFromFirestore(),
        syncContentFromFirestore(),
        refreshSentenceTagsFromFirestore(),
      ]);
      const fresh = await fetchAllData();
      if (mountedRef.current && getUserId() === syncUid) {
        freshDataAppliedRef.current = true;
        setData(fresh);
      }
    } catch (e) {
      console.error('Background sync failed:', e);
    } finally {
      syncInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    freshDataAppliedRef.current = false;

    cleanupLegacyReviewUserDataRows().catch((e) => {
      console.error('Failed to remove legacy review IndexedDB rows:', e);
    });

    fetchAllData().then((result) => {
      if (!active) return;
      if (!freshDataAppliedRef.current) setData(result);
      setLoading(false);
      performBackgroundSync();
    });

    return () => {
      active = false;
    };
  }, [user?.uid, performBackgroundSync]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        performBackgroundSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', performBackgroundSync);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', performBackgroundSync);
    };
  }, [performBackgroundSync]);

  const d = data ?? EMPTY_DATA;

  return (
    <DeclensionProvider
      initialCustomCards={d.declensionData.customCards}
      initialSystemCards={d.systemDeclensionCards}
      initialReviewStore={d.declensionData.reviewData}
      initialSettings={d.declensionData.settings}
    >
      <VocabularyProvider
        initialCustomWords={d.vocabularyData.customWords}
        initialSystemWords={d.systemWords}
        initialReviewStores={d.vocabularyData.reviewStores}
        initialSettings={d.vocabularyData.settings}
      >
        <SentenceProvider
          initialCustomSentences={d.sentenceData.customSentences}
          initialSystemSentences={d.systemSentences}
          initialReviewStores={d.sentenceData.reviewStores}
          initialSettings={d.sentenceData.settings}
          initialTags={d.sentenceData.tags}
        >
          <ConjugationProvider
            initialVerbs={d.verbs}
            initialReviewStores={d.conjugationData.reviewStores}
            initialSettings={d.conjugationData.settings}
          >
            <AspectPairsProvider
              verbs={d.verbs}
              initialReviewStore={d.aspectPairsData.reviewData}
              initialSettings={d.aspectPairsData.settings}
            >
              <ReviewCountsProvider loading={loading}>
                <MemoizedChildTree>{children}</MemoizedChildTree>
              </ReviewCountsProvider>
            </AspectPairsProvider>
          </ConjugationProvider>
        </SentenceProvider>
      </VocabularyProvider>
    </DeclensionProvider>
  );
}
