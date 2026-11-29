import { describe, expect, test, vi } from 'vitest';
import { uploadBook, uploadText } from '../../src/lib/reader';
import type { UploadProgress } from '../../src/lib/media/storageFiles';
import { remote } from './support/fakeFirestore';
import { bucket, StorageError } from './support/fakeStorage';
import {
  fileOfSize,
  flushMicrotasks,
  MB,
  setupMediaTests,
  signIn,
  userPath,
} from './support/harness';

vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));
vi.mock('firebase/storage', () => import('./support/fakeStorage'));

setupMediaTests();

const UID = 'learner-a';
const PENDING_PATH = new RegExp(`^books/users/${UID}/pending/([0-9a-f-]{36})/(.+)$`);

const pdf = (name = 'Lalka.pdf', size = 1000) => fileOfSize(name, 'application/pdf', size);

/** Tracks an upload started by `start`. */
function track(start: (onProgress: (p: UploadProgress) => void) => Promise<string>) {
  const progress: UploadProgress[] = [];
  let settled = false;
  const result = start((p) => progress.push(p));
  result.then(
    () => (settled = true),
    () => (settled = true)
  );
  const upload = bucket.onlyUpload;
  const bookId = PENDING_PATH.exec(upload.path)?.[1] ?? '';
  return {
    result,
    upload,
    bookId,
    progress,
    statuses: () => progress.map((p) => p.status),
    isSettled: () => settled,
    bookPath: userPath(UID, 'books', bookId),
  };
}

