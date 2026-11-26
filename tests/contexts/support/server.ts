/**
 * Puts data on the fake Firestore server the way the app writes it, and waits
 * for the provider's asynchronous work (IndexedDB, background sync) to settle.
 */
import type { Card } from 'ts-fsrs';
import { remote } from '../../sync/support/fakeFirestore';
import { settle, userPath } from '../../sync/support/harness';
import type { DeclensionCard } from '../../../src/types';
import type { Sentence } from '../../../src/types/sentences';
import type { Verb } from '../../../src/types/conjugation';
import type { VocabularyWord } from '../../../src/types/vocabulary';

/** A review card document as the app stores it: dates as ISO strings. */
export const serializedCard = (idField: string, id: string, fsrsCard: Card) => ({
  [idField]: id,
  fsrsCard: {
    ...fsrsCard,
    due: fsrsCard.due.toISOString(),
    last_review: fsrsCard.last_review ? fsrsCard.last_review.toISOString() : null,
  },
});

export const seedServerCard = (
  uid: string,
  collectionName: string,
  idField: string,
  id: string,
  fsrsCard: Card
) => remote.seed(userPath(uid, collectionName, id), serializedCard(idField, id, fsrsCard));

export const seedUserDoc = (uid: string, name: string, data: object) =>
  remote.seed(userPath(uid, 'data', name), data);

/** Built-in content, readable by everyone. */
export function seedContent(content: {
  vocabulary?: VocabularyWord[];
  sentences?: Sentence[];
  verbs?: Verb[];
  declensionCards?: DeclensionCard[];
}) {
  for (const [collectionName, items] of Object.entries(content)) {
    for (const item of items as Array<{ id: string | number }>) {
      remote.seed(`${collectionName}/${item.id}`, item);
    }
  }
}

/**
 * Waits until no new Firestore call has been made for a stretch of macrotasks,
 * so a load or background sync, including its final IndexedDB reads, is over.
 */
export async function idle(quietRounds = 30) {
  let quiet = 0;
  let seen = remote.calls.length;
  while (quiet < quietRounds) {
    await settle();
    if (remote.calls.length === seen) quiet++;
    else {
      seen = remote.calls.length;
      quiet = 0;
    }
  }
}

/**
 * How many background syncs have reached the content refresh. Every sync reads
 * the `verbs` collection exactly once; so does a first load with an empty cache.
 */
export const contentReads = () =>
  remote.callsTo('getDocs').filter((c) => c === 'getDocs verbs').length;
