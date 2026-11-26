/**
 * The five review contexts share one shape: a review store (one per direction for
 * vocabulary, sentences and conjugation), settings, an update that saves the
 * change, and a reset. Each Feature adapts one context to that shape so the
 * shared behaviour is tested once for all of them.
 */
import type { Card } from 'ts-fsrs';
import type { TranslationDirection } from '../../../src/types/common';
import type {
  DeclensionCardId,
  DeclensionCardReviewData,
  DeclensionReviewDataStore,
  DeclensionSettings,
} from '../../../src/types';
import type {
  VocabularyDirectionSettings,
  VocabularyReviewDataStore,
} from '../../../src/types/vocabulary';
import type {
  SentenceDirectionSettings,
  SentenceReviewDataStore,
} from '../../../src/types/sentences';
import type {
  ConjugationDirectionSettings,
  ConjugationReviewDataStore,
} from '../../../src/types/conjugation';
import type {
  AspectPairsReviewDataStore,
  AspectPairsSettings,
} from '../../../src/types/aspectPairs';
import type { ReviewDataContextType } from '../../../src/hooks/useReviewData';
import { recordCardReview, recordFormReview } from '../../../src/lib/reviewSession/recordReview';
import loadVocabularySettings from '../../../src/lib/storage/loadVocabularySettings';
import loadSentenceSettings from '../../../src/lib/storage/loadSentenceSettings';
import loadConjugationSettings from '../../../src/lib/storage/loadConjugationSettings';
import loadDeclensionSettings from '../../../src/lib/storage/loadDeclensionSettings';
import loadAspectPairsSettings from '../../../src/lib/storage/loadAspectPairsSettings';
import type { InitialData } from './render';
import {
  aspectPairsStore,
  conjugationStore,
  declensionStore,
  ratedNow,
  sentenceStore,
  vocabularyStore,
  withWordRated,
} from './fixtures';

type Data = ReviewDataContextType;
type Direction = TranslationDirection;
export type CardsByDirection = Partial<Record<Direction, Record<string, Card>>>;

export interface Feature<Store = unknown, Settings = unknown> {
  name: string;
  /** Reviewed in both directions, each with its own store and collections. */
  directional: boolean;
  /** Field of a stored card holding its id (wordId, formKey, ...). */
  idField: string;
  collection(direction: Direction): string;
  sessionDoc(direction: Direction): string;
  settingsDoc(direction: Direction): string;
  /** Name of the list counting today's new cards. */
  newList: 'newCardsToday' | 'newFormsToday';
  initial(cards: CardsByDirection): InitialData;
  shownStore(data: Data, direction: Direction): Store;
  cardIds(store: Store): string[];
  newIds(store: Store): string[];
  /** `store` with `id` rated as a new card, the way a review session records it. */
  rate(store: Store, id: string): Store;
  /** `store` without the card `id`. */
  without(store: Store, id: string): Store;
  update(data: Data, direction: Direction, store: Store): Promise<void>;
  clear(data: Data, direction: Direction): Promise<void>;
  shownSettings(data: Data, direction: Direction): Settings;
  updateSettings(data: Data, direction: Direction, settings: Settings): Promise<void>;
  /** Settings that differ from the defaults. */
  changedSettings: Settings;
  /** What a reload would load. */
  loadSettings(direction: Direction): Promise<Settings>;
}

const define = <Store, Settings>(feature: Feature<Store, Settings>) =>
  feature as unknown as Feature;

const suffix = (direction: Direction) => (direction === 'pl-to-en' ? 'pl-en' : 'en-pl');
const NEW_AND_DONE = { isNew: true, completed: true };

function omit<T>(record: Record<string, T>, id: string): Record<string, T> {
  const rest = { ...record };
  delete rest[id];
  return rest;
}

const both = <S>(make: (cards?: Record<string, Card>) => S, cards: CardsByDirection) => ({
  'pl-to-en': make(cards['pl-to-en']),
  'en-to-pl': make(cards['en-to-pl']),
});

export const vocabulary = define<VocabularyReviewDataStore, VocabularyDirectionSettings>({
  name: 'vocabulary',
  directional: true,
  idField: 'wordId',
  collection: (d) => `vocabularyReviewCards-${suffix(d)}`,
  sessionDoc: (d) => `vocabularyReviewSession-${suffix(d)}`,
  settingsDoc: (d) => `vocabularySettings-${suffix(d)}`,
  newList: 'newCardsToday',
  initial: (cards) => ({ vocabulary: { initialReviewStores: both(vocabularyStore, cards) } }),
  shownStore: (data, d) => data.vocabularyReviewStores[d],
  cardIds: (store) => Object.keys(store.cards).sort(),
  newIds: (store) => store.newCardsToday.map(String),
  rate: withWordRated,
  without: (store, id) => ({ ...store, cards: omit(store.cards, id) }),
  update: (data, d, store) => data.updateVocabularyReviewStore(d, store),
  clear: (data, d) => data.clearVocabularyReviewData(d),
  shownSettings: (data, d) => data.vocabularySettings[d],
  updateSettings: (data, d, settings) => data.updateVocabularySettings(d, settings),
  changedSettings: { newCardsPerDay: 25 },
  loadSettings: async (d) => (await loadVocabularySettings())[d],
});

