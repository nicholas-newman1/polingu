import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { DeclensionCard } from '../../types';
import type { VocabularyWord } from '../../types/vocabulary';
import type { Sentence } from '../../types/sentences';
import type { Verb } from '../../types/conjugation';
import { getUserId } from '../../lib/storage/helpers';
import { useAuthContext } from '../../hooks/useAuthContext';
import { loadContentData } from '../../lib/offlineDb/contentSync';
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

  useEffect(() => {
    let active = true;

    fetchAllData().then((result) => {
      if (active) {
        setData(result);
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [user?.uid, fetchAllData]);

  // Use key to force remount when data loads, ensuring initial props take effect
  const key = data ? 'loaded' : 'loading';

  return (
    <DeclensionProvider
      key={`declension-${key}`}
      initialCustomCards={data?.declensionData?.customCards}
      initialSystemCards={data?.systemDeclensionCards}
      initialReviewStore={data?.declensionData?.reviewData}
      initialSettings={data?.declensionData?.settings}
    >
      <VocabularyProvider
        key={`vocabulary-${key}`}
        initialCustomWords={data?.vocabularyData?.customWords}
        initialSystemWords={data?.systemWords}
        initialReviewStores={data?.vocabularyData?.reviewStores}
        initialSettings={data?.vocabularyData?.settings}
      >
        <SentenceProvider
          key={`sentence-${key}`}
          initialCustomSentences={data?.sentenceData?.customSentences}
          initialSystemSentences={data?.systemSentences}
          initialReviewStores={data?.sentenceData?.reviewStores}
          initialSettings={data?.sentenceData?.settings}
          initialTags={data?.sentenceData?.tags}
        >
          <ConjugationProvider
            key={`conjugation-${key}`}
            initialVerbs={data?.verbs}
            initialReviewStores={data?.conjugationData?.reviewStores}
            initialSettings={data?.conjugationData?.settings}
          >
            <AspectPairsProvider
              key={`aspectPairs-${key}`}
              verbs={data?.verbs ?? []}
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
