/**
 * Server-side fixtures: what another device (or an earlier session) left in Firestore.
 */
import type { CustomVocabularyWord } from '../../../../src/types/vocabulary';
import type { CustomSentence } from '../../../../src/types/sentences';
import type { CustomDeclensionCard } from '../../../../src/types';
import type { Book, ReadingProgress } from '../../../../src/types/reader';
import type { TranslationDirection } from '../../../../src/types/common';
import { ratedCard, userPath } from '../../../sync/support/harness';
import { remote } from './firestore';
import { userDb } from '../../../../src/lib/offlineDb/userDb';

export { userPath };

/** Mid-November 2026, a fixed "earlier" for createdAt values. */
const BASE_TIME = Date.UTC(2026, 10, 1, 12);
export const daysAfterBase = (days: number) => BASE_TIME + days * 864e5;

export function word(
  id: string,
  polish: string,
  english: string,
  extra: Partial<CustomVocabularyWord> = {}
): CustomVocabularyWord {
  return { id, polish, english, isCustom: true, createdAt: BASE_TIME, ...extra };
}

export function sentence(
  id: string,
  polish: string,
  english: string,
  extra: Partial<CustomSentence> = {}
): CustomSentence {
  return {
    id,
    polish,
    english,
    level: 'A1',
    tags: [],
    isCustom: true,
    createdAt: BASE_TIME,
    ...extra,
  } as CustomSentence;
}

export function declensionCard(
  id: string,
  front: string,
  declined: string,
  extra: Partial<CustomDeclensionCard> = {}
): CustomDeclensionCard {
  return {
    id,
    front,
    back: front.replace('___', declined),
    declined,
    case: 'Genitive',
    gender: 'Masculine',
    number: 'Singular',
    isCustom: true,
    createdAt: BASE_TIME,
    ...extra,
  } as CustomDeclensionCard;
}

type Collection = 'customVocabulary' | 'customSentences' | 'customDeclension';

export function seedCustom(uid: string, collection: Collection, items: Array<{ id: string }>) {
  for (const item of items) remote.seed(userPath(uid, collection, item.id), item);
}

/** The user's custom items as the server has them, keyed by id. */
export function serverItems(uid: string, collection: Collection) {
  return remote.list(userPath(uid, collection));
}

/** A review card rated `Good` a week ago, serialized the way the app stores it. */
function reviewedCard(idField: string, id: string) {
  const fsrsCard = ratedCard(new Date(Date.now() - 7 * 864e5));
  return {
    [idField]: id,
    fsrsCard: {
      ...fsrsCard,
      due: fsrsCard.due.toISOString(),
      last_review: fsrsCard.last_review!.toISOString(),
    },
  };
}

const DIRECTION_SUFFIX: Record<TranslationDirection, string> = {
  'pl-to-en': 'pl-en',
  'en-to-pl': 'en-pl',
};

/** Marks `wordId` as already studied in `direction`. */
export function seedReviewedWord(
  uid: string,
  wordId: string,
  direction: TranslationDirection = 'pl-to-en'
) {
  const path = userPath(uid, `vocabularyReviewCards-${DIRECTION_SUFFIX[direction]}`, wordId);
  remote.seed(path, reviewedCard('wordId', wordId));
}

export function seedReviewedSentence(
  uid: string,
  sentenceId: string,
  direction: TranslationDirection = 'pl-to-en'
) {
  const path = userPath(uid, `sentenceReviewCards-${DIRECTION_SUFFIX[direction]}`, sentenceId);
  remote.seed(path, reviewedCard('sentenceId', sentenceId));
}

export function seedReviewedDeclensionCard(uid: string, cardId: string) {
  remote.seed(userPath(uid, 'declensionReviewCards', cardId), reviewedCard('cardId', cardId));
}

export function book(id: string, extra: Partial<Book> = {}): Book {
  return {
    id,
    userId: 'learner-a',
    title: `Book ${id}`,
    fileName: `${id}.txt`,
    fileSize: 1000,
    fileType: 'text',
    storagePath: `books/users/learner-a/${id}/${id}.txt`,
    uploadedAt: BASE_TIME,
    status: 'ready',
    ...extra,
  };
}

/**
 * Puts the books on the server and in the library's local cache, as a previous visit
 * to the library leaves them. (The library shows its cached list and the live one in
 * whichever order they arrive, so the two must agree for a stable picture.)
 */
export async function seedBooks(uid: string, items: Book[]) {
  for (const item of items) remote.seed(userPath(uid, 'books', item.id), item);
  const listed = [...items].sort((a, b) => b.uploadedAt - a.uploadedAt);
  await userDb.userData.put({
    key: '__books-list',
    data: listed,
    lastModified: Date.now(),
    pendingSync: 0,
  });
}

export function seedReadingProgress(uid: string, progress: ReadingProgress) {
  remote.seed(userPath(uid, 'data', `reader-progress-${progress.bookId}`), progress);
}