export const sentences = define<SentenceReviewDataStore, SentenceDirectionSettings>({
  name: 'sentences',
  directional: true,
  idField: 'sentenceId',
  collection: (d) => `sentenceReviewCards-${suffix(d)}`,
  sessionDoc: (d) => `sentenceReviewSession-${suffix(d)}`,
  settingsDoc: (d) => `sentenceSettings-${suffix(d)}`,
  newList: 'newCardsToday',
  initial: (cards) => ({ sentences: { initialReviewStores: both(sentenceStore, cards) } }),
  shownStore: (data, d) => data.sentenceReviewStores[d],
  cardIds: (store) => Object.keys(store.cards).sort(),
  newIds: (store) => store.newCardsToday,
  rate: (store, id) =>
    recordCardReview(store, id, { sentenceId: id, fsrsCard: ratedNow() }, NEW_AND_DONE),
  without: (store, id) => ({ ...store, cards: omit(store.cards, id) }),
  update: (data, d, store) => data.updateSentenceReviewStore(d, store),
  clear: (data, d) => data.clearSentenceReviewData(d),
  shownSettings: (data, d) => data.sentenceSettings[d],
  updateSettings: (data, d, settings) => data.updateSentenceSettings(d, settings),
  changedSettings: { newCardsPerDay: 25, selectedLevels: ['B1'] },
  loadSettings: async (d) => (await loadSentenceSettings())[d],
});

export const conjugation = define<ConjugationReviewDataStore, ConjugationDirectionSettings>({
  name: 'conjugation',
  directional: true,
  idField: 'formKey',
  collection: (d) => `conjugationReviewForms-${suffix(d)}`,
  sessionDoc: (d) => `conjugationReviewSession-${suffix(d)}`,
  settingsDoc: (d) => `conjugationSettings-${suffix(d)}`,
  newList: 'newFormsToday',
  initial: (cards) => ({ conjugation: { initialReviewStores: both(conjugationStore, cards) } }),
  shownStore: (data, d) => data.conjugationReviewStores[d],
  cardIds: (store) => Object.keys(store.forms).sort(),
  newIds: (store) => store.newFormsToday,
  rate: (store, id) =>
    recordFormReview(store, id, { formKey: id, fsrsCard: ratedNow() }, NEW_AND_DONE),
  without: (store, id) => ({ ...store, forms: omit(store.forms, id) }),
  update: (data, d, store) => data.updateConjugationReviewStore(d, store),
  clear: (data, d) => data.clearConjugationReviewData(d),
  shownSettings: (data, d) => data.conjugationSettings[d],
  updateSettings: (data, d, settings) => data.updateConjugationSettings(d, settings),
  changedSettings: { newCardsPerDay: 25 },
  loadSettings: async (d) => (await loadConjugationSettings())[d],
});

export const declension = define<DeclensionReviewDataStore, DeclensionSettings>({
  name: 'declension',
  directional: false,
  idField: 'cardId',
  collection: () => 'declensionReviewCards',
  sessionDoc: () => 'declensionReviewSession',
  settingsDoc: () => 'settings',
  newList: 'newCardsToday',
  initial: (cards) => ({
    declension: { initialReviewStore: declensionStore(cards['pl-to-en']) },
  }),
  shownStore: (data) => data.declensionReviewStore,
  cardIds: (store) => Object.keys(store.cards).sort(),
  newIds: (store) => store.newCardsToday.map(String),
  rate: (store, id) =>
    recordCardReview<DeclensionCardId, DeclensionCardReviewData, DeclensionReviewDataStore>(
      store,
      id,
      { cardId: id, fsrsCard: ratedNow() },
      NEW_AND_DONE
    ),
  without: (store, id) => ({ ...store, cards: omit(store.cards, id) }),
  update: (data, _d, store) => data.updateDeclensionReviewStore(store),
  clear: (data) => data.clearDeclensionData(),
  shownSettings: (data) => data.declensionSettings,
  updateSettings: (data, _d, settings) => data.updateDeclensionSettings(settings),
  changedSettings: { newCardsPerDay: 25 },
  loadSettings: () => loadDeclensionSettings(),
});

export const aspectPairs = define<AspectPairsReviewDataStore, AspectPairsSettings>({
  name: 'aspect pairs',
  directional: false,
  idField: 'verbId',
  collection: () => 'aspectPairsReviewCards',
  sessionDoc: () => 'aspectPairsReviewSession',
  settingsDoc: () => 'aspectPairsSettings',
  newList: 'newCardsToday',
  initial: (cards) => ({
    aspectPairs: { initialReviewStore: aspectPairsStore(cards['pl-to-en']) },
  }),
  shownStore: (data) => data.aspectPairsReviewStore,
  cardIds: (store) => Object.keys(store.cards).sort(),
  newIds: (store) => store.newCardsToday,
  rate: (store, id) =>
    recordCardReview(store, id, { verbId: id, fsrsCard: ratedNow() }, NEW_AND_DONE),
  without: (store, id) => ({ ...store, cards: omit(store.cards, id) }),
  update: (data, _d, store) => data.updateAspectPairsReviewStore(store),
  clear: (data) => data.clearAspectPairsData(),
  shownSettings: (data) => data.aspectPairsSettings,
  updateSettings: (data, _d, settings) => data.updateAspectPairsSettings(settings),
  changedSettings: { newCardsPerDay: 25 },
  loadSettings: () => loadAspectPairsSettings(),
});

export const ALL_FEATURES = [vocabulary, sentences, conjugation, declension, aspectPairs];
