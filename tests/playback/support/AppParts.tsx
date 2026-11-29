/** Components the playback harness (app.tsx) renders around the real pages. */
import { useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAudioPlayerContext } from '../../../src/contexts/AudioPlayerContext';
import { useListening } from '../../../src/contexts/ListeningContext';
import {
  AspectPairsContext,
  ConjugationContext,
  DeclensionContext,
  ReviewDataLoadingContext,
  SentenceContext,
  VocabularyContext,
  type AspectPairsContextType,
  type ConjugationContextType,
  type DeclensionContextType,
  type SentenceContextType,
  type VocabularyContextType,
} from '../../../src/contexts/review';
import { stub } from '../../helpers/stub';
import { probe, srsWrites, type ReviewFixture } from './probes';
import { emptyReviewStore } from '../../../src/lib/storage/reviewDeckStorage';

const recorder =
  (what: string) =>
  async (...args: unknown[]) => {
    srsWrites(what, ...args);
  };

/** A deck's progress changes, each reported to `srsWrites` as `${deck}.${change}`. */
const progressRecorders = (deck: string) => ({
  updateStore: recorder(`${deck}.updateStore`),
  updateSettings: recorder(`${deck}.updateSettings`),
  clear: recorder(`${deck}.clear`),
});

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
    cards: fixture.declensionCards ?? [],
    progress: stub<DeclensionContextType['progress']>({
      stores: { all: fixture.declensionStore ?? emptyReviewStore() },
      ...progressRecorders('declension'),
    }),
  });
  const vocabulary = stub<VocabularyContextType>({
    words: fixture.vocabularyWords ?? [],
    progress: stub<VocabularyContextType['progress']>({
      stores: {
        'pl-to-en': fixture.vocabularyStores?.['pl-to-en'] ?? emptyReviewStore(),
        'en-to-pl': fixture.vocabularyStores?.['en-to-pl'] ?? emptyReviewStore(),
      },
      ...progressRecorders('vocabulary'),
    }),
  });
  const sentences = stub<SentenceContextType>({
    sentences: fixture.sentences ?? [],
    progress: stub<SentenceContextType['progress']>({
      stores: {
        'pl-to-en': fixture.sentenceStores?.['pl-to-en'] ?? emptyReviewStore(),
        'en-to-pl': fixture.sentenceStores?.['en-to-pl'] ?? emptyReviewStore(),
      },
      ...progressRecorders('sentences'),
    }),
  });
  const conjugation = stub<ConjugationContextType>({
    progress: stub<ConjugationContextType['progress']>(progressRecorders('conjugation')),
  });
  const aspectPairs = stub<AspectPairsContextType>({
    progress: stub<AspectPairsContextType['progress']>(progressRecorders('aspectPairs')),
  });
  return (
    <DeclensionContext.Provider value={declension}>
      <VocabularyContext.Provider value={vocabulary}>
        <SentenceContext.Provider value={sentences}>
          <ConjugationContext.Provider value={conjugation}>
            <AspectPairsContext.Provider value={aspectPairs}>
              <ReviewDataLoadingContext.Provider value={false}>
                {children}
              </ReviewDataLoadingContext.Provider>
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
