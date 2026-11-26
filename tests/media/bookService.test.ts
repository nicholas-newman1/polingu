import { describe, expect, test, vi } from 'vitest';
import {
  deleteBook,
  getBook,
  getBookDownloadUrl,
  getBookTextContent,
  getCachedBooks,
  getReadingProgress,
  getStorageUsage,
  saveReadingProgress,
  subscribeToBooksUpdates,
  updateBook,
} from '../../src/lib/reader';
import { syncAllPendingToFirestore } from '../../src/lib/offlineDb/userDataWrapper';
import type { Book, ReadingProgress } from '../../src/types/reader';
import { remote } from './support/fakeFirestore';
import { server } from './support/fakeFunctions';
import { bucket, downloadUrlFor } from './support/fakeStorage';
import {
  flushMicrotasks,
  network,
  setupMediaTests,
  settle,
  signIn,
  userPath,
} from './support/harness';

vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));
vi.mock('firebase/storage', () => import('./support/fakeStorage'));
vi.mock('firebase/functions', () => import('./support/fakeFunctions'));

setupMediaTests();

const UID = 'learner-a';
const bookPath = (id: string, uid = UID) => userPath(uid, 'books', id);
const progressPath = (bookId: string) => userPath(UID, 'data', `reader-progress-${bookId}`);

const book = (id: string, overrides: Partial<Book> = {}): Book => ({
  id,
  userId: UID,
  title: `Book ${id}`,
  fileName: `${id}.pdf`,
  fileSize: 1000,
  fileType: 'pdf',
  storagePath: `books/users/${UID}/${id}/${id}.pdf`,
  uploadedAt: 0,
  status: 'ready',
  ...overrides,
});

const progress = (bookId: string, overrides: Partial<ReadingProgress> = {}): ReadingProgress => ({
  bookId,
  currentPage: 12,
  scrollPercent: 0.4,
  lastReadAt: 1_700_000_000_000,
  ...overrides,
});

/** Loads the book list once through the live subscription, which also caches it. */
async function loadBookList() {
  const unsubscribe = subscribeToBooksUpdates(() => {});
  await flushMicrotasks();
  unsubscribe();
  await settle();
}

type TextResponse = { ok: boolean; text: () => Promise<string> };

