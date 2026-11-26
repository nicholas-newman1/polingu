/**
 * Storage rules. Clients may only upload into their own pending folders (audio
 * and books), within a size cap and with an accepted type; Cloud Functions move
 * the files on and write everything else. Processed files are readable by their
 * owner only, and system audio by any signed-in user.
 */
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  deleteObject,
  getBytes,
  getMetadata,
  ref,
  updateMetadata,
  uploadBytes,
} from 'firebase/storage';
import { describe, expect, test } from 'vitest';
import { asGuest, asUser } from './env';
import { OUTSIDERS, outsider, seedFile, setupRulesEnv, type TestStorage } from './support';

const env = setupRulesEnv();

const OWNER = 'alice';
const OTHER = 'mallory';
const MB = 1024 * 1024;

const owner = () => asUser(env(), OWNER).storage();

const upload = (storage: TestStorage, path: string, contentType: string, size = 3) =>
  uploadBytes(ref(storage, path), new Uint8Array(size), { contentType });

describe('pending audio uploads (audio/users/{uid}/pending/{audioId}/{file})', () => {
  const pending = (fileName: string) => `audio/users/${OWNER}/pending/audio-1/${fileName}`;

  test.each([
    ['episode.mp3', 'audio/mpeg'],
    ['memo.m4a', 'audio/x-m4a'],
    ['take.wav', 'audio/wav'],
    ['song.ogg', 'audio/ogg'],
    ['set.flac', 'audio/flac'],
    // The type is enough on its own; the name does not matter.
    ['recording', 'audio/webm'],
  ])('the owner can upload %s sent as %s', async (fileName, contentType) => {
    await assertSucceeds(upload(owner(), pending(fileName), contentType));
  });

  test.each(['episode.mp3', 'memo.m4a', 'take.wav', 'song.ogg', 'set.flac'])(
    'the owner can upload %s when the browser reports no audio type',
    async (fileName) => {
      await assertSucceeds(upload(owner(), pending(fileName), 'application/octet-stream'));
    }
  );

  test.each([
    ['notes.txt', 'text/plain'],
    ['cover.png', 'image/png'],
    ['clip.mp4', 'video/mp4'],
    ['episode.mp3.exe', 'application/octet-stream'],
    ['episode.mp3x', 'application/octet-stream'],
    ['episode', 'application/octet-stream'],
  ])('the owner cannot upload %s sent as %s', async (fileName, contentType) => {
    await assertFails(upload(owner(), pending(fileName), contentType));
  });

  // BUG: the upload form (src/lib/audio/uploadAudio.ts) and the processing
  // function (functions/src/shared/userAudio.ts) both lower-case the extension,
  // so they accept "VOICE.M4A" even when the browser gives it no audio type
  // (Storage then sends application/octet-stream). storage.rules matches the
  // extension case-sensitively, so the upload is rejected with a permission
  // error. Expected: accepted, like "voice.m4a". Actual: denied.
  test.fails('the owner can upload an upper-case .M4A that has no audio type', async () => {
    await assertSucceeds(upload(owner(), pending('VOICE.M4A'), 'application/octet-stream'));
  });

  test('a file just under 25 MB is accepted and one of exactly 25 MB is rejected', async () => {
    await assertSucceeds(upload(owner(), pending('long.mp3'), 'audio/mpeg', 25 * MB - 1));
    await assertFails(upload(owner(), pending('too-long.mp3'), 'audio/mpeg', 25 * MB));
  });

  test('the owner cannot read back a pending upload; only the Cloud Function consumes it', async () => {
    await seedFile(env(), pending('episode.mp3'), 'audio/mpeg');
    await assertFails(getBytes(ref(owner(), pending('episode.mp3'))));
    await assertFails(getMetadata(ref(owner(), pending('episode.mp3'))));
  });

  test.each(OUTSIDERS)(
    "%s cannot upload into or read from a user's pending folder",
    async (who) => {
      await seedFile(env(), pending('episode.mp3'), 'audio/mpeg');
      const storage = outsider(env(), who).storage();
      await assertFails(upload(storage, pending('planted.mp3'), 'audio/mpeg'));
      await assertFails(upload(storage, pending('episode.mp3'), 'audio/mpeg'));
      await assertFails(getBytes(ref(storage, pending('episode.mp3'))));
    }
  );

  test('uploads nested deeper than one file per audio id are rejected', async () => {
    await assertFails(
      upload(owner(), `audio/users/${OWNER}/pending/audio-1/extra/episode.mp3`, 'audio/mpeg')
    );
    await assertFails(upload(owner(), `audio/users/${OWNER}/pending/episode.mp3`, 'audio/mpeg'));
  });
});

