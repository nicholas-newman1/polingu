/**
 * Built-in content shared by every learner (sentences, vocabulary, declension
 * cards, verbs, system audio, tag and kill-switch config). Anyone may read it,
 * signed in or not; only a user whose token carries `admin: true` may change it.
 * Paths outside the named ones are closed to everybody, admins included.
 */
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { describe, expect, test } from 'vitest';
import { asGuest, asUser } from './env';
import { seedDoc, setupRulesEnv, type TestFirestore } from './support';

const env = setupRulesEnv();

const admin = () => asUser(env(), 'admin-user', { admin: true }).firestore();

/** Collections where every document is public-read, admin-write. */
const SHARED_COLLECTIONS = [
  'sentences',
  'vocabulary',
  'declensionCards',
  'verbs',
  'systemAudioItems',
];

/** Single config documents with the same rule. */
const SHARED_CONFIG_DOCS = ['config/sentenceTags', 'config/killSwitch'];

const sharedDocPaths = [
  ...SHARED_COLLECTIONS.map((name) => `${name}/item-1`),
  ...SHARED_CONFIG_DOCS,
];

/** Checks that `db` can neither create, overwrite, update nor delete `path`. */
async function assertCannotWrite(db: TestFirestore, path: string) {
  const target = doc(db, path);
  await assertFails(setDoc(target, { text: 'created' }));
  await seedDoc(env(), path, { text: 'original' });
  await assertFails(setDoc(target, { text: 'overwritten' }));
  await assertFails(setDoc(target, { text: 'merged' }, { merge: true }));
  await assertFails(updateDoc(target, { text: 'changed' }));
  await assertFails(deleteDoc(target));
}

describe.each(sharedDocPaths)('%s', (path) => {
  test('a guest and any signed-in user can read it', async () => {
    await seedDoc(env(), path, { text: 'Dzień dobry' });
    for (const db of [asGuest(env()).firestore(), asUser(env(), 'alice').firestore()]) {
      const snapshot = await assertSucceeds(getDoc(doc(db, path)));
      expect(snapshot.data()).toEqual({ text: 'Dzień dobry' });
    }
  });

  test('an admin can create, update and delete it', async () => {
    const target = doc(admin(), path);
    await assertSucceeds(setDoc(target, { text: 'Cześć' }));
    await assertSucceeds(updateDoc(target, { text: 'Hej' }));
    await assertSucceeds(setDoc(target, { audioUrl: 'x' }, { merge: true }));
    await assertSucceeds(deleteDoc(target));
  });

  test('a signed-in user without the admin claim cannot change it', async () => {
    await assertCannotWrite(asUser(env(), 'alice').firestore(), path);
  });

  test('a guest cannot change it', async () => {
    await assertCannotWrite(asGuest(env()).firestore(), path);
  });

  test.each([
    ['admin: false', { admin: false }],
    ["admin: 'true' (a string)", { admin: 'true' }],
    ['admin: 1', { admin: 1 }],
    ['a different role claim', { role: 'admin' }],
  ])('a user whose claim is %s cannot change it', async (_label, claims) => {
    await assertCannotWrite(asUser(env(), 'alice', claims).firestore(), path);
  });
});

describe.each(SHARED_COLLECTIONS)('the %s collection', (name) => {
  test('a guest can load the whole collection', async () => {
    await seedDoc(env(), `${name}/item-1`, { n: 1 });
    await seedDoc(env(), `${name}/item-2`, { n: 2 });
    const snapshot = await assertSucceeds(getDocs(collection(asGuest(env()).firestore(), name)));
    expect(snapshot.size).toBe(2);
  });

  test('documents nested below an item are closed, even to an admin', async () => {
    const path = `${name}/item-1/history/h1`;
    await assertFails(setDoc(doc(admin(), path), { text: 'x' }));
    await seedDoc(env(), path, { text: 'x' });
    await assertFails(getDoc(doc(asGuest(env()).firestore(), path)));
    await assertFails(getDoc(doc(admin(), path)));
  });
});

describe('paths that no rule names', () => {
  const unmatched = ['config/featureFlags', 'admins/alice', 'customSentences/c1', 'audioItems/a1'];

  test.each(unmatched)('%s cannot be read or written, even by an admin', async (path) => {
    for (const db of [asGuest(env()).firestore(), asUser(env(), 'alice').firestore(), admin()]) {
      await assertFails(setDoc(doc(db, path), { value: 1 }));
    }
    await seedDoc(env(), path, { value: 1 });
    for (const db of [asGuest(env()).firestore(), asUser(env(), 'alice').firestore(), admin()]) {
      await assertFails(getDoc(doc(db, path)));
      await assertFails(updateDoc(doc(db, path), { value: 2 }));
      await assertFails(deleteDoc(doc(db, path)));
    }
  });

  test('nobody can list the config collection, which may hold unlisted documents', async () => {
    await seedDoc(env(), 'config/killSwitch', { enabled: false });
    await seedDoc(env(), 'config/featureFlags', { beta: true });
    for (const db of [asGuest(env()).firestore(), admin()]) {
      await assertFails(getDocs(collection(db, 'config')));
    }
  });
});
