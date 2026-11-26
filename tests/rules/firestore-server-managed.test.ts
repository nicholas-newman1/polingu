/**
 * User documents that Cloud Functions create and delete: uploaded audio items,
 * books and their chapters, and rate-limit counters. The owner may read them and
 * rename a few display fields, but must not forge, delete or repoint them (a
 * forged storagePath would let the delete callables remove someone else's
 * files, and a client-written rate limit would bypass the quota).
 */
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { describe, expect, test } from 'vitest';
import { asUser } from './env';
import { OUTSIDERS, outsider, seedDoc, setupRulesEnv } from './support';

const env = setupRulesEnv();

const OWNER = 'alice';
const OTHER = 'mallory';

const owner = () => asUser(env(), OWNER).firestore();

describe('audio items (users/{uid}/audioItems)', () => {
  const path = `users/${OWNER}/audioItems/audio-1`;
  const audioItem = {
    id: 'audio-1',
    userId: OWNER,
    title: 'Podcast episode',
    fileName: 'episode.mp3',
    duration: 321,
    fileSize: 4_000_000,
    storagePath: `audio/users/${OWNER}/audio-1/episode.mp3`,
    status: 'ready',
    transcript: [{ start: 0, end: 1.5, text: 'Dzień dobry' }],
    createdAt: 1_700_000_000_000,
  };

  test('the owner can read and list their audio items', async () => {
    await seedDoc(env(), path, audioItem);
    const snapshot = await assertSucceeds(getDoc(doc(owner(), path)));
    expect(snapshot.data()).toEqual(audioItem);
    const list = await assertSucceeds(getDocs(collection(owner(), 'users', OWNER, 'audioItems')));
    expect(list.size).toBe(1);
  });

  test('the owner can rename an audio item', async () => {
    await seedDoc(env(), path, audioItem);
    await assertSucceeds(updateDoc(doc(owner(), path), { title: 'Renamed' }));
    await assertSucceeds(setDoc(doc(owner(), path), { title: 'Renamed again' }, { merge: true }));
  });

  test.each([
    ['storagePath', `audio/users/${OTHER}/audio-9/secret.mp3`],
    ['userId', OTHER],
    ['status', 'processing'],
    ['transcript', []],
    ['duration', 1],
  ])('the owner cannot change %s', async (field, value) => {
    await seedDoc(env(), path, audioItem);
    await assertFails(updateDoc(doc(owner(), path), { [field]: value }));
    // Not even when slipped in alongside an allowed rename.
    await assertFails(updateDoc(doc(owner(), path), { title: 'Renamed', [field]: value }));
  });

  test('the owner cannot remove fields by overwriting the item with only a title', async () => {
    await seedDoc(env(), path, audioItem);
    await assertFails(setDoc(doc(owner(), path), { title: 'Renamed' }));
  });

  test.each([
    ['error', 'forged'],
    ['language', 'en'],
  ])('the owner cannot add a %s field the item does not have', async (field, value) => {
    await seedDoc(env(), path, audioItem);
    await assertFails(updateDoc(doc(owner(), path), { [field]: value }));
    await assertFails(setDoc(doc(owner(), path), { [field]: value }, { merge: true }));
  });

  test('the owner cannot create or delete audio items, even with the admin claim', async () => {
    for (const db of [owner(), asUser(env(), OWNER, { admin: true }).firestore()]) {
      await assertFails(setDoc(doc(db, 'users', OWNER, 'audioItems', 'forged'), audioItem));
    }
    await seedDoc(env(), path, audioItem);
    await assertFails(deleteDoc(doc(owner(), path)));
    await assertFails(deleteDoc(doc(asUser(env(), OWNER, { admin: true }).firestore(), path)));
  });

  test.each(OUTSIDERS)(
    '%s cannot read, list, rename, create or delete audio items',
    async (who) => {
      await seedDoc(env(), path, audioItem);
      const db = outsider(env(), who).firestore();
      await assertFails(getDoc(doc(db, path)));
      await assertFails(getDocs(collection(db, 'users', OWNER, 'audioItems')));
      await assertFails(updateDoc(doc(db, path), { title: 'Hijacked' }));
      await assertFails(deleteDoc(doc(db, path)));
      await assertFails(setDoc(doc(db, 'users', OWNER, 'audioItems', 'forged'), audioItem));
    }
  );
});

