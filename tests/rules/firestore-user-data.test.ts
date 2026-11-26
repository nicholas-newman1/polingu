/**
 * Owner-only learner data under users/{uid}: settings, per-day session
 * counters, per-card review history and custom cards. Losing write access here
 * silently drops a learner's progress, and gaining read access leaks it, so
 * every document and subcollection the rules name is checked from each side.
 */
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { describe, expect, test } from 'vitest';
import { asGuest, asUser } from './env';
import { seedDoc, setupRulesEnv, type TestFirestore } from './support';

const env = setupRulesEnv();

const OWNER = 'alice';
const OTHER = 'mallory';

/** Documents in users/{uid}/data that a rule names explicitly. */
const NAMED_DATA_DOCS = [
  'settings', // declension settings
  'userFilters',
  'reviewData', // legacy declension
  'declensionReviewSession',
  'vocabularyReviewData-pl-en', // legacy
  'vocabularyReviewData-en-pl', // legacy
  'vocabularyReviewSession-pl-en',
  'vocabularyReviewSession-en-pl',
  'vocabularySettings-pl-en',
  'vocabularySettings-en-pl',
  'sentenceReviewData-pl-en', // legacy
  'sentenceReviewData-en-pl', // legacy
  'sentenceReviewSession-pl-en',
  'sentenceReviewSession-en-pl',
  'sentenceSettings-pl-en',
  'sentenceSettings-en-pl',
  'conjugationReviewData-pl-en', // legacy
  'conjugationReviewData-en-pl', // legacy
  'conjugationReviewSession-pl-en',
  'conjugationReviewSession-en-pl',
  'conjugationSettings-pl-en',
  'conjugationSettings-en-pl',
  'aspectPairsReviewData', // legacy
  'aspectPairsReviewSession',
  'aspectPairsSettings',
  'appSettings',
  'reader-settings',
  'listeningSettings',
  'listeningHubSelections',
];

/** Subcollections of users/{uid} where the owner may read and write any document. */
const OWNER_SUBCOLLECTIONS = [
  'declensionReviewCards',
  'vocabularyReviewCards-pl-en',
  'vocabularyReviewCards-en-pl',
  'sentenceReviewCards-pl-en',
  'sentenceReviewCards-en-pl',
  'conjugationReviewForms-pl-en',
  'conjugationReviewForms-en-pl',
  'aspectPairsReviewCards',
  'customSentences',
  'customVocabulary',
  'customDeclension',
  'audioQueue',
];

const ownerOnlyPaths = (uid: string) => [
  ...NAMED_DATA_DOCS.map((name) => `users/${uid}/data/${name}`),
  // Reader progress is stored per book under a generated name.
  `users/${uid}/data/reader-progress-book-123`,
  ...OWNER_SUBCOLLECTIONS.map((name) => `users/${uid}/${name}/card-1`),
];

/** Checks that `db` can neither create, read, overwrite, update nor delete `path`. */
async function assertLockedOut(db: TestFirestore, path: string) {
  const target = doc(db, path);
  await assertFails(setDoc(target, { value: 'created by intruder' }));
  await seedDoc(env(), path, { value: 'original' });
  await assertFails(getDoc(target));
  await assertFails(setDoc(target, { value: 'overwritten by intruder' }));
  await assertFails(setDoc(target, { value: 'merged by intruder' }, { merge: true }));
  await assertFails(updateDoc(target, { value: 'changed by intruder' }));
  await assertFails(deleteDoc(target));
}

describe.each(ownerOnlyPaths(OWNER))('%s', (path) => {
  test('the owner can create, read, update and delete it', async () => {
    const target = doc(asUser(env(), OWNER).firestore(), path);
    await assertSucceeds(setDoc(target, { value: 1 }));
    await assertSucceeds(setDoc(target, { other: true }, { merge: true }));
    await assertSucceeds(updateDoc(target, { value: 2 }));
    const snapshot = await assertSucceeds(getDoc(target));
    expect(snapshot.data()).toEqual({ value: 2, other: true });
    await assertSucceeds(deleteDoc(target));
  });

  test('another signed-in user can neither read nor write it', async () => {
    await assertLockedOut(asUser(env(), OTHER).firestore(), path);
  });

  test('an admin who is not the owner can neither read nor write it', async () => {
    await assertLockedOut(asUser(env(), 'admin-user', { admin: true }).firestore(), path);
  });

  test('a guest can neither read nor write it', async () => {
    await assertLockedOut(asGuest(env()).firestore(), path);
  });
});