function stubDownloads(body: string, ok = true) {
  const fetchMock = vi.fn<(url: string) => Promise<TextResponse>>(async () => ({
    ok,
    text: async () => body,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('the book list', () => {
  test('is empty offline before it has ever loaded', async () => {
    signIn(UID);
    expect(await getCachedBooks()).toEqual([]);
  });

  test('lists the user’s books, most recently uploaded first, and keeps a copy for offline use', async () => {
    signIn(UID);
    remote.seed(bookPath('old'), book('old', { uploadedAt: 1 }));
    remote.seed(bookPath('new'), book('new', { uploadedAt: 3 }));
    remote.seed(bookPath('mid'), book('mid', { uploadedAt: 2 }));
    remote.seed(bookPath('theirs', 'learner-b'), book('theirs', { userId: 'learner-b' }));
    const lists: string[][] = [];

    subscribeToBooksUpdates((books) => lists.push(books.map((b) => b.id)));
    await flushMicrotasks();
    await settle();

    expect(lists).toEqual([['new', 'mid', 'old']]);
    expect(await getCachedBooks()).toEqual([
      book('new', { uploadedAt: 3 }),
      book('mid', { uploadedAt: 2 }),
      book('old', { uploadedAt: 1 }),
    ]);
  });

  test('follows books being added and deleted', async () => {
    signIn(UID);
    remote.seed(bookPath('a'), book('a', { uploadedAt: 1 }));
    const lists: string[][] = [];
    subscribeToBooksUpdates((books) => lists.push(books.map((b) => b.id)));
    await flushMicrotasks();

    remote.seed(bookPath('b'), book('b', { uploadedAt: 2, status: 'processing' }));
    await flushMicrotasks();
    remote.remove(bookPath('a'));
    await flushMicrotasks();
    await settle();

    expect(lists).toEqual([['a'], ['b', 'a'], ['b']]);
    expect((await getCachedBooks()).map((b) => b.id)).toEqual(['b']);
  });

  test('is not loaded while signed out', async () => {
    const callback = vi.fn();
    subscribeToBooksUpdates(callback)();
    await flushMicrotasks();

    expect(callback).not.toHaveBeenCalled();
    expect(remote.calls).toEqual([]);
  });

  test('a failed subscription is logged and delivers nothing', async () => {
    signIn(UID);
    remote.fail({ op: 'onSnapshot' });
    const callback = vi.fn();

    subscribeToBooksUpdates(callback);
    await flushMicrotasks();

    expect(callback).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      'Books subscription error:',
      expect.objectContaining({ code: 'permission-denied' })
    );
  });
});

describe('opening a book', () => {
  test('online, the book is read from the server', async () => {
    signIn(UID);
    remote.seed(bookPath('a'), book('a', { title: 'Lalka' }));

    expect(await getBook('a')).toEqual(book('a', { title: 'Lalka' }));
  });

  test('a book that does not exist is null', async () => {
    signIn(UID);
    expect(await getBook('missing')).toBeNull();
  });

  test('offline, the book comes from the cached list without contacting the server', async () => {
    signIn(UID);
    remote.seed(bookPath('a'), book('a', { title: 'Lalka' }));
    await loadBookList();
    network.goOffline();
    remote.calls.length = 0;

    expect(await getBook('a')).toEqual(book('a', { title: 'Lalka' }));
    expect(await getBook('never-cached')).toBeNull();
    expect(remote.calls).toEqual([]);
  });

  test('when the server cannot be reached, the cached copy is used', async () => {
    signIn(UID);
    remote.seed(bookPath('a'), book('a', { title: 'Lalka' }));
    await loadBookList();
    network.serverUnreachable();

    expect(await getBook('a')).toEqual(book('a', { title: 'Lalka' }));
    expect(await getBook('never-cached')).toBeNull();
  });

  test('nothing is returned while signed out', async () => {
    remote.seed(bookPath('a'), book('a'));

    expect(await getBook('a')).toBeNull();
    expect(remote.calls).toEqual([]);
  });

  test('a PDF is opened from its download URL', async () => {
    bucket.files.add('books/users/learner-a/a/a.pdf');

    expect(await getBookDownloadUrl('books/users/learner-a/a/a.pdf')).toBe(
      downloadUrlFor('books/users/learner-a/a/a.pdf')
    );
    await expect(getBookDownloadUrl('books/users/learner-a/gone.pdf')).rejects.toMatchObject({
      code: 'storage/object-not-found',
    });
  });
});

describe('the text of a text book', () => {
  const storagePath = 'books/users/learner-a/t1/book.txt';

  test('is downloaded the first time, then served from the offline copy', async () => {
    signIn(UID);
    bucket.files.add(storagePath);
    const fetchMock = stubDownloads('Litwo! Ojczyzno moja!');

    expect(await getBookTextContent('t1', storagePath)).toBe('Litwo! Ojczyzno moja!');
    expect(fetchMock).toHaveBeenCalledWith(downloadUrlFor(storagePath));

    network.goOffline();
    expect(await getBookTextContent('t1', storagePath)).toBe('Litwo! Ojczyzno moja!');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('offline, a book never opened before cannot be read', async () => {
    signIn(UID);
    const fetchMock = stubDownloads('unused');
    network.goOffline();

    await expect(getBookTextContent('t1', storagePath)).rejects.toThrow(
      'Text not available offline. Open this book once while online.'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('a failed download is reported and not cached, so the next open tries again', async () => {
    signIn(UID);
    bucket.files.add(storagePath);
    stubDownloads('Error page', false);

    await expect(getBookTextContent('t1', storagePath)).rejects.toThrow(
      'Failed to load text content.'
    );

    stubDownloads('Litwo!');
    expect(await getBookTextContent('t1', storagePath)).toBe('Litwo!');
  });

  test('a text whose file is gone from Storage is not downloaded, cached or served offline', async () => {
    signIn(UID);
    const fetchMock = stubDownloads('unused');

    await expect(getBookTextContent('t1', storagePath)).rejects.toMatchObject({
      code: 'storage/object-not-found',
    });
    expect(fetchMock).not.toHaveBeenCalled();

    network.goOffline();
    await expect(getBookTextContent('t1', storagePath)).rejects.toThrow(
      'Text not available offline'
    );
  });

  test('each book keeps its own offline copy', async () => {
    signIn(UID);
    bucket.files.add(storagePath);
    bucket.files.add('books/users/learner-a/t2/book.txt');
    stubDownloads('First book');
    await getBookTextContent('t1', storagePath);
    stubDownloads('Second book');

    expect(await getBookTextContent('t2', 'books/users/learner-a/t2/book.txt')).toBe('Second book');
    expect(await getBookTextContent('t1', storagePath)).toBe('First book');
  });
});

describe('reading progress and bookmarks', () => {
  test('a book never opened has no progress', async () => {
    signIn(UID);
    expect(await getReadingProgress('a')).toBeNull();
  });

  test('saved progress, including bookmarks, is stored on the account and read back', async () => {
    signIn(UID);
    const saved = progress('a', { bookmarks: [3, 17], textAnchorIndex: 40, textBookmarks: [2] });

    await saveReadingProgress(saved);

    expect(remote.get(progressPath('a'))).toEqual(saved);
    expect(await getReadingProgress('a')).toEqual(saved);
  });

  test('each book keeps its own progress', async () => {
    signIn(UID);
    await saveReadingProgress(progress('a', { currentPage: 5 }));
    await saveReadingProgress(progress('b', { currentPage: 99 }));

    expect((await getReadingProgress('a'))?.currentPage).toBe(5);
    expect((await getReadingProgress('b'))?.currentPage).toBe(99);
  });

  test('progress from another device is picked up on a device that has none cached', async () => {
    signIn(UID);
    remote.seed(progressPath('a'), progress('a', { currentPage: 200, bookmarks: [150] }));

    expect(await getReadingProgress('a')).toEqual(
      progress('a', { currentPage: 200, bookmarks: [150] })
    );
  });

  test('progress saved offline is kept on the device and reaches the account when back online', async () => {
    signIn(UID);
    network.goOffline();

    await saveReadingProgress(progress('a', { currentPage: 42, bookmarks: [7] }));

    expect(await getReadingProgress('a')).toEqual(
      progress('a', { currentPage: 42, bookmarks: [7] })
    );
    expect(remote.get(progressPath('a'))).toBeUndefined();

    network.goOnline();
    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(progressPath('a'))).toEqual(
      progress('a', { currentPage: 42, bookmarks: [7] })
    );
  });

  test('a rejected save does not throw, and the progress is kept for the next sync', async () => {
    signIn(UID);
    remote.fail({ op: 'setDoc', path: progressPath('a') }, { times: 1 });

    await expect(saveReadingProgress(progress('a', { currentPage: 8 }))).resolves.toBeUndefined();

    expect(await getReadingProgress('a')).toEqual(progress('a', { currentPage: 8 }));
    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(progressPath('a'))).toEqual(progress('a', { currentPage: 8 }));
  });

  test('a newer save replaces the older one, bookmarks included', async () => {
    signIn(UID);
    await saveReadingProgress(progress('a', { bookmarks: [1, 2] }));

    await saveReadingProgress(progress('a', { currentPage: 30, bookmarks: [2] }));

    expect(await getReadingProgress('a')).toEqual(
      progress('a', { currentPage: 30, bookmarks: [2] })
    );
    expect(remote.get(progressPath('a'))).toEqual(
      progress('a', { currentPage: 30, bookmarks: [2] })
    );
  });

  test('while signed out nothing is saved or loaded', async () => {
    await saveReadingProgress(progress('a'));

    expect(await getReadingProgress('a')).toBeNull();
    expect(remote.calls).toEqual([]);
  });
});

describe('editing and deleting books', () => {
  test('editing trims the title and author and sets the colour, leaving other fields alone', async () => {
    signIn(UID);
    remote.seed(bookPath('a'), book('a', { author: 'Old' }));

    await updateBook('a', { title: '  Lalka ', author: ' Bolesław Prus ', color: 'teal' });

    expect(remote.get(bookPath('a'))).toEqual(
      book('a', { title: 'Lalka', author: 'Bolesław Prus', color: 'teal' })
    );
  });

  test('clearing the author removes it from the book', async () => {
    signIn(UID);
    remote.seed(bookPath('a'), book('a', { author: 'Anonim' }));

    await updateBook('a', { author: '   ' });

    expect(remote.get(bookPath('a'))).toEqual(book('a'));
  });

  test('fields not being edited are left as they are', async () => {
    signIn(UID);
    remote.seed(bookPath('a'), book('a', { author: 'Prus', color: 'red' }));

    await updateBook('a', { color: 'blue' });

    expect(remote.get(bookPath('a'))).toEqual(book('a', { author: 'Prus', color: 'blue' }));
  });

  test('editing requires a signed-in user', async () => {
    await expect(updateBook('a', { title: 'x' })).rejects.toThrow('Not authenticated');
    expect(remote.calls).toEqual([]);
  });

  test('deleting asks the server to delete the book and drops its offline text', async () => {
    signIn(UID);
    const storagePath = 'books/users/learner-a/t1/book.txt';
    bucket.files.add(storagePath);
    stubDownloads('Old text');
    await getBookTextContent('t1', storagePath);
    server.handle('deleteBook', () => ({ success: true }));

    await deleteBook('t1');

    expect(server.callsTo('deleteBook')).toEqual([{ bookId: 't1' }]);
    network.goOffline();
    await expect(getBookTextContent('t1', storagePath)).rejects.toThrow(
      'Text not available offline'
    );
  });

  test('when the server refuses the delete, the error reaches the caller and the offline text is kept', async () => {
    signIn(UID);
    const storagePath = 'books/users/learner-a/t1/book.txt';
    bucket.files.add(storagePath);
    stubDownloads('Still here');
    await getBookTextContent('t1', storagePath);
    server.handle('deleteBook', () => {
      throw new Error('Book not found.');
    });

    await expect(deleteBook('t1')).rejects.toThrow('Book not found.');

    network.goOffline();
    expect(await getBookTextContent('t1', storagePath)).toBe('Still here');
  });

  test('storage usage is reported as the server computes it', async () => {
    signIn(UID);
    server.handle('getStorageUsage', () => ({ usedBytes: 12_345, maxBytes: 500 * 1024 * 1024 }));

    expect(await getStorageUsage()).toEqual({ usedBytes: 12_345, maxBytes: 500 * 1024 * 1024 });
  });
});