describe('pending book uploads (books/users/{uid}/pending/{bookId}/{file})', () => {
  const pending = (fileName: string) => `books/users/${OWNER}/pending/book-1/${fileName}`;

  test.each([
    ['pan-tadeusz.pdf', 'application/pdf'],
    // What uploadText() sends for pasted text.
    ['book.txt', 'text/plain'],
    ['scan.pdf', 'application/octet-stream'],
    ['notes.txt', 'text/plain;charset=utf-8'],
    // The type is enough on its own.
    ['download', 'application/pdf'],
  ])('the owner can upload %s sent as %s', async (fileName, contentType) => {
    await assertSucceeds(upload(owner(), pending(fileName), contentType));
  });

  test.each([
    ['cover.png', 'image/png'],
    ['book.epub', 'application/epub+zip'],
    ['book.docx', 'application/octet-stream'],
    ['notes.md', 'text/markdown'],
    ['book.pdf.exe', 'application/octet-stream'],
  ])('the owner cannot upload %s sent as %s', async (fileName, contentType) => {
    await assertFails(upload(owner(), pending(fileName), contentType));
  });

  // BUG: uploadBook() in src/lib/reader/uploadBook.ts accepts any file whose
  // name ends in ".pdf" case-insensitively, but storage.rules only accepts a
  // lower-case ".pdf" when the type is not application/pdf. A "SCAN.PDF" the
  // browser reports without a type passes the client check and is then
  // rejected with a permission error. Expected: accepted. Actual: denied.
  test.fails('the owner can upload an upper-case .PDF that has no PDF type', async () => {
    await assertSucceeds(upload(owner(), pending('SCAN.PDF'), 'application/octet-stream'));
  });

  test('the owner can upload with the title and author the add-book form sends', async () => {
    const target = ref(owner(), pending('pan-tadeusz.pdf'));
    await assertSucceeds(
      uploadBytes(target, new Uint8Array(3), {
        contentType: 'application/pdf',
        customMetadata: { booktitle: 'Pan Tadeusz', bookauthor: 'Adam Mickiewicz' },
      })
    );
  });

  test('a file just under 50 MB is accepted and one of exactly 50 MB is rejected', async () => {
    await assertSucceeds(upload(owner(), pending('big.pdf'), 'application/pdf', 50 * MB - 1));
    await assertFails(upload(owner(), pending('too-big.pdf'), 'application/pdf', 50 * MB));
  });

  test('the owner cannot read back a pending upload', async () => {
    await seedFile(env(), pending('book.pdf'), 'application/pdf');
    await assertFails(getBytes(ref(owner(), pending('book.pdf'))));
  });

  test.each(OUTSIDERS)(
    "%s cannot upload into or read from a user's pending folder",
    async (who) => {
      await seedFile(env(), pending('book.pdf'), 'application/pdf');
      const storage = outsider(env(), who).storage();
      await assertFails(upload(storage, pending('planted.pdf'), 'application/pdf'));
      await assertFails(upload(storage, pending('book.pdf'), 'application/pdf'));
      await assertFails(getBytes(ref(storage, pending('book.pdf'))));
    }
  );
});