describe.each(OWNER_SUBCOLLECTIONS)('the %s subcollection', (name) => {
  test('the owner can list all of their documents in it', async () => {
    await seedDoc(env(), `users/${OWNER}/${name}/card-1`, { n: 1 });
    await seedDoc(env(), `users/${OWNER}/${name}/card-2`, { n: 2 });

    const snapshot = await assertSucceeds(
      getDocs(collection(asUser(env(), OWNER).firestore(), 'users', OWNER, name))
    );
    expect(snapshot.docs.map((d) => d.id).sort()).toEqual(['card-1', 'card-2']);
  });

  test('another user cannot list or query it', async () => {
    await seedDoc(env(), `users/${OWNER}/${name}/card-1`, { n: 1 });
    const db = asUser(env(), OTHER).firestore();
    await assertFails(getDocs(collection(db, 'users', OWNER, name)));
    await assertFails(getDocs(query(collection(db, 'users', OWNER, name), where('n', '==', 1))));
  });

  test('a guest cannot list it', async () => {
    await seedDoc(env(), `users/${OWNER}/${name}/card-1`, { n: 1 });
    await assertFails(getDocs(collection(asGuest(env()).firestore(), 'users', OWNER, name)));
  });

  test('a collection-group query across every user is denied, even to an admin', async () => {
    await seedDoc(env(), `users/${OWNER}/${name}/card-1`, { n: 1 });
    await seedDoc(env(), `users/${OTHER}/${name}/card-1`, { n: 1 });
    for (const db of [
      asUser(env(), OWNER).firestore(),
      asUser(env(), 'admin-user', { admin: true }).firestore(),
    ]) {
      await assertFails(getDocs(collectionGroup(db, name)));
    }
  });
});

describe('reader documents in users/{uid}/data', () => {
  test('the owner can save progress for any book under a reader- name', async () => {
    const db = asUser(env(), OWNER).firestore();
    for (const name of ['reader-progress-abc', 'reader-progress-9f1c-uuid', 'reader-bookmarks']) {
      await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'data', name), { page: 3 }));
    }
  });

  test('the reader- prefix must start the document name', async () => {
    const db = asUser(env(), OWNER).firestore();
    for (const name of ['xreader-progress-abc', 'my-reader-progress', 'Reader-progress-abc']) {
      await assertFails(setDoc(doc(db, 'users', OWNER, 'data', name), { page: 3 }));
    }
  });
});

describe('paths under users/{uid} that no rule names', () => {
  const unmatched = [
    // The user root document itself.
    `users/${OWNER}`,
    // A data document with an unrecognised name.
    `users/${OWNER}/data/declensionSettings`,
    `users/${OWNER}/data/unknown`,
    // A subcollection no rule mentions.
    `users/${OWNER}/customConjugation/card-1`,
    `users/${OWNER}/vocabularyReviewCards/card-1`,
    // Nested below an allowed document; rules do not recurse.
    `users/${OWNER}/declensionReviewCards/card-1/history/h1`,
    `users/${OWNER}/data/settings/history/h1`,
    `users/${OWNER}/customSentences/card-1/notes/n1`,
  ];

  test.each(unmatched)('%s is closed even to its owner', async (path) => {
    const target = doc(asUser(env(), OWNER).firestore(), path);
    await assertFails(setDoc(target, { value: 1 }));
    await seedDoc(env(), path, { value: 1 });
    await assertFails(getDoc(target));
    await assertFails(updateDoc(target, { value: 2 }));
    await assertFails(deleteDoc(target));
  });

  test('nobody can list the users collection', async () => {
    await seedDoc(env(), `users/${OWNER}`, { name: 'Alice' });
    for (const db of [
      asGuest(env()).firestore(),
      asUser(env(), OWNER).firestore(),
      asUser(env(), 'admin-user', { admin: true }).firestore(),
    ]) {
      await assertFails(getDocs(collection(db, 'users')));
    }
  });

  test("nobody can list another user's data documents", async () => {
    await seedDoc(env(), `users/${OWNER}/data/settings`, { newCardsPerDay: 10 });
    await assertFails(
      getDocs(collection(asUser(env(), OTHER).firestore(), 'users', OWNER, 'data'))
    );
    await assertFails(getDocs(collection(asGuest(env()).firestore(), 'users', OWNER, 'data')));
  });
});
