import { describe, expect, test, vi } from 'vitest';
import { processBookUpload } from '../../src/triggers/storage/processBookUpload.js';
import { DEFAULT_BUCKET } from '../../src/shared/config.js';
import { createUser, db, installFakes, storage } from '../support/sdk.js';
import { runObjectFinalized, type UploadedObject } from '../support/invoke.js';
import { installTestClock } from '../support/clock.js';
import { makePdf } from '../support/media.js';

vi.mock('firebase-admin/app', () => import('../support/sdk.js').then((m) => m.adminApp));
vi.mock('firebase-admin/firestore', () =>
  import('../support/sdk.js').then((m) => m.adminFirestore)
);
vi.mock('firebase-admin/storage', () => import('../support/sdk.js').then((m) => m.adminStorage));
vi.mock('firebase-admin/auth', () => import('../support/sdk.js').then((m) => m.adminAuth));

installFakes();
installTestClock();

const reader = createUser('reader-1');
const admin = createUser('admin-1', { admin: true });

const MB = 1024 * 1024;
const GB = 1024 * MB;

const pendingPath = (fileName: string, uid = reader.uid, bookId = 'b1') =>
  `books/users/${uid}/pending/${bookId}/${fileName}`;
const bookPath = (uid = reader.uid, bookId = 'b1') => `users/${uid}/books/${bookId}`;

/** Puts `data` in the pending folder and runs the trigger for it. */
function upload(
  fileName: string,
  data: Buffer,
  {
    uid = reader.uid,
    contentType,
    size = data.length,
    metadata,
  }: { uid?: string; contentType?: string; size?: number; metadata?: Record<string, string> } = {}
) {
  const name = pendingPath(fileName, uid);
  storage.seed(DEFAULT_BUCKET, name, { data, contentType });
  const object: UploadedObject = {
    name,
    bucket: DEFAULT_BUCKET,
    size: String(size),
    contentType,
    metadata,
  };
  return runObjectFinalized(processBookUpload, object);
}

const pdf = () => makePdf({ pages: 12, info: { Title: 'Pan Tadeusz', Author: 'Adam Mickiewicz' } });

function expectFailed(message: string, fileName: string, uid = reader.uid) {
  expect(db.data(bookPath(uid))).toEqual({
    id: 'b1',
    userId: uid,
    fileName,
    fileSize: expect.any(Number),
    status: 'error',
    error: message,
    uploadedAt: Date.now(),
  });
  expect(storage.file(DEFAULT_BUCKET, pendingPath(fileName, uid))).toBeUndefined();
  expect(db.data(`users/${uid}/data/reader-progress-b1`)).toBeUndefined();
}

