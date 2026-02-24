import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { DeclensionCard } from '../../types';
import type { VocabularyWord } from '../../types/vocabulary';
import type { Sentence } from '../../types/sentences';
import type { Verb } from '../../types/conjugation';
import { getUserId } from '../../lib/storage/helpers';
import {
  hasCachedContent,
  loadCachedContent,
  syncContentFromFirestore,
} from '../../lib/offlineDb/contentSync';
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
  declensionData: Awaited<ReturnType<typeof loadDeclensionData>>;
  vocabularyData: Awaited<ReturnType<typeof loadVocabularyData>>;
  sentenceData: Awaited<ReturnType<typeof loadSentenceData>>;
  conjugationData: Awaited<ReturnType<typeof loadConjugationData>>;
  aspectPairsData: Awaited<ReturnType<typeof loadAspectPairsData>>;
  systemDeclensionCards: DeclensionCard[];
  systemWords: VocabularyWord[];
  systemSentences: Sentence[];
  verbs: Verb[];
}

export function ReviewDataProvider({ children }: ReviewDataProviderProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LoadedData | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Load content (sentences, verbs, vocabulary, declension cards) using IndexedDB-first strategy
  const loadContentData = useCallback(async (): Promise<{
    systemDeclensionCards: DeclensionCard[];
    systemWords: VocabularyWord[];
    systemSentences: Sentence[];
    verbs: Verb[];
  }> => {
    const hasCached = await hasCachedContent();

    if (hasCached) {
      // Load from IndexedDB first (instant)
      const cached = await loadCachedContent();

      // Sync from Firestore in background if online (don't await)
      if (navigator.onLine) {
        syncContentFromFirestore()
          .then(async (fresh) => {
            // Update state with fresh data after background sync completes
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    systemDeclensionCards: fresh.declensionCards,
                    systemWords: fresh.vocabulary,
                    systemSentences: fresh.sentences,
                    verbs: fresh.verbs,
                  }
                : null
            );
          })
          .catch((e) => console.error('Background content sync failed:', e));
      }

      return {
        systemDeclensionCards: cached.declensionCards,
        systemWords: cached.vocabulary,
        systemSentences: cached.sentences,
        verbs: cached.verbs,
      };
    } else {
      // No cache - need to fetch from Firestore (first time use)
      if (navigator.onLine) {
        const fresh = await syncContentFromFirestore();
        return {
          systemDeclensionCards: fresh.declensionCards,
          systemWords: fresh.vocabulary,
          systemSentences: fresh.sentences,
          verbs: fresh.verbs,
        };
      } else {
        // Offline with no cache - return empty (will show offline message)
        console.warn('Offline with no cached content');
        return {
          systemDeclensionCards: [],
          systemWords: [],
          systemSentences: [],
          verbs: [],
        };
      }
    }
  }, []);

  const loadAllData = useCallback(async () => {
    console.log('[ReviewData] loadAllData starting');
    const userId = getUserId();
    if (!userId) {
      console.log('[ReviewData] No userId, skipping load');
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('[ReviewData] Loading user review data and content...');

    // Load user review data and content data in parallel
    const [
      loadedDeclensionData,
      loadedVocabularyData,
      loadedSentenceData,
      loadedConjugationData,
      loadedAspectPairsData,
      contentData,
    ] = await Promise.all([
      loadDeclensionData(),
      loadVocabularyData(),
      loadSentenceData(),
      loadConjugationData(),
      loadAspectPairsData(),
      loadContentData(),
    ]);

    console.log('[ReviewData] All data loaded successfully');

    setData({
      declensionData: loadedDeclensionData,
      vocabularyData: loadedVocabularyData,
      sentenceData: loadedSentenceData,
      conjugationData: loadedConjugationData,
      aspectPairsData: loadedAspectPairsData,
      ...contentData,
    });

    setLoading(false);
    setInitialLoadComplete(true);
    console.log('[ReviewData] loadAllData complete');
  }, [loadContentData]);

  useEffect(() => {
    void loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync content when coming back online (only after initial load)
  useEffect(() => {
    if (!initialLoadComplete) return;

    const handleOnline = () => {
      syncContentFromFirestore()
        .then((fresh) => {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  systemDeclensionCards: fresh.declensionCards,
                  systemWords: fresh.vocabulary,
                  systemSentences: fresh.sentences,
                  verbs: fresh.verbs,
                }
              : null
          );
        })
        .catch((e) => console.error('Content sync on reconnect failed:', e));
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [initialLoadComplete]);

  // Use key to force remount when data loads, ensuring initial props take effect
  const key = data ? 'loaded' : 'loading';

  return (
    <DeclensionProvider
      key={`declension-${key}`}
      initialCustomCards={data?.declensionData.customCards}
      initialSystemCards={data?.systemDeclensionCards}
      initialReviewStore={data?.declensionData.reviewData}
      initialSettings={data?.declensionData.settings}
    >
      <VocabularyProvider
        key={`vocabulary-${key}`}
        initialCustomWords={data?.vocabularyData.customWords}
        initialSystemWords={data?.systemWords}
        initialReviewStores={data?.vocabularyData.reviewStores}
        initialSettings={data?.vocabularyData.settings}
      >
        <SentenceProvider
          key={`sentence-${key}`}
          initialCustomSentences={data?.sentenceData.customSentences}
          initialSystemSentences={data?.systemSentences}
          initialReviewStores={data?.sentenceData.reviewStores}
          initialSettings={data?.sentenceData.settings}
          initialTags={data?.sentenceData.tags}
        >
          <ConjugationProvider
            key={`conjugation-${key}`}
            initialVerbs={data?.verbs}
            initialReviewStores={data?.conjugationData.reviewStores}
            initialSettings={data?.conjugationData.settings}
          >
            <AspectPairsProvider
              key={`aspectPairs-${key}`}
              verbs={data?.verbs ?? []}
              initialReviewStore={data?.aspectPairsData.reviewData}
              initialSettings={data?.aspectPairsData.settings}
            >
              <ReviewCountsProvider loading={loading}>{children}</ReviewCountsProvider>
            </AspectPairsProvider>
          </ConjugationProvider>
        </SentenceProvider>
      </VocabularyProvider>
    </DeclensionProvider>
  );
}
