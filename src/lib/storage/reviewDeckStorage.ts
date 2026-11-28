/**
 * Saving and loading the five review decks. Every deck is stored the same way, in
 * one part per study direction (or a single part, `all`, for a deck studied one
 * way): a subcollection with one doc per studied card, a doc with today's session
 * lists, and a settings doc. REVIEW_DECK_DOCS names them.
 */
import type {
  CardReviewData,
  ReviewDataStore,
  SessionChanges,
  SessionId,
  TranslationDirection,
} from '../../types/common';
import type { DeclensionReviewDataStore, DeclensionSettings } from '../../types';
import type {
  VocabularyDirectionSettings,
  VocabularyReviewDataStore,
} from '../../types/vocabulary';
import type { SentenceDirectionSettings, SentenceReviewDataStore } from '../../types/sentences';
import type {
  ConjugationDirectionSettings,
  ConjugationReviewDataStore,
} from '../../types/conjugation';
import type { AspectPairsReviewDataStore, AspectPairsSettings } from '../../types/aspectPairs';
import { DEFAULT_DECLENSION_SETTINGS } from '../../constants';
import { DEFAULT_VOCABULARY_SETTINGS } from '../../types/vocabulary';
import { DEFAULT_SENTENCE_SETTINGS } from '../../types/sentences';
import { DEFAULT_CONJUGATION_SETTINGS } from '../../types/conjugation';
import { DEFAULT_ASPECT_PAIRS_SETTINGS } from '../../types/aspectPairs';
import type { ReviewCardCollection } from '../offlineDb/userDb';
import { deleteUserData, loadUserData, saveUserData } from '../offlineDb/userDataWrapper';
import {
  createReviewSubcollectionStorage,
  type ReviewSubcollectionStorage,
  type ReviewSubcollectionSync,
} from './createReviewSubcollectionStorage';
import { getTodayString, getUserId } from './helpers';
import { REVIEW_DECK_DOCS, type DeckPart } from './reviewDeckDocs';

export type { DeckPart };

type AnyReviewStore = ReviewDataStore<CardReviewData, SessionId>;

/** Where one part of a deck is saved, and how it resets. */
export interface ReviewDeckStorage<R extends CardReviewData, Id extends SessionId, Settings> {
  cards: ReviewSubcollectionStorage<R>;
  /** The part's store before anything is studied, dated today. */
  emptyStore: () => ReviewDataStore<R, Id>;
  sessionDocPath: string;
  settingsDocPath: string;
  defaultSettings: Settings;
  /** Whether resetting progress also deletes the settings, so they go back to the defaults. */
  resetDeletesSettings: boolean;
  /** The session doc's name for today's new-card list, `newCardsToday` in memory. */
  savedNewListName: string;
}

const NEW_LIST = 'newCardsToday';

type AnyDeckStorage<Settings = unknown> = ReviewDeckStorage<CardReviewData, SessionId, Settings>;

/** A deck part whose store has the shape of `Store`. */
function part<Store extends AnyReviewStore, Settings>(
  docs: { cards: ReviewCardCollection; session: string; settings: string },
  defaultSettings: Settings,
  options: { resetDeletesSettings: boolean; savedNewListName?: string }
): ReviewDeckStorage<Store['cards'][string], Store['newCardsToday'][number], Settings> {
  return {
    cards: createReviewSubcollectionStorage(docs.cards),
    emptyStore: emptyReviewStore,
    sessionDocPath: docs.session,
    settingsDocPath: docs.settings,
    defaultSettings,
    resetDeletesSettings: options.resetDeletesSettings,
    savedNewListName: options.savedNewListName ?? NEW_LIST,
  };
}

export function partsOf<K extends DeckPart>(parts: Record<K, unknown>): K[] {
  return Object.keys(parts) as K[];
}

export function mapParts<K extends DeckPart, T>(
  keys: K[],
  make: (key: K, index: number) => T
): Record<K, T> {
  return Object.fromEntries(keys.map((key, index) => [key, make(key, index)])) as Record<K, T>;
}

const DIRECTIONS: TranslationDirection[] = ['pl-to-en', 'en-to-pl'];

export const declensionStorage = {
  all: part<DeclensionReviewDataStore, DeclensionSettings>(
    REVIEW_DECK_DOCS.declension.all,
    DEFAULT_DECLENSION_SETTINGS,
    { resetDeletesSettings: true }
  ),
};

export const aspectPairsStorage = {
  all: part<AspectPairsReviewDataStore, AspectPairsSettings>(
    REVIEW_DECK_DOCS.aspectPairs.all,
    DEFAULT_ASPECT_PAIRS_SETTINGS,
    { resetDeletesSettings: true }
  ),
};

export const vocabularyStorage = mapParts(DIRECTIONS, (d) =>
  part<VocabularyReviewDataStore, VocabularyDirectionSettings>(
    REVIEW_DECK_DOCS.vocabulary[d],
    DEFAULT_VOCABULARY_SETTINGS[d],
    { resetDeletesSettings: false }
  )
);

export const sentenceStorage = mapParts(DIRECTIONS, (d) =>
  part<SentenceReviewDataStore, SentenceDirectionSettings>(
    REVIEW_DECK_DOCS.sentences[d],
    DEFAULT_SENTENCE_SETTINGS[d],
    { resetDeletesSettings: false }
  )
);