describe('uploading a PDF book', () => {
  test('sends the file to the user’s pending folder under a fresh id, keeping its name', () => {
    signIn(UID);
    const file = pdf('Pan Tadeusz.pdf');
    const { upload, bookId } = track((p) => uploadBook(file, p));

    expect(upload.path).toBe(`books/users/${UID}/pending/${bookId}/Pan Tadeusz.pdf`);
    expect(upload.data).toBe(file);
  });

  test('attaches the trimmed title and author for the server to use', () => {
    signIn(UID);
    const { upload } = track((p) =>
      uploadBook(pdf(), p, { title: '  Lalka ', author: ' Bolesław Prus  ' })
    );

    expect(upload.metadata).toEqual({
      customMetadata: { booktitle: 'Lalka', bookauthor: 'Bolesław Prus' },
    });
  });

  test('leaves out a blank title or author', () => {
    signIn(UID);
    const { upload } = track((p) => uploadBook(pdf(), p, { title: '   ', author: '' }));

    expect(upload.metadata).toEqual({ customMetadata: {} });
  });

  test('reports upload percentage, then processing, then resolves with the id once ready', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    signIn(UID);
    const { upload, result, bookId, progress, bookPath } = track((p) =>
      uploadBook(pdf('a.pdf', 2000), p)
    );

    upload.progress(500);
    upload.progress(2000);
    upload.finish();
    remote.seed(bookPath, { id: bookId, status: 'processing' });
    await flushMicrotasks();
    remote.seed(bookPath, { id: bookId, status: 'ready' });

    await expect(result).resolves.toBe(bookId);
    expect(progress).toEqual([
      { status: 'uploading', uploadPercent: 25 },
      { status: 'uploading', uploadPercent: 100 },
      { status: 'processing' },
      { status: 'ready' },
    ]);
    expect(remote.listenerCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('rejects with the server’s message when processing fails', async () => {
    signIn(UID);
    const { upload, result, bookId, progress, bookPath } = track((p) => uploadBook(pdf(), p));
    upload.finish();

    remote.seed(bookPath, { id: bookId, status: 'error', error: 'PDF is encrypted.' });

    await expect(result).rejects.toThrow('PDF is encrypted.');
    expect(progress.at(-1)).toEqual({ status: 'error', error: 'PDF is encrypted.' });
    expect(remote.listenerCount).toBe(0);
  });

  test('a processing failure without a message still rejects with a generic one', async () => {
    signIn(UID);
    const { upload, result, bookId, bookPath } = track((p) => uploadBook(pdf(), p));
    upload.finish();

    remote.seed(bookPath, { id: bookId, status: 'error' });

    await expect(result).rejects.toThrow('Processing failed.');
  });

  test('gives up after five minutes of processing and stops listening', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    signIn(UID);
    const { upload, result, isSettled } = track((p) => uploadBook(pdf(), p));
    upload.finish();
    await flushMicrotasks();

    vi.advanceTimersByTime(5 * 60 * 1000 - 1);
    await flushMicrotasks();
    expect(isSettled()).toBe(false);

    vi.advanceTimersByTime(1);
    await expect(result).rejects.toThrow('Processing timed out. Please try again.');
    expect(remote.listenerCount).toBe(0);
  });

  test('a failed upload is reported and rejects with the storage error', async () => {
    signIn(UID);
    const { upload, result, progress } = track((p) => uploadBook(pdf(), p));
    const error = new StorageError('storage/unauthorized', 'Storage limit reached.');

    upload.fail(error);

    await expect(result).rejects.toBe(error);
    expect(progress).toEqual([{ status: 'error', error: 'Storage limit reached.' }]);
    expect(remote.listenerCount).toBe(0);
  });
});

describe('validating a book file', () => {
  test.each([
    ['Lalka.pdf', 'application/pdf'],
    ['LALKA.PDF', ''],
    ['scan', 'application/pdf'],
  ])('accepts %s (%s) as a PDF', (name, type) => {
    signIn(UID);
    uploadBook(fileOfSize(name, type, 1000), () => {});

    expect(bucket.onlyUpload.path).toMatch(PENDING_PATH);
  });

  test.each([
    ['notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['book.epub', 'application/epub+zip'],
    ['pdf', ''],
  ])('rejects %s (%s) without uploading', async (name, type) => {
    signIn(UID);

    await expect(uploadBook(fileOfSize(name, type, 1000), () => {})).rejects.toThrow(
      'Only PDF files are supported.'
    );
    expect(bucket.uploads).toEqual([]);
  });

  test('accepts a file of exactly 50 MB and rejects anything larger without uploading', async () => {
    signIn(UID);
    uploadBook(pdf('max.pdf', 50 * MB), () => {});
    expect(bucket.uploads).toHaveLength(1);

    await expect(uploadBook(pdf('big.pdf', 50 * MB + 1), () => {})).rejects.toThrow(
      'File too large. Maximum size is 50MB.'
    );
    expect(bucket.uploads).toHaveLength(1);
  });

  test('requires a signed-in user', async () => {
    await expect(uploadBook(pdf(), () => {})).rejects.toThrow('Not authenticated');
    expect(bucket.uploads).toEqual([]);
  });
});

describe('uploading pasted text', () => {
  test('uploads the trimmed text as a plain-text book with its title and author', async () => {
    signIn(UID);
    const { upload, bookId } = track((p) =>
      uploadText(
        {
          content: '\n  Litwo! Ojczyzno moja!\n\n',
          title: ' Pan Tadeusz ',
          author: ' A. Mickiewicz',
        },
        p
      )
    );

    expect(upload.path).toBe(`books/users/${UID}/pending/${bookId}/book.txt`);
    expect(upload.data.type).toBe('text/plain');
    expect(await upload.data.text()).toBe('Litwo! Ojczyzno moja!');
    expect(upload.metadata).toEqual({
      customMetadata: { booktitle: 'Pan Tadeusz', bookauthor: 'A. Mickiewicz' },
    });
  });

  test('then waits for processing like a PDF', async () => {
    signIn(UID);
    const { upload, result, bookId, bookPath, statuses } = track((p) =>
      uploadText({ content: 'Tekst' }, p)
    );

    upload.finish();
    remote.seed(bookPath, { id: bookId, status: 'ready' });

    await expect(result).resolves.toBe(bookId);
    expect(statuses()).toEqual(['processing', 'ready']);
  });

  test('a blank title and a missing author are left out of the metadata', () => {
    signIn(UID);
    const { upload } = track((p) => uploadText({ content: 'Tekst', title: ' ' }, p));

    expect(upload.metadata).toEqual({ customMetadata: {} });
  });

  test('rejects empty or whitespace-only text without uploading', async () => {
    signIn(UID);

    await expect(uploadText({ content: ' \n\t ' }, () => {})).rejects.toThrow(
      'Text cannot be empty.'
    );
    expect(bucket.uploads).toEqual([]);
  });

  test('requires a signed-in user', async () => {
    await expect(uploadText({ content: 'Tekst' }, () => {})).rejects.toThrow('Not authenticated');
    expect(bucket.uploads).toEqual([]);
  });
});