describe('books (users/{uid}/books)', () => {
  const path = `users/${OWNER}/books/book-1`;
  const book = {
    id: 'book-1',
    userId: OWNER,
    title: 'Pan Tadeusz',
    author: 'Adam Mickiewicz',
    fileName: 'pan-tadeusz.pdf',
    fileSize: 2_000_000,
    fileType: 'pdf',
    storagePath: `books/users/${OWNER}/book-1/pan-tadeusz.pdf`,
    uploadedAt: 1_700_000_000_000,
    status: 'ready',
    pageCount: 300,
    wordCount: 70_000,
    color: 'blue',
  };

  test('the owner can read and list their books', async () => {
    await seedDoc(env(), path, book);
    const snapshot = await assertSucceeds(getDoc(doc(owner(), path)));
    expect(snapshot.data()).toEqual(book);
    const list = await assertSucceeds(getDocs(collection(owner(), 'users', OWNER, 'books')));
    expect(list.size).toBe(1);
  });

  test('the owner can edit the title, author and colour together', async () => {
    await seedDoc(env(), path, book);
    await assertSucceeds(
      updateDoc(doc(owner(), path), { title: 'Dziady', author: 'A. Mickiewicz', color: 'red' })
    );
  });

  test('the owner can clear the author, as the edit dialog does for a blank author', async () => {
    await seedDoc(env(), path, book);
    await assertSucceeds(updateDoc(doc(owner(), path), { author: deleteField() }));
    const snapshot = await getDoc(doc(owner(), path));
    expect(snapshot.data()).not.toHaveProperty('author');
  });

  test('the owner can add an author to a book that had none', async () => {
    const withoutAuthor = Object.fromEntries(Object.entries(book).filter(([k]) => k !== 'author'));
    await seedDoc(env(), path, withoutAuthor);
    await assertSucceeds(updateDoc(doc(owner(), path), { author: 'Unknown' }));
  });

  test.each([
    ['storagePath', `books/users/${OTHER}/book-9/private.pdf`],
    ['userId', OTHER],
    ['status', 'processing'],
    ['fileType', 'text'],
    ['wordCount', 1],
  ])('the owner cannot change %s', async (field, value) => {
    await seedDoc(env(), path, book);
    await assertFails(updateDoc(doc(owner(), path), { [field]: value }));
    await assertFails(updateDoc(doc(owner(), path), { title: 'Renamed', [field]: value }));
  });

  test('the owner cannot remove server fields', async () => {
    await seedDoc(env(), path, book);
    await assertFails(updateDoc(doc(owner(), path), { storagePath: deleteField() }));
    await assertFails(setDoc(doc(owner(), path), { title: 'Only a title' }));
  });

  // A failed upload is stored without a storagePath. If the owner could add one, the
  // deleteBook callable would delete whatever file it names, including another user's.
  test('the owner cannot add a storage path to a failed upload that has none', async () => {
    const failed = {
      id: 'book-1',
      userId: OWNER,
      fileName: 'scan.pdf',
      fileSize: 1000,
      status: 'error',
      error: 'File too large. Maximum size is 50MB.',
      uploadedAt: 1_700_000_000_000,
    };
    await seedDoc(env(), path, failed);
    const target = doc(owner(), path);

    await assertFails(updateDoc(target, { storagePath: `books/users/${OTHER}/book-9/a.pdf` }));
    await assertFails(
      setDoc(target, { storagePath: `books/users/${OTHER}/book-9/a.pdf` }, { merge: true })
    );
    // Renaming the failed upload is still allowed.
    await assertSucceeds(updateDoc(target, { title: 'Skan' }));
  });

  test.each([
    ['pageCount', 999],
    ['error', 'forged'],
    ['shared', true],
  ])('the owner cannot add a %s field the book does not have', async (field, value) => {
    await seedDoc(env(), path, book);
    await assertFails(updateDoc(doc(owner(), path), { [field]: value }));
  });

  test('the owner cannot create or delete books, even with the admin claim', async () => {
    for (const db of [owner(), asUser(env(), OWNER, { admin: true }).firestore()]) {
      await assertFails(setDoc(doc(db, 'users', OWNER, 'books', 'forged'), book));
    }
    await seedDoc(env(), path, book);
    await assertFails(deleteDoc(doc(owner(), path)));
    await assertFails(deleteDoc(doc(asUser(env(), OWNER, { admin: true }).firestore(), path)));
  });

  test.each(OUTSIDERS)('%s cannot read, list, edit, create or delete books', async (who) => {
    await seedDoc(env(), path, book);
    const db = outsider(env(), who).firestore();
    await assertFails(getDoc(doc(db, path)));
    await assertFails(getDocs(collection(db, 'users', OWNER, 'books')));
    await assertFails(updateDoc(doc(db, path), { title: 'Hijacked' }));
    await assertFails(deleteDoc(doc(db, path)));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'books', 'forged'), book));
  });
});