/** Files only Cloud Functions write: the owner may read them, nobody may write. */
const ownerReadOnly = [
  ['processed user audio', `audio/users/${OWNER}/audio-1/episode.mp3`, 'audio/mpeg'],
  ['custom sentence audio', `audio/users/${OWNER}/cards/sentences/card-1.mp3`, 'audio/mpeg'],
  ['custom vocabulary audio', `audio/users/${OWNER}/cards/vocabulary/card-1.mp3`, 'audio/mpeg'],
  ['custom declension audio', `audio/users/${OWNER}/cards/declension/card-1.mp3`, 'audio/mpeg'],
  ['a processed book', `books/users/${OWNER}/book-1/pan-tadeusz.pdf`, 'application/pdf'],
] as const;

describe.each(ownerReadOnly)('%s (%s)', (_label, path, contentType) => {
  test('the owner can read it', async () => {
    await seedFile(env(), path, contentType);
    const bytes = await assertSucceeds(getBytes(ref(owner(), path)));
    expect(new Uint8Array(bytes)).toEqual(new Uint8Array([1, 2, 3]));
  });

  test('the owner cannot create, overwrite, re-label or delete it', async () => {
    await assertFails(upload(owner(), path, contentType));
    await seedFile(env(), path, contentType);
    await assertFails(upload(owner(), path, contentType));
    await assertFails(updateMetadata(ref(owner(), path), { contentType: 'text/html' }));
    await assertFails(deleteObject(ref(owner(), path)));
  });

  test('the admin claim does not let the owner write it either', async () => {
    const ownerAdmin = asUser(env(), OWNER, { admin: true }).storage();
    await assertFails(upload(ownerAdmin, path, contentType));
  });

  test.each(OUTSIDERS)('%s cannot read, write or delete it', async (who) => {
    await seedFile(env(), path, contentType);
    const storage = outsider(env(), who).storage();
    await assertFails(getBytes(ref(storage, path)));
    await assertFails(getMetadata(ref(storage, path)));
    await assertFails(upload(storage, path, contentType));
    await assertFails(deleteObject(ref(storage, path)));
  });
});

describe('system audio (audio/system/{audioId}/{file})', () => {
  const path = 'audio/system/sys-1/audio.mp3';

  test('any signed-in user can read it', async () => {
    await seedFile(env(), path, 'audio/mpeg');
    for (const uid of [OWNER, OTHER]) {
      await assertSucceeds(getBytes(ref(asUser(env(), uid).storage(), path)));
    }
  });

  test('a guest cannot read it', async () => {
    await seedFile(env(), path, 'audio/mpeg');
    await assertFails(getBytes(ref(asGuest(env()).storage(), path)));
  });

  test('no client can write or delete it, not even an admin', async () => {
    const clients = [
      asUser(env(), OWNER).storage(),
      asUser(env(), 'admin-user', { admin: true }).storage(),
      asGuest(env()).storage(),
    ];
    for (const storage of clients) {
      await assertFails(upload(storage, 'audio/system/sys-2/audio.mp3', 'audio/mpeg'));
    }
    await seedFile(env(), path, 'audio/mpeg');
    for (const storage of clients) {
      await assertFails(upload(storage, path, 'audio/mpeg'));
      await assertFails(deleteObject(ref(storage, path)));
    }
  });
});

describe('paths that no rule names', () => {
  test.each([
    `audio/users/${OWNER}/episode.mp3`,
    `audio/users/${OWNER}/a/b/c/episode.mp3`,
    'audio/system/audio.mp3',
    `books/users/${OWNER}/book.pdf`,
    `uploads/${OWNER}/file.txt`,
    'public/logo.png',
  ])('%s is closed to its would-be owner and to admins', async (path) => {
    const clients = [
      asUser(env(), OWNER).storage(),
      asUser(env(), 'admin-user', { admin: true }).storage(),
    ];
    for (const storage of clients) {
      await assertFails(upload(storage, path, 'application/octet-stream'));
    }
    await seedFile(env(), path);
    for (const storage of clients) {
      await assertFails(getBytes(ref(storage, path)));
      await assertFails(deleteObject(ref(storage, path)));
    }
  });
});
