import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadString } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import { asGuest, asUser, createRulesEnv } from './env';

// Proves the emulator pipeline works end to end. Thorough coverage of each
// rule lives in the other files in this folder.
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createRulesEnv();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
});
afterAll(async () => {
  await env?.cleanup();
});

describe('user settings', () => {
  const path = 'users/alice/data/settings';

  test('the owner can write and read them', async () => {
    const db = asUser(env, 'alice').firestore();
    await assertSucceeds(setDoc(doc(db, path), { newCardsPerDay: 10 }));
    await assertSucceeds(getDoc(doc(db, path)));
  });

  test('another user cannot read them', async () => {
    await assertFails(getDoc(doc(asUser(env, 'mallory').firestore(), path)));
  });

  test('a guest cannot read them', async () => {
    await assertFails(getDoc(doc(asGuest(env).firestore(), path)));
  });
});

test('storage: a user cannot upload into another user’s pending audio folder', async () => {
  const storage = asUser(env, 'mallory').storage();
  const target = ref(storage, 'audio/users/alice/pending/a1/clip.mp3');
  await assertFails(uploadString(target, 'x', 'raw', { contentType: 'audio/mpeg' }));
});
