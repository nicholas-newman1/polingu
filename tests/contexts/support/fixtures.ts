/**
 * Small content and review-store fixtures for the review context tests, plus
 * readers for what reached the fake Firestore server.
 */
import { createEmptyCard, type Card } from 'ts-fsrs';
import type {
  DeclensionCard,
  DeclensionReviewDataStore,
  Case,
  Gender,
  Number,
} from '../../../src/types';
import type {
  VocabularyCardReviewData,
  VocabularyReviewDataStore,
  VocabularyWord,
  VocabularyWordId,
} from '../../../src/types/vocabulary';
import type { CEFRLevel, Sentence, SentenceReviewDataStore } from '../../../src/types/sentences';
import type {
  ConjugationForm,
  ConjugationReviewDataStore,
  Verb,
} from '../../../src/types/conjugation';
import type { AspectPairsReviewDataStore } from '../../../src/types/aspectPairs';
import { getTodayString } from '../../../src/lib/storage/helpers';
import { recordCardReview } from '../../../src/lib/reviewSession/recordReview';
import { remote } from '../../sync/support/fakeFirestore';
import { ratedCard, userPath } from '../../sync/support/harness';
import { stub } from '../../helpers/stub';
import { DAY, fsrsCard, State } from '../../helpers/fsrs';

export { DAY, fsrsCard, State };

/** A card rated Good just now: graduated out of New, due in a few days. */
export const ratedNow = (): Card => ratedCard(new Date());

/** A graduated card that fell due `days` ago. */
export const dueCard = (days = 1): Card =>
  fsrsCard(State.Review, new Date(Date.now() - days * DAY));

/** A graduated card not due for another `days` days. */
export const notDueCard = (days = 5): Card =>
  fsrsCard(State.Review, new Date(Date.now() + days * DAY));

export const newCard = (): Card => createEmptyCard(new Date());

// ---------------------------------------------------------------------------
// Content

export const word = (id: string, extra: Partial<VocabularyWord> = {}): VocabularyWord => ({
  id,
  polish: `pl-${id}`,
  english: `en-${id}`,
  ...extra,
});

export const sentence = (id: string, level: CEFRLevel = 'A1'): Sentence => ({
  id,
  polish: `pl-${id}`,
  english: `en-${id}`,
  level,
  tags: [],
});

export const declensionCard = (
  id: string | number,
  grammar: { case?: Case; gender?: Gender; number?: Number } = {}
): DeclensionCard => ({
  id,
  front: `front-${id}`,
  back: `back-${id}`,
  declined: `declined-${id}`,
  case: grammar.case ?? 'Genitive',
  gender: grammar.gender ?? 'Feminine',
  number: grammar.number ?? 'Singular',
});

type Conjugations = Verb['conjugations'];

/**
 * A verb with present-tense forms for the given form keys only (default 1sg and
 * 3sg), so each verb yields a known number of drillable forms.
 */
export const verb = (
  id: string,
  options: { aspectPair?: string; present?: string[]; past?: string[] } = {}
): Verb => {
  // Only some of a tense's form keys: a partial record, typed as the full one.
  const forms = <T>(keys: string[]) =>
    Object.fromEntries(
      keys.map((key): [string, ConjugationForm] => [
        key,
        { pl: `${id}-${key}`, en: [`${id} ${key}`] },
      ])
    ) as T;
  return stub<Verb>({
    id,
    infinitive: id,
    infinitiveEn: `to ${id}`,
    aspect: 'Imperfective',
    verbClass: '-ać',
    isIrregular: false,
    isReflexive: false,
    ...(options.aspectPair ? { aspectPair: options.aspectPair } : {}),
    conjugations: stub<Conjugations>({
      present: forms<Conjugations['present']>(options.present ?? ['1sg', '3sg']),
      ...(options.past ? { past: forms<Conjugations['past']>(options.past) } : {}),
    }),
  });
};

/** The key a verb form's review data is stored under. */
export const formKey = (verbId: string, key: string, tense = 'present') =>
  `${verbId}:${tense}:${key}`;

// ---------------------------------------------------------------------------
// Review stores, dated today

interface Lists {
  reviewedToday?: string[];
  newCardsToday?: string[];
}

