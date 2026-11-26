/**
 * Callables learners use for their own audio and books: createUserAudio,
 * deleteUserAudio, deleteBook and getStorageUsage.
 */
import { describe, expect, test, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/https';
import { createUserAudio } from '../../src/callables/createUserAudio.js';
import { deleteUserAudio } from '../../src/callables/deleteUserAudio.js';
import { deleteBook } from '../../src/callables/deleteBook.js';
import { getStorageUsage } from '../../src/callables/getStorageUsage.js';
import { DEFAULT_BUCKET } from '../../src/shared/config.js';
import { createUser, db, installFakes, storage, tasks } from '../support/sdk.js';
import { call } from '../support/invoke.js';
import { installTestClock } from '../support/clock.js';

vi.mock('firebase-admin/app', () => import('../support/sdk.js').then((m) => m.adminApp));
vi.mock('firebase-admin/firestore', () =>
  import('../support/sdk.js').then((m) => m.adminFirestore)
);
vi.mock('firebase-admin/storage', () => import('../support/sdk.js').then((m) => m.adminStorage));
vi.mock('firebase-admin/auth', () => import('../support/sdk.js').then((m) => m.adminAuth));
vi.mock('firebase-admin/functions', () =>
  import('../support/sdk.js').then((m) => m.adminFunctions)
);

installFakes();
installTestClock();

const learner = createUser('learner-1');
const admin = createUser('admin-1', { admin: true });

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => {
      throw new Error('expected a rejection');
    },
    (e: unknown) => e
  );
  expect(error).toBeInstanceOf(HttpsError);
  return error as HttpsError;
}

describe('createUserAudio', () => {
  const create = (data: Record<string, unknown>, user = learner) =>
    call(createUserAudio, data as never, user);
  const items = (uid = learner.uid) => db.childPaths(`users/${uid}/audioItems`);

  test('rejects signed-out callers', async () => {
    const error = await rejection(call(createUserAudio, { title: 'T', text: 'Cześć' }));
    expect(error.code).toBe('unauthenticated');
    expect(db.writes).toEqual([]);
  });

  test('creates a processing item for the learner and queues the text for synthesis', async () => {
    const { id } = await create({ title: 'Moja lekcja', text: 'Dzień dobry.' });

    expect(db.data(`users/${learner.uid}/audioItems/${id}`)).toEqual({
      id,
      userId: learner.uid,
      title: 'Moja lekcja',
      fileName: 'audio.mp3',
      duration: 0,
      fileSize: 0,
      storagePath: '',
      status: 'processing',
      transcript: [],
      createdAt: Date.now(),
    });
    expect(tasks.enqueued).toEqual([
      {
        queue: 'processUserTextAudio',
        data: { userId: learner.uid, audioId: id, text: 'Dzień dobry.' },
        options: { dispatchDeadlineSeconds: 600 },
      },
    ]);
  });

  test('accepts text of exactly 2000 characters', async () => {
    await create({ title: 'T', text: 'a'.repeat(2000) });
    expect(tasks.enqueued).toHaveLength(1);
  });

  test.each([
    ['no title', { text: 'Cześć' }, 'Title is required.'],
    ['a non-string title', { title: ['T'], text: 'Cześć' }, 'Title is required.'],
    ['no text', { title: 'T', text: '' }, 'Valid text required (max 2000 chars).'],
    ['non-string text', { title: 'T', text: 12 }, 'Valid text required (max 2000 chars).'],
    [
      'text over 2000 characters',
      { title: 'T', text: 'a'.repeat(2001) },
      'Valid text required (max 2000 chars).',
    ],
  ])('rejects a request with %s', async (_case, data, message) => {
    const error = await rejection(create(data));
    expect(error).toMatchObject({ code: 'invalid-argument', message });
    expect(items()).toEqual([]);
    expect(tasks.enqueued).toEqual([]);
  });

  test('a learner who already has an audio item is refused', async () => {
    db.seed(`users/${learner.uid}/audioItems/old`, { id: 'old', status: 'ready' });

    const error = await rejection(create({ title: 'T', text: 'Cześć' }));
    expect(error).toMatchObject({
      code: 'resource-exhausted',
      message: 'Audio limit reached. Delete your existing audio to create a new one.',
    });
    expect(items()).toEqual([`users/${learner.uid}/audioItems/old`]);
    expect(tasks.enqueued).toEqual([]);
  });

  test('admins can create more than one audio item', async () => {
    db.seed(`users/${admin.uid}/audioItems/old`, { id: 'old', status: 'ready' });
    await create({ title: 'T', text: 'Cześć' }, admin);
    expect(items(admin.uid)).toHaveLength(2);
  });

  test('deleting the existing item frees the learner’s slot', async () => {
    const { id } = await create({ title: 'First', text: 'Raz.' });
    await call(deleteUserAudio, { audioId: id }, learner);

    await create({ title: 'Second', text: 'Dwa.' });
    expect(items()).toHaveLength(1);
  });

  test('learners are refused while audio is disabled, before anything is created', async () => {
    db.seed('config/killSwitch', { audioDisabled: true });

    const error = await rejection(create({ title: 'T', text: 'Cześć' }));
    expect(error.code).toBe('unavailable');
    expect(items()).toEqual([]);
  });

  test('admins are not affected by the kill switch', async () => {
    db.seed('config/killSwitch', { audioDisabled: true });
    await create({ title: 'T', text: 'Cześć' }, admin);
    expect(tasks.enqueued).toHaveLength(1);
  });

  // BUG: createUserAudio reserves the learner's single audio slot and then enqueues the
  // synthesis task outside any try/catch. If enqueueing fails the item is left in
  // "processing" forever and keeps blocking the learner's only slot. processAudioUpload
  // handles the same failure by marking the item as an error. Expected: the item is
  // marked failed (or removed). Actual: it stays "processing".
  test.fails('an item whose task cannot be queued is not left processing forever', async () => {
    tasks.failure = new Error('queue unavailable');
    await create({ title: 'T', text: 'Cześć' }).catch(() => {});

    const [path] = items();
    expect(db.data(path)?.status).not.toBe('processing');
  });
});

