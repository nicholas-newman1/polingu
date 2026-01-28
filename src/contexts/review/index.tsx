import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { DeclensionCard } from '../../types';
import type { VocabularyWord } from '../../types/vocabulary';
import type { Sentence } from '../../types/sentences';
import type { Verb } from '../../types/conjugation';
import { getUserId } from '../../lib/storage/helpers';
import { DeclensionProvider, DeclensionContext, loadDeclensionData } from './DeclensionContext';
import { VocabularyProvider, VocabularyContext, loadVocabularyData } from './VocabularyContext';
import { SentenceProvider, SentenceContext, loadSentenceData } from './SentenceContext';
import { ConjugationProvider, ConjugationContext, loadConjugationData } from './ConjugationContext';
import { ReviewCountsProvider, ReviewCountsContext } from './ReviewCountsContext';

export type { DeclensionContextType } from './DeclensionContext';
export type { VocabularyContextType } from './VocabularyContext';
export type { SentenceContextType } from './SentenceContext';
export type { ConjugationContextType } from './ConjugationContext';
export type { ReviewCounts, ReviewCountsContextType } from './ReviewCountsContext';

export {
  DeclensionContext,
  VocabularyContext,
  SentenceContext,
  ConjugationContext,
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
  systemDeclensionCards: DeclensionCard[];
  systemWords: VocabularyWord[];
  systemSentences: Sentence[];
  verbs: Verb[];
}

export function ReviewDataProvider({ children }: ReviewDataProviderProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LoadedData | null>(null);

  const loadAllData = useCallback(async () => {
    const userId = getUserId();
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const [
      loadedDeclensionData,
      loadedVocabularyData,
      loadedSentenceData,
      loadedConjugationData,
      vocabularySnapshot,
      declensionCardsSnapshot,
      sentencesSnapshot,
      verbsSnapshot,
    ] = await Promise.all([
      loadDeclensionData(),
      loadVocabularyData(),
      loadSentenceData(),
      loadConjugationData(),
      getDocs(collection(db, 'vocabulary')),
      getDocs(collection(db, 'declensionCards')),
      getDocs(collection(db, 'sentences')),
      getDocs(collection(db, 'verbs')),
    ]);

    const loadedSystemWords = vocabularySnapshot.docs.map((doc) => doc.data() as VocabularyWord);
    const loadedSystemDeclensionCards = declensionCardsSnapshot.docs.map(
      (doc) => doc.data() as DeclensionCard
    );
    const loadedSentences = sentencesSnapshot.docs.map((doc) => doc.data() as Sentence);
    const loadedVerbs = verbsSnapshot.docs.map((doc) => doc.data() as Verb);

    setData({
      declensionData: loadedDeclensionData,
      vocabularyData: loadedVocabularyData,
      sentenceData: loadedSentenceData,
      conjugationData: loadedConjugationData,
      systemDeclensionCards: loadedSystemDeclensionCards,
      systemWords: loadedSystemWords,
      systemSentences: loadedSentences,
      verbs: loadedVerbs,
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <ReviewCountsProvider loading={loading}>{children}</ReviewCountsProvider>
          </ConjugationProvider>
        </SentenceProvider>
      </VocabularyProvider>
    </DeclensionProvider>
  );
}
