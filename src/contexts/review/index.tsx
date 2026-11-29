import {
  useState,
  useEffect,
  useCallback,
  useContext,
  useRef,
  type ComponentProps,
  type ReactNode,
} from 'react';
import type { DeclensionCard } from '../../types';
import type { VocabularyWord } from '../../types/vocabulary';
import type { Sentence } from '../../types/sentences';
import type { Verb } from '../../types/conjugation';
import { getCurrentUserId } from '../../lib/cachedAuth';
import { useAuthContext } from '../AuthContext';
import { loadContentData, syncContentFromFirestore } from '../../lib/offlineDb/contentSync';
import {
  refreshAllUserDataFromFirestore,
  syncAllPendingToFirestore,
  cleanupLegacyReviewUserDataRows,
} from '../../lib/offlineDb/userDataWrapper';
import { loadSentenceTags, refreshSentenceTagsFromFirestore } from '../../lib/storage/sentenceTags';
import {
  refreshAllReviewCardsFromFirestore,
  syncAllPendingReviewCards,
} from '../../lib/storage/reviewStorageRegistry';
import {
  aspectPairsStorage,
  conjugationStorage,
  declensionStorage,
  loadDeckProgress,
  sentenceStorage,
  vocabularyStorage,
} from '../../lib/storage/reviewDeckStorage';
import { loadCustomDeclension } from '../../lib/storage/customDeclension';
import { loadCustomVocabulary } from '../../lib/storage/customVocabulary';
import { loadCustomSentences } from '../../lib/storage/customSentences';
import { DeclensionProvider, DeclensionContext } from './DeclensionContext';
import { VocabularyProvider, VocabularyContext } from './VocabularyContext';
import { SentenceProvider, SentenceContext } from './SentenceContext';
import { ConjugationProvider, ConjugationContext } from './ConjugationContext';
import { AspectPairsProvider, AspectPairsContext } from './AspectPairsContext';
import { ReviewDataLoadingContext } from './ReviewDataLoadingContext';
import { latestLocalChange } from './localChanges';

export type { DeclensionContextType } from './DeclensionContext';
export type { VocabularyContextType } from './VocabularyContext';
export type { SentenceContextType } from './SentenceContext';
export type { ConjugationContextType } from './ConjugationContext';
export type { AspectPairsContextType } from './AspectPairsContext';
export type { DeckProgress } from './deckState';

export {
  DeclensionContext,
  VocabularyContext,
  SentenceContext,
  ConjugationContext,
  AspectPairsContext,
  ReviewDataLoadingContext,
};

export interface ReviewDataProviderProps {
  children: ReactNode;
}

/** The signed-in learner's own data. */
async function loadLearnerData() {
  const [
    declension,
    vocabulary,
    sentences,
    conjugation,
    aspectPairs,
    customDeclensionCards,
    customWords,
    customSentences,
    sentenceTags,
  ] = await Promise.all([
    loadDeckProgress(declensionStorage),
    loadDeckProgress(vocabularyStorage),
    loadDeckProgress(sentenceStorage),
    loadDeckProgress(conjugationStorage),
    loadDeckProgress(aspectPairsStorage),
    loadCustomDeclension(),
    loadCustomVocabulary(),
    loadCustomSentences(),
    loadSentenceTags(),
  ]);
  return {
    declension,
    vocabulary,
    sentences,
    conjugation,
    aspectPairs,
    customDeclensionCards,
    customWords,
    customSentences,
    sentenceTags,
  };
}

type LoadedData = Partial<Awaited<ReturnType<typeof loadLearnerData>>> & {
  systemDeclensionCards?: DeclensionCard[];
  systemWords?: VocabularyWord[];
  systemSentences?: Sentence[];
  verbs?: Verb[];
  /**
   * When this load or sync started reading storage (latestLocalChange). The
   * providers keep what was changed in memory since, such as custom items the
   * live listener delivered while a slow load was still reading.
   */
  readAt?: number;
};

/** Signed-out users only get system content, so the learner's sections stay empty. */
const EMPTY_DATA: LoadedData = {};

async function fetchAllData(): Promise<LoadedData> {
  const [learnerData, content] = await Promise.all([
    getCurrentUserId() ? loadLearnerData() : null,
    loadContentData(),
  ]);

  return {
    ...learnerData,
    systemDeclensionCards: content.declensionCards,
    systemWords: content.vocabulary,
    systemSentences: content.sentences,
    verbs: content.verbs,
  };
}

/** Builds the aspect pairs from the conjugation context's verbs, so they follow setVerbs. */
function AspectPairsFromConjugationVerbs(
  props: Omit<ComponentProps<typeof AspectPairsProvider>, 'verbs'>
) {
  const verbs = useContext(ConjugationContext)?.verbs;
  return <AspectPairsProvider {...props} verbs={verbs} />;
}

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
    if (!navigator.onLine || !getCurrentUserId()) return;
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    const syncUid = getCurrentUserId();
    const readAt = latestLocalChange();
    try {
      await Promise.all([syncAllPendingToFirestore(), syncAllPendingReviewCards()]);
      await Promise.all([
        refreshAllUserDataFromFirestore(),
        refreshAllReviewCardsFromFirestore(),
        syncContentFromFirestore(),
        refreshSentenceTagsFromFirestore(),
      ]);
      const fresh = await fetchAllData();
      if (mountedRef.current && getCurrentUserId() === syncUid) {
        freshDataAppliedRef.current = true;
        setData({ ...fresh, readAt });
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

    const readAt = latestLocalChange();
    fetchAllData().then((result) => {
      if (!active) return;
      if (!freshDataAppliedRef.current) setData({ ...result, readAt });
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
      initialCustomCards={d.customDeclensionCards}
      initialSystemCards={d.systemDeclensionCards}
      initialReviewStore={d.declension?.stores.all}
      initialSettings={d.declension?.settings.all}
      readAt={d.readAt}
    >
      <VocabularyProvider
        initialCustomWords={d.customWords}
        initialSystemWords={d.systemWords}
        initialReviewStores={d.vocabulary?.stores}
        initialSettings={d.vocabulary?.settings}
        readAt={d.readAt}
      >
        <SentenceProvider
          initialCustomSentences={d.customSentences}
          initialSystemSentences={d.systemSentences}
          initialReviewStores={d.sentences?.stores}
          initialSettings={d.sentences?.settings}
          initialTags={d.sentenceTags}
          readAt={d.readAt}
        >
          <ConjugationProvider
            initialVerbs={d.verbs}
            initialReviewStores={d.conjugation?.stores}
            initialSettings={d.conjugation?.settings}
            readAt={d.readAt}
          >
            <AspectPairsFromConjugationVerbs
              initialReviewStore={d.aspectPairs?.stores.all}
              initialSettings={d.aspectPairs?.settings.all}
              readAt={d.readAt}
            >
              <ReviewDataLoadingContext.Provider value={loading}>
                {children}
              </ReviewDataLoadingContext.Provider>
            </AspectPairsFromConjugationVerbs>
          </ConjugationProvider>
        </SentenceProvider>
      </VocabularyProvider>
    </DeclensionProvider>
  );
}