describe('deleteUserAudio', () => {
  const itemPath = `users/${learner.uid}/audioItems/a1`;
  const filePath = `audio/users/${learner.uid}/a1/lesson.mp3`;

  test('rejects signed-out callers', async () => {
    const error = await rejection(call(deleteUserAudio, { audioId: 'a1' }));
    expect(error.code).toBe('unauthenticated');
  });

  test('deletes the learner’s item and its audio file', async () => {
    db.seed(itemPath, { id: 'a1', userId: learner.uid, storagePath: filePath });
    storage.seed(DEFAULT_BUCKET, filePath, { data: Buffer.from('mp3') });

    expect(await call(deleteUserAudio, { audioId: 'a1' }, learner)).toEqual({ success: true });
    expect(db.data(itemPath)).toBeUndefined();
    expect(storage.file(DEFAULT_BUCKET, filePath)).toBeUndefined();
  });

  test('deletes an item whose file is already gone', async () => {
    db.seed(itemPath, { id: 'a1', userId: learner.uid, storagePath: filePath });
    await call(deleteUserAudio, { audioId: 'a1' }, learner);
    expect(db.data(itemPath)).toBeUndefined();
  });

  test('deletes a failed item that never got a file', async () => {
    db.seed(itemPath, { id: 'a1', userId: learner.uid, storagePath: '', status: 'error' });
    await call(deleteUserAudio, { audioId: 'a1' }, learner);
    expect(db.data(itemPath)).toBeUndefined();
  });

  test('rejects a request without an audio id', async () => {
    const error = await rejection(call(deleteUserAudio, { audioId: '' }, learner));
    expect(error.code).toBe('invalid-argument');
  });

  test('reports an item that does not exist', async () => {
    const error = await rejection(call(deleteUserAudio, { audioId: 'nope' }, learner));
    expect(error.code).toBe('not-found');
  });

  test('cannot reach another user’s item', async () => {
    const theirs = 'users/someone-else/audioItems/a1';
    db.seed(theirs, { id: 'a1', userId: 'someone-else', storagePath: 'x' });

    const error = await rejection(call(deleteUserAudio, { audioId: 'a1' }, learner));
    expect(error.code).toBe('not-found');
    expect(db.data(theirs)).toBeDefined();
  });

  test('refuses an item in the learner’s folder that belongs to someone else', async () => {
    db.seed(itemPath, { id: 'a1', userId: 'someone-else', storagePath: filePath });
    storage.seed(DEFAULT_BUCKET, filePath, { data: Buffer.from('mp3') });

    const error = await rejection(call(deleteUserAudio, { audioId: 'a1' }, learner));
    expect(error.code).toBe('permission-denied');
    expect(db.data(itemPath)).toBeDefined();
    expect(storage.file(DEFAULT_BUCKET, filePath)).toBeDefined();
  });
});

