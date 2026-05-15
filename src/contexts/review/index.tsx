import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
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

interface LoadedData {
  declensionData?: Awaited<ReturnType<typeof loadDeclensionData>>;
  vocabularyData?: Awaited<ReturnType<typeof loadVocabularyData>>;
  sentenceData?: Awaited<ReturnType<typeof loadSentenceData>>;
  conjugationData?: Awaited<ReturnType<typeof loadConjugationData>>;
  aspectPairsData?: Awaited<ReturnType<typeof loadAspectPairsData>>;
  systemDeclensionCards: DeclensionCard[];
  systemWords: VocabularyWord[];
  systemSentences: Sentence[];
  verbs: Verb[];
}

export function ReviewDataProvider({ children }: ReviewDataProviderProps) {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LoadedData | null>(null);

  const fetchAllData = useCallback(async (): Promise<LoadedData> => {
    const userId = getUserId();

    if (userId) {
      const [
        loadedDeclensionData,
        loadedVocabularyData,
        loadedSentenceData,
        loadedConjugationData,
        loadedAspectPairsData,
        content,
      ] = await Promise.all([
        loadDeclensionData(),
        loadVocabularyData(),
        loadSentenceData(),
        loadConjugationData(),
        loadAspectPairsData(),
        loadContentData(),
      ]);

      return {
        declensionData: loadedDeclensionData,
        vocabularyData: loadedVocabularyData,
        sentenceData: loadedSentenceData,
        conjugationData: loadedConjugationData,
        aspectPairsData: loadedAspectPairsData,
        systemDeclensionCards: content.declensionCards,
        systemWords: content.vocabulary,
        systemSentences: content.sentences,
        verbs: content.verbs,
      };
    }

    const content = await loadContentData();
    return {
      systemDeclensionCards: content.declensionCards,
      systemWords: content.vocabulary,
      systemSentences: content.sentences,
      verbs: content.verbs,
    };
  }, []);

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
  const performBackgroundSync = useCallback(async () => {
    if (!navigator.onLine || !getUserId()) return;
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    try {
      await syncAllPendingToFirestore();
      await Promise.all([
        refreshAllUserDataFromFirestore(),
        syncContentFromFirestore(),
        refreshSentenceTagsFromFirestore(),
      ]);
      const fresh = await fetchAllData();
      if (mountedRef.current && fresh) {
        setData(fresh);
      }
    } catch (e) {
      console.error('Background sync failed:', e);
    } finally {
      syncInFlightRef.current = false;
    }
  }, [fetchAllData]);

  useEffect(() => {
    let active = true;

    cleanupLegacyReviewUserDataRows().catch((e) => {
      console.error('Failed to remove legacy review IndexedDB rows:', e);
    });

    fetchAllData().then((result) => {
      if (!active) return;
      setData(result);
      setLoading(false);
      performBackgroundSync();
    });

    return () => {
      active = false;
    };
  }, [user?.uid, fetchAllData, performBackgroundSync]);

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

  return (
    <DeclensionProvider
      initialCustomCards={data?.declensionData?.customCards}
      initialSystemCards={data?.systemDeclensionCards}
      initialReviewStore={data?.declensionData?.reviewData}
      initialSettings={data?.declensionData?.settings}
    >
      <VocabularyProvider
        initialCustomWords={data?.vocabularyData?.customWords}
        initialSystemWords={data?.systemWords}
        initialReviewStores={data?.vocabularyData?.reviewStores}
        initialSettings={data?.vocabularyData?.settings}
      >
        <SentenceProvider
          initialCustomSentences={data?.sentenceData?.customSentences}
          initialSystemSentences={data?.systemSentences}
          initialReviewStores={data?.sentenceData?.reviewStores}
          initialSettings={data?.sentenceData?.settings}
          initialTags={data?.sentenceData?.tags}
        >
          <ConjugationProvider
            initialVerbs={data?.verbs}
            initialReviewStores={data?.conjugationData?.reviewStores}
            initialSettings={data?.conjugationData?.settings}
          >
            <AspectPairsProvider
              verbs={data?.verbs}
              initialReviewStore={data?.aspectPairsData?.reviewData}
              initialSettings={data?.aspectPairsData?.settings}
            >
              <ReviewCountsProvider loading={loading}>{children}</ReviewCountsProvider>
            </AspectPairsProvider>
          </ConjugationProvider>
        </SentenceProvider>
      </VocabularyProvider>
    </DeclensionProvider>
  );
}
