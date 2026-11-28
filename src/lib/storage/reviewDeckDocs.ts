import type { TranslationDirection } from '../../types/common';
import type { ReviewCardCollection } from '../offlineDb/userDb';

/** A deck studied in both directions keeps each direction apart; the others have one part, `all`. */
export type DeckPart = TranslationDirection | 'all';

interface DeckDocs {
  /** The subcollection holding one doc per studied card: users/{uid}/{cards}/{cardId}. */
  cards: ReviewCardCollection;
  /** Today's session lists: users/{uid}/data/{session}. */
  session: string;
  /** The deck's settings: users/{uid}/data/{settings}. */
  settings: string;
}

/** Where each review deck keeps its data. These names are stored on learners' devices and the server. */
export const REVIEW_DECK_DOCS = {
  declension: {
    all: {
      cards: 'declensionReviewCards',
      session: 'declensionReviewSession',
      settings: 'settings',
    },
  },
  aspectPairs: {
    all: {
      cards: 'aspectPairsReviewCards',
      session: 'aspectPairsReviewSession',
      settings: 'aspectPairsSettings',
    },
  },
  vocabulary: {
    'pl-to-en': {
      cards: 'vocabularyReviewCards-pl-en',
      session: 'vocabularyReviewSession-pl-en',
      settings: 'vocabularySettings-pl-en',
    },
    'en-to-pl': {
      cards: 'vocabularyReviewCards-en-pl',
      session: 'vocabularyReviewSession-en-pl',
      settings: 'vocabularySettings-en-pl',
    },
  },
  sentences: {
    'pl-to-en': {
      cards: 'sentenceReviewCards-pl-en',
      session: 'sentenceReviewSession-pl-en',
      settings: 'sentenceSettings-pl-en',
    },
    'en-to-pl': {
      cards: 'sentenceReviewCards-en-pl',
      session: 'sentenceReviewSession-en-pl',
      settings: 'sentenceSettings-en-pl',
    },
  },
  conjugation: {
    'pl-to-en': {
      cards: 'conjugationReviewForms-pl-en',
      session: 'conjugationReviewSession-pl-en',
      settings: 'conjugationSettings-pl-en',
    },
    'en-to-pl': {
      cards: 'conjugationReviewForms-en-pl',
      session: 'conjugationReviewSession-en-pl',
      settings: 'conjugationSettings-en-pl',
    },
  },
} as const satisfies Record<string, Partial<Record<DeckPart, DeckDocs>>>;

/**
 * Docs holding per-day review counters. Two devices can both append to these on
 * the same day, so writes to them are merged against the server copy rather
 * than overwriting it.
 */
export const REVIEW_SESSION_DOC_PATHS = new Set<string>(
  Object.values(REVIEW_DECK_DOCS).flatMap((parts) =>
    Object.values(parts).map((docs: DeckDocs) => docs.session)
  )
);
