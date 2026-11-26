/** Components the playback harness (app.tsx) renders around the real pages. */
import { useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAudioPlayerContext } from '../../../src/contexts/AudioPlayerContext';
import { useListening } from '../../../src/contexts/ListeningContext';
import {
  AspectPairsContext,
  ConjugationContext,
  DeclensionContext,
  ReviewCountsContext,
  SentenceContext,
  VocabularyContext,
  type AspectPairsContextType,
  type ConjugationContextType,
  type DeclensionContextType,
  type SentenceContextType,
  type VocabularyContextType,
} from '../../../src/contexts/review';
import {
  getDefaultDeclensionReviewStore,
  getDefaultSentenceReviewStore,
  getDefaultVocabularyReviewStore,
} from '../../../src/lib/storage/helpers';
import { stub } from '../../helpers/stub';
import { probe, srsWrites, type ReviewFixture } from './probes';

const recorder =
  (what: string) =>
  async (...args: unknown[]) => {
    srsWrites(what, ...args);
  };

/**
 * The review data contexts with fixed content. Every function that could change
 * review progress reports to `srsWrites` instead.
 */
export function ReviewDataStub({
  fixture,
  children,
}: {
  fixture: ReviewFixture;
  children: ReactNode;
}) {
  const declension = stub<DeclensionContextType>({
    declensionCards: fixture.declensionCards ?? [],
    declensionReviewStore: fixture.declensionStore ?? getDefaultDeclensionReviewStore(),
    updateDeclensionReviewStore: recorder('updateDeclensionReviewStore'),
    clearDeclensionData: recorder('clearDeclensionData'),
  });
  const vocabulary = stub<VocabularyContextType>({
    vocabularyWords: fixture.vocabularyWords ?? [],
    vocabularyReviewStores: {
      'pl-to-en': fixture.vocabularyStores?.['pl-to-en'] ?? getDefaultVocabularyReviewStore(),
      'en-to-pl': fixture.vocabularyStores?.['en-to-pl'] ?? getDefaultVocabularyReviewStore(),
    },
    updateVocabularyReviewStore: recorder('updateVocabularyReviewStore'),
    clearVocabularyReviewData: recorder('clearVocabularyReviewData'),
  });
  const sentences = stub<SentenceContextType>({
    sentences: fixture.sentences ?? [],
    sentenceReviewStores: {
      'pl-to-en': fixture.sentenceStores?.['pl-to-en'] ?? getDefaultSentenceReviewStore(),
      'en-to-pl': fixture.sentenceStores?.['en-to-pl'] ?? getDefaultSentenceReviewStore(),
    },
    updateSentenceReviewStore: recorder('updateSentenceReviewStore'),
    clearSentenceReviewData: recorder('clearSentenceReviewData'),
  });
  const conjugation = stub<ConjugationContextType>({
    updateConjugationReviewStore: recorder('updateConjugationReviewStore'),
    clearConjugationReviewData: recorder('clearConjugationReviewData'),
  });
  const aspectPairs = stub<AspectPairsContextType>({
    updateAspectPairsReviewStore: recorder('updateAspectPairsReviewStore'),
    clearAspectPairsData: recorder('clearAspectPairsData'),
  });
  const counts = {
    loading: false,
    counts: { declension: 0, vocabulary: 0, sentences: 0, conjugation: 0, aspectPairs: 0 },
  };
  return (
    <DeclensionContext.Provider value={declension}>
      <VocabularyContext.Provider value={vocabulary}>
        <SentenceContext.Provider value={sentences}>
          <ConjugationContext.Provider value={conjugation}>
            <AspectPairsContext.Provider value={aspectPairs}>
              <ReviewCountsContext.Provider value={counts}>{children}</ReviewCountsContext.Provider>
            </AspectPairsContext.Provider>
          </ConjugationContext.Provider>
        </SentenceContext.Provider>
      </VocabularyContext.Provider>
    </DeclensionContext.Provider>
  );
}

/** Shares the player and listening contexts and navigation with tests; shows the path. */
export function Probes() {
  const player = useAudioPlayerContext();
  const listening = useListening();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    probe.player = player;
    probe.listening = listening;
    probe.navigate = navigate;
  });
  return <output data-testid="location">{location.pathname}</output>;
}