describe('book chapters (users/{uid}/books/{bookId}/chapters)', () => {
  const path = `users/${OWNER}/books/book-1/chapters/ch-1`;
  const chapter = { index: 0, title: 'Księga pierwsza', text: 'Litwo! Ojczyzno moja!' };

  test('the owner can read and list the chapters of their book', async () => {
    await seedDoc(env(), path, chapter);
    await seedDoc(env(), `users/${OWNER}/books/book-1/chapters/ch-2`, { ...chapter, index: 1 });
    await assertSucceeds(getDoc(doc(owner(), path)));
    const list = await assertSucceeds(
      getDocs(collection(owner(), 'users', OWNER, 'books', 'book-1', 'chapters'))
    );
    expect(list.size).toBe(2);
  });

  test('the owner cannot create, edit or delete chapters, even with the admin claim', async () => {
    for (const db of [owner(), asUser(env(), OWNER, { admin: true }).firestore()]) {
      await assertFails(setDoc(doc(db, `users/${OWNER}/books/book-1/chapters/forged`), chapter));
    }
    await seedDoc(env(), path, chapter);
    await assertFails(updateDoc(doc(owner(), path), { text: 'Edited' }));
    await assertFails(setDoc(doc(owner(), path), { text: 'Edited' }, { merge: true }));
    await assertFails(deleteDoc(doc(owner(), path)));
  });

  test.each(OUTSIDERS)('%s cannot read, list or edit the chapters', async (who) => {
    await seedDoc(env(), path, chapter);
    const db = outsider(env(), who).firestore();
    await assertFails(getDoc(doc(db, path)));
    await assertFails(getDocs(collection(db, 'users', OWNER, 'books', 'book-1', 'chapters')));
    await assertFails(updateDoc(doc(db, path), { text: 'Hijacked' }));
  });
});

describe('rate limits (userRateLimits/{uid})', () => {
  const path = `userRateLimits/${OWNER}`;
  const limits = {
    dailyCharsUsed: 9_000,
    dailyCharsDate: '2026-11-26',
    recentRequests: [1_764_100_000_000],
  };

  test('the owner can read their own counters', async () => {
    await seedDoc(env(), path, limits);
    const snapshot = await assertSucceeds(getDoc(doc(owner(), path)));
    expect(snapshot.data()).toEqual(limits);
  });

  test('the owner cannot create, reset or delete their counters', async () => {
    await assertFails(setDoc(doc(owner(), path), { dailyCharsUsed: 0 }));
    await seedDoc(env(), path, limits);
    await assertFails(updateDoc(doc(owner(), path), { dailyCharsUsed: 0 }));
    await assertFails(setDoc(doc(owner(), path), { dailyCharsUsed: 0 }, { merge: true }));
    await assertFails(deleteDoc(doc(owner(), path)));
  });

  test('an admin cannot write rate limits from the client either', async () => {
    const admin = asUser(env(), OWNER, { admin: true }).firestore();
    await assertFails(setDoc(doc(admin, path), { dailyCharsUsed: 0 }));
  });

  test.each(OUTSIDERS)("%s cannot read or change a user's counters", async (who) => {
    await seedDoc(env(), path, limits);
    const db = outsider(env(), who).firestore();
    await assertFails(getDoc(doc(db, path)));
    await assertFails(updateDoc(doc(db, path), { dailyCharsUsed: 0 }));
  });

  test('nobody can list every user’s counters', async () => {
    await seedDoc(env(), path, limits);
    for (const db of [owner(), asUser(env(), 'admin-user', { admin: true }).firestore()]) {
      await assertFails(getDocs(collection(db, 'userRateLimits')));
    }
  });
});