export const conjugationStorage = mapParts(DIRECTIONS, (d) =>
  part<ConjugationReviewDataStore, ConjugationDirectionSettings>(
    REVIEW_DECK_DOCS.conjugation[d],
    DEFAULT_CONJUGATION_SETTINGS[d],
    { resetDeletesSettings: true, savedNewListName: 'newFormsToday' }
  )
);

/** Every card subcollection, so background sync can drive them all together. */
export const ALL_REVIEW_CARD_STORAGES: ReviewSubcollectionSync[] = [
  declensionStorage,
  aspectPairsStorage,
  sentenceStorage,
  vocabularyStorage,
  conjugationStorage,
].flatMap((parts) => Object.values<{ cards: ReviewSubcollectionSync }>(parts).map((p) => p.cards));

function emptyReviewStore<R extends CardReviewData, Id extends SessionId>(): ReviewDataStore<
  R,
  Id
> {
  return { cards: {}, reviewedToday: [], newCardsToday: [], lastReviewDate: getTodayString() };
}

/** Renames the `${from}:` stamps in a session's changedAt to `${to}:`. */
function renameStamps(changedAt: SessionChanges, from: string, to: string): SessionChanges {
  if (from === to) return changedAt;
  const prefix = `${from}:`;
  return Object.fromEntries(
    Object.entries(changedAt).map(([key, at]) => [
      key.startsWith(prefix) ? `${to}:${key.slice(prefix.length)}` : key,
      at,
    ])
  );
}

type SavedSession = Record<string, unknown> & {
  reviewedToday: SessionId[];
  lastReviewDate: string;
  changedAt?: SessionChanges;
};

function toSavedSession(store: AnyReviewStore, savedNewListName: string): SavedSession {
  return {
    reviewedToday: store.reviewedToday,
    [savedNewListName]: store.newCardsToday,
    lastReviewDate: store.lastReviewDate,
    ...(store.changedAt
      ? { changedAt: renameStamps(store.changedAt, NEW_LIST, savedNewListName) }
      : {}),
  };
}

/** Loads a part's cards and today's session lists; lists saved on an earlier day start empty. */
export async function loadReviewStore<R extends CardReviewData, Id extends SessionId>(
  storage: ReviewDeckStorage<R, Id, unknown>
): Promise<ReviewDataStore<R, Id>> {
  const fresh = storage.emptyStore();
  const [cards, saved] = await Promise.all([
    storage.cards.loadCards(),
    loadUserData(storage.sessionDocPath, toSavedSession(fresh, storage.savedNewListName)),
  ]);
  if (saved.lastReviewDate !== getTodayString()) return { ...fresh, cards };

  return {
    cards,
    reviewedToday: saved.reviewedToday as Id[],
    newCardsToday: saved[storage.savedNewListName] as Id[],
    lastReviewDate: saved.lastReviewDate,
    ...(saved.changedAt
      ? { changedAt: renameStamps(saved.changedAt, storage.savedNewListName, NEW_LIST) }
      : {}),
  };
}

/** Saves the cards that changed since `prev`, and today's session lists. */
export async function saveReviewStore<R extends CardReviewData, Id extends SessionId>(
  storage: ReviewDeckStorage<R, Id, unknown>,
  prev: ReviewDataStore<R, Id> | null,
  next: ReviewDataStore<R, Id>
): Promise<void> {
  await Promise.all([
    storage.cards.saveCardsDiff(prev && prev.cards, next.cards),
    saveUserData(storage.sessionDocPath, toSavedSession(next, storage.savedNewListName)),
  ]);
}

/** A part's settings, with defaults for anything saved before it existed. */
export async function loadDeckSettings<Settings>(
  storage: AnyDeckStorage<Settings>
): Promise<Settings> {
  return loadUserData(storage.settingsDocPath, storage.defaultSettings, (data) => ({
    ...storage.defaultSettings,
    ...(data as Settings),
  }));
}

export async function saveDeckSettings<Settings>(
  storage: AnyDeckStorage<Settings>,
  settings: Settings
): Promise<void> {
  await saveUserData(storage.settingsDocPath, settings);
}

/**
 * Resets a part's progress, and its settings where the deck resets those too.
 * Rejects if the server could not be updated.
 */
export async function clearDeckProgress(storage: AnyDeckStorage): Promise<void> {
  if (!getUserId()) return;

  await storage.cards.clearAllCards();
  await Promise.all([
    deleteUserData(storage.sessionDocPath),
    ...(storage.resetDeletesSettings ? [deleteUserData(storage.settingsDocPath)] : []),
  ]);
}

/** Every part's review store and settings, as the review providers start from. */
export async function loadDeckProgress<
  K extends DeckPart,
  R extends CardReviewData,
  Id extends SessionId,
  Settings,
>(
  parts: Record<K, ReviewDeckStorage<R, Id, Settings>>
): Promise<{ stores: Record<K, ReviewDataStore<R, Id>>; settings: Record<K, Settings> }> {
  const keys = partsOf(parts);
  const loaded = await Promise.all(
    keys.map((key) => Promise.all([loadReviewStore(parts[key]), loadDeckSettings(parts[key])]))
  );
  return {
    stores: mapParts(keys, (_, i) => loaded[i][0]),
    settings: mapParts(keys, (_, i) => loaded[i][1]),
  };
}