describe('successful uploads', () => {
  test('a PDF becomes a ready book with its embedded title, author and page count', async () => {
    const data = pdf();
    await upload('pan-tadeusz.pdf', data, { contentType: 'application/pdf' });

    expect(db.data(bookPath())).toEqual({
      id: 'b1',
      userId: reader.uid,
      title: 'Pan Tadeusz',
      author: 'Adam Mickiewicz',
      fileName: 'pan-tadeusz.pdf',
      fileSize: data.length,
      fileType: 'pdf',
      storagePath: `books/users/${reader.uid}/b1/pan-tadeusz.pdf`,
      uploadedAt: Date.now(),
      status: 'ready',
      color: expect.any(String),
      pageCount: 12,
    });
  });

  test('the file moves out of pending to the book’s storage path', async () => {
    const data = pdf();
    await upload('pan-tadeusz.pdf', data, { contentType: 'application/pdf' });

    expect(storage.file(DEFAULT_BUCKET, pendingPath('pan-tadeusz.pdf'))).toBeUndefined();
    expect(storage.file(DEFAULT_BUCKET, `books/users/${reader.uid}/b1/pan-tadeusz.pdf`)?.data).toBe(
      data
    );
  });

  test('reading progress starts on page one', async () => {
    await upload('pan-tadeusz.pdf', pdf(), { contentType: 'application/pdf' });

    expect(db.data(`users/${reader.uid}/data/reader-progress-b1`)).toEqual({
      bookId: 'b1',
      currentPage: 1,
      scrollPercent: 0,
      lastReadAt: Date.now(),
    });
  });

  test('a title and author typed by the reader win over the PDF’s own', async () => {
    await upload('x.pdf', pdf(), {
      contentType: 'application/pdf',
      metadata: { booktitle: '  Moja książka ', bookauthor: 'Ja' },
    });
    expect(db.data(bookPath())).toMatchObject({ title: 'Moja książka', author: 'Ja' });
  });

  test('blank typed metadata falls back to the PDF’s own', async () => {
    await upload('x.pdf', pdf(), {
      contentType: 'application/pdf',
      metadata: { booktitle: '   ', bookauthor: '' },
    });
    expect(db.data(bookPath())).toMatchObject({ title: 'Pan Tadeusz', author: 'Adam Mickiewicz' });
  });

  test('a PDF is recognised by its extension when the content type is generic', async () => {
    await upload('book.pdf', pdf(), { contentType: 'application/octet-stream' });
    expect(db.data(bookPath())).toMatchObject({ status: 'ready', fileType: 'pdf' });
  });

  // BUG: uploadBook() in src/lib/reader/uploadBook.ts accepts a file whose name ends in
  // ".pdf" in any case, and the browser may give such a file no type, so Storage records
  // application/octet-stream. processBookUpload checks the extension case-sensitively
  // (fileName.endsWith('.pdf')), so "SCAN.PDF" is turned into an error book. storage.rules
  // has the same case-sensitive check (see tests/rules/storage.test.ts), so both need the
  // fix. Expected: a ready PDF book. Actual: "Invalid file type".
  test.fails('a PDF with an upper-case extension and a generic type is accepted', async () => {
    await upload('SCAN.PDF', pdf(), { contentType: 'application/octet-stream' });
    expect(db.data(bookPath())).toMatchObject({ status: 'ready', fileType: 'pdf' });
  });

  test('a PDF without an author is stored without one', async () => {
    await upload('x.pdf', makePdf({ info: { Title: 'Bez autora' } }), {
      contentType: 'application/pdf',
    });
    expect(db.data(bookPath())).not.toHaveProperty('author');
  });

  // BUG: buildPdfBook falls back to the file name with `extracted.title || fileName`, but
  // extractPdfMetadata always returns a title ("Untitled" when the PDF has none), so the
  // fallback can never run. Expected title: "Lalka" (from Lalka.pdf). Actual: "Untitled".
  test.fails('a PDF without a title is named after its file', async () => {
    await upload('Lalka.pdf', makePdf({ pages: 2 }), { contentType: 'application/pdf' });
    expect(db.data(bookPath())?.title).toBe('Lalka');
  });

  test('a text file becomes a book titled by its first line, with a word count', async () => {
    const text = Buffer.from('Lalka\nBolesław Prus\n\nW początkach roku 1878');
    await upload('book.txt', text, { contentType: 'text/plain' });

    expect(db.data(bookPath())).toMatchObject({
      title: 'Lalka',
      fileType: 'text',
      wordCount: 7,
      status: 'ready',
    });
    expect(db.data(bookPath())).not.toHaveProperty('author');
    expect(db.data(bookPath())).not.toHaveProperty('pageCount');
  });

  test('a text file keeps a typed author', async () => {
    await upload('book.txt', Buffer.from('Tekst'), {
      contentType: 'text/plain',
      metadata: { bookauthor: 'Prus' },
    });
    expect(db.data(bookPath())).toMatchObject({ title: 'Tekst', author: 'Prus' });
  });

  test('a new book gets a colour none of the reader’s other books use', async () => {
    const colors = ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'indigo', 'purple'];
    colors.forEach((color, i) =>
      db.seed(bookPath(reader.uid, `old${i}`), { status: 'ready', color, fileSize: 1 })
    );

    await upload('x.pdf', pdf(), { contentType: 'application/pdf' });
    expect(db.data(bookPath())?.color).toBe('pink');
  });

  test('a book exactly filling the 1 GB quota is accepted', async () => {
    db.seed(bookPath(reader.uid, 'old'), { status: 'ready', fileSize: GB - 1000 });
    await upload('x.pdf', pdf(), { contentType: 'application/pdf', size: 1000 });
    expect(db.data(bookPath())?.status).toBe('ready');
  });
});