export const vocabularyStore = (
  cards: Record<string, Card> = {},
  lists: Lists = {}
): VocabularyReviewDataStore => ({
  cards: Object.fromEntries(
    Object.entries(cards).map(([id, fsrs]) => [id, { wordId: id, fsrsCard: fsrs }])
  ),
  reviewedToday: lists.reviewedToday ?? [],
  newCardsToday: lists.newCardsToday ?? [],
  lastReviewDate: getTodayString(),
});

export const sentenceStore = (
  cards: Record<string, Card> = {},
  lists: Lists = {}
): SentenceReviewDataStore => ({
  cards: Object.fromEntries(
    Object.entries(cards).map(([id, fsrs]) => [id, { sentenceId: id, fsrsCard: fsrs }])
  ),
  reviewedToday: lists.reviewedToday ?? [],
  newCardsToday: lists.newCardsToday ?? [],
  lastReviewDate: getTodayString(),
});

export const declensionStore = (
  cards: Record<string, Card> = {},
  lists: Lists = {}
): DeclensionReviewDataStore => ({
  cards: Object.fromEntries(
    Object.entries(cards).map(([id, fsrs]) => [id, { cardId: id, fsrsCard: fsrs }])
  ),
  reviewedToday: lists.reviewedToday ?? [],
  newCardsToday: lists.newCardsToday ?? [],
  lastReviewDate: getTodayString(),
});

export const aspectPairsStore = (
  cards: Record<string, Card> = {},
  lists: Lists = {}
): AspectPairsReviewDataStore => ({
  cards: Object.fromEntries(
    Object.entries(cards).map(([id, fsrs]) => [id, { verbId: id, fsrsCard: fsrs }])
  ),
  reviewedToday: lists.reviewedToday ?? [],
  newCardsToday: lists.newCardsToday ?? [],
  lastReviewDate: getTodayString(),
});

export const conjugationStore = (
  forms: Record<string, Card> = {},
  lists: { reviewedToday?: string[]; newFormsToday?: string[] } = {}
): ConjugationReviewDataStore => ({
  forms: Object.fromEntries(
    Object.entries(forms).map(([key, fsrs]) => [key, { formKey: key, fsrsCard: fsrs }])
  ),
  reviewedToday: lists.reviewedToday ?? [],
  newFormsToday: lists.newFormsToday ?? [],
  lastReviewDate: getTodayString(),
});

/** `store` with `wordId` rated Good as a new word, the way a review session records it. */
export const withWordRated = (store: VocabularyReviewDataStore, wordId: string) =>
  recordCardReview<VocabularyWordId, VocabularyCardReviewData, VocabularyReviewDataStore>(
    store,
    wordId,
    { wordId, fsrsCard: ratedNow() },
    { isNew: true, completed: true }
  );

// ---------------------------------------------------------------------------
// The server

/** Ids of the documents in one of the user's collections on the server. */
export const serverIds = (uid: string, collectionName: string) =>
  Object.keys(remote.list(userPath(uid, collectionName))).sort();

/** One of the user's `data/{name}` documents on the server. */
export const serverDoc = (uid: string, name: string) => remote.get(userPath(uid, 'data', name));

/** Ids of the cards in `collectionName` written (set) on the server since the last reset. */
export const cardWrites = (uid: string, collectionName: string) => {
  const prefix = `setDoc ${userPath(uid, collectionName)}/`;
  return remote
    .callsTo('setDoc')
    .filter((call) => call.startsWith(prefix))
    .map((call) => call.slice(prefix.length))
    .sort();
};

/** Ids of the cards in `collectionName` deleted on the server since the last reset. */
export const cardDeletes = (uid: string, collectionName: string) => {
  const prefix = `deleteDoc ${userPath(uid, collectionName)}/`;
  return remote
    .callsTo('deleteDoc')
    .filter((call) => call.startsWith(prefix))
    .map((call) => call.slice(prefix.length))
    .sort();
};

/** A fresh uid per test, so module-level throttles keyed by user never carry over. */
let uidCounter = 0;
export const freshUid = (name = 'learner') => `${name}-${++uidCounter}`;
