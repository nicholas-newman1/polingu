/** State the rendered app shares with tests (see AppParts.tsx and app.tsx). */
import { vi } from 'vitest';
import type { useAudioPlayerContext } from '../../../src/contexts/AudioPlayerContext';
import type { useListening } from '../../../src/contexts/ListeningContext';
import type { Sentence, SentenceReviewDataStore } from '../../../src/types/sentences';
import type { VocabularyReviewDataStore, VocabularyWord } from '../../../src/types/vocabulary';
import type { DeclensionCard, DeclensionReviewDataStore } from '../../../src/types';

/** The latest committed context values and the router's navigate function. */
export const probe: {
  player: ReturnType<typeof useAudioPlayerContext> | null;
  listening: ReturnType<typeof useListening> | null;
  navigate: ((path: string) => void) | null;
} = { player: null, listening: null, navigate: null };

/** Review data the stand-in review contexts serve (for the listening hub). */
export interface ReviewFixture {
  sentences?: Sentence[];
  sentenceStores?: Partial<Record<'pl-to-en' | 'en-to-pl', SentenceReviewDataStore>>;
  vocabularyWords?: VocabularyWord[];
  vocabularyStores?: Partial<Record<'pl-to-en' | 'en-to-pl', VocabularyReviewDataStore>>;
  declensionCards?: DeclensionCard[];
  declensionStore?: DeclensionReviewDataStore;
}

/** Called by every function through which review progress could be changed or cleared. */
export const srsWrites = vi.fn<(what: string, ...args: unknown[]) => void>();