describe('ignored objects', () => {
  test.each([
    ['a book that was already processed', `books/users/u1/b1/x.pdf`],
    ['an audio upload', `audio/users/u1/pending/a1/x.mp3`],
  ])('ignores %s', async (_case, name) => {
    storage.seed(DEFAULT_BUCKET, name, { data: Buffer.from('x') });
    await runObjectFinalized(processBookUpload, { name, bucket: DEFAULT_BUCKET, size: 1 });

    expect(db.writes).toEqual([]);
    expect(storage.file(DEFAULT_BUCKET, name)).toBeDefined();
  });
});

describe('rejected uploads', () => {
  test('an unsupported file type is recorded as an error and the upload removed', async () => {
    await upload('cover.png', Buffer.from('png'), { contentType: 'image/png' });
    expectFailed('Invalid file type. Only PDF and plain text files are supported.', 'cover.png');
  });

  test('a file over 50 MB is rejected', async () => {
    await upload('big.pdf', pdf(), { contentType: 'application/pdf', size: 50 * MB + 1 });
    expectFailed('File too large. Maximum size is 50MB.', 'big.pdf');
  });

  test('a file of exactly 50 MB is accepted', async () => {
    await upload('big.pdf', pdf(), { contentType: 'application/pdf', size: 50 * MB });
    expect(db.data(bookPath())?.status).toBe('ready');
  });

  test('a book that would take the reader over 1 GB is rejected', async () => {
    db.seed(bookPath(reader.uid, 'old'), { status: 'ready', fileSize: GB - 1000 });
    await upload('x.pdf', pdf(), { contentType: 'application/pdf', size: 1001 });
    expectFailed('Storage quota exceeded. Maximum is 1GB.', 'x.pdf');
  });

  test('failed and other readers’ books do not count towards the quota', async () => {
    db.seed(bookPath(reader.uid, 'failed'), { status: 'error', fileSize: GB });
    db.seed(bookPath('someone-else', 'theirs'), { status: 'ready', fileSize: GB });
    await upload('x.pdf', pdf(), { contentType: 'application/pdf' });
    expect(db.data(bookPath())?.status).toBe('ready');
  });

  test('a text file that is not UTF-8 is rejected with a helpful message', async () => {
    await upload('book.txt', Buffer.from([0xa3, 0xf3, 0x64, 0xbc]), { contentType: 'text/plain' });
    expectFailed('Invalid text encoding. Please use UTF-8.', 'book.txt');
  });

  test('an empty text file is rejected', async () => {
    await upload('book.txt', Buffer.from('  \n '), { contentType: 'text/plain' });
    expectFailed('Text file is empty.', 'book.txt');
  });

  test('a corrupt PDF is rejected', async () => {
    await upload('broken.pdf', Buffer.from('%PDF-1.4 truncated'), {
      contentType: 'application/pdf',
    });
    expect(db.data(bookPath())?.status).toBe('error');
    expect(storage.file(DEFAULT_BUCKET, pendingPath('broken.pdf'))).toBeUndefined();
  });

  test('a pending file that disappeared is recorded as an error', async () => {
    const name = pendingPath('gone.pdf');
    await runObjectFinalized(processBookUpload, {
      name,
      bucket: DEFAULT_BUCKET,
      size: 10,
      contentType: 'application/pdf',
    });
    expect(db.data(bookPath())?.status).toBe('error');
  });
});

describe('kill switch', () => {
  test('book uploads from readers are refused while books are disabled', async () => {
    db.seed('config/killSwitch', { booksDisabled: true });
    await upload('x.pdf', pdf(), { contentType: 'application/pdf' });
    expectFailed('Book uploads are temporarily unavailable.', 'x.pdf');
  });

  test('admins can still upload books', async () => {
    db.seed('config/killSwitch', { booksDisabled: true });
    await upload('x.pdf', pdf(), { uid: admin.uid, contentType: 'application/pdf' });
    expect(db.data(bookPath(admin.uid))?.status).toBe('ready');
  });

  test('other disabled services do not block books', async () => {
    db.seed('config/killSwitch', { audioDisabled: true, translateDisabled: true });
    await upload('x.pdf', pdf(), { contentType: 'application/pdf' });
    expect(db.data(bookPath())?.status).toBe('ready');
  });
});