describe('deleteBook', () => {
  const bookPath = `users/${learner.uid}/books/b1`;
  const progressPath = `users/${learner.uid}/data/reader-progress-b1`;
  const filePath = `books/users/${learner.uid}/b1/book.pdf`;

  function seedBook(fields: Record<string, unknown> = {}) {
    db.seed(bookPath, { id: 'b1', userId: learner.uid, storagePath: filePath, ...fields });
    db.seed(progressPath, { bookId: 'b1', currentPage: 42 });
    storage.seed(DEFAULT_BUCKET, filePath, { data: Buffer.from('%PDF') });
  }

  test('rejects signed-out callers', async () => {
    const error = await rejection(call(deleteBook, { bookId: 'b1' }));
    expect(error.code).toBe('unauthenticated');
  });

  test('deletes the book, its file and its reading progress', async () => {
    seedBook();
    db.seed(`users/${learner.uid}/data/reader-progress-b2`, { bookId: 'b2', currentPage: 7 });

    expect(await call(deleteBook, { bookId: 'b1' }, learner)).toEqual({ success: true });
    expect(db.data(bookPath)).toBeUndefined();
    expect(db.data(progressPath)).toBeUndefined();
    expect(storage.file(DEFAULT_BUCKET, filePath)).toBeUndefined();
    expect(db.data(`users/${learner.uid}/data/reader-progress-b2`)).toEqual({
      bookId: 'b2',
      currentPage: 7,
    });
  });

  test('deletes a book whose file is already gone', async () => {
    seedBook();
    storage.reset();
    await call(deleteBook, { bookId: 'b1' }, learner);
    expect(db.data(bookPath)).toBeUndefined();
  });

  test('deletes a failed upload that has no file', async () => {
    db.seed(bookPath, { id: 'b1', userId: learner.uid, status: 'error' });
    await call(deleteBook, { bookId: 'b1' }, learner);
    expect(db.data(bookPath)).toBeUndefined();
  });

  test('rejects a request without a book id', async () => {
    const error = await rejection(call(deleteBook, { bookId: '' }, learner));
    expect(error.code).toBe('invalid-argument');
  });

  test('reports a book that does not exist', async () => {
    const error = await rejection(call(deleteBook, { bookId: 'nope' }, learner));
    expect(error.code).toBe('not-found');
  });

  test('cannot reach another reader’s book', async () => {
    db.seed('users/someone-else/books/b1', { id: 'b1', userId: 'someone-else' });
    const error = await rejection(call(deleteBook, { bookId: 'b1' }, learner));
    expect(error.code).toBe('not-found');
    expect(db.data('users/someone-else/books/b1')).toBeDefined();
  });

  test('refuses a book in the reader’s folder that belongs to someone else', async () => {
    seedBook({ userId: 'someone-else' });

    const error = await rejection(call(deleteBook, { bookId: 'b1' }, learner));
    expect(error.code).toBe('permission-denied');
    expect(db.data(bookPath)).toBeDefined();
    expect(db.data(progressPath)).toBeDefined();
    expect(storage.file(DEFAULT_BUCKET, filePath)).toBeDefined();
  });
});

describe('getStorageUsage', () => {
  test('rejects signed-out callers', async () => {
    const error = await rejection(call(getStorageUsage, undefined));
    expect(error.code).toBe('unauthenticated');
  });

  test('reports the bytes used by the caller’s ready books against the 1 GB quota', async () => {
    db.seed(`users/${learner.uid}/books/a`, { status: 'ready', fileSize: 1500 });
    db.seed(`users/${learner.uid}/books/b`, { status: 'error', fileSize: 9000 });
    db.seed('users/someone-else/books/c', { status: 'ready', fileSize: 7000 });

    expect(await call(getStorageUsage, undefined, learner)).toEqual({
      usedBytes: 1500,
      maxBytes: 1024 ** 3,
    });
  });
});
