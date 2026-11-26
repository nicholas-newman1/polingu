import { describe, expect, test, vi } from 'vitest';
import {
  MAX_USER_STORAGE,
  extractPdfMetadata,
  extractTextMetadata,
  getUnusedColor,
  getUserStorageUsage,
} from '../../src/shared/books.js';
import { db, installFakes } from '../support/sdk.js';
import { makePdf } from '../support/media.js';

vi.mock('firebase-admin/app', () => import('../support/sdk.js').then((m) => m.adminApp));
vi.mock('firebase-admin/firestore', () =>
  import('../support/sdk.js').then((m) => m.adminFirestore)
);
vi.mock('firebase-admin/storage', () => import('../support/sdk.js').then((m) => m.adminStorage));

installFakes();

const ALL_COLORS = ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink'];

function seedBook(id: string, fields: Record<string, unknown>, userId = 'reader-1') {
  db.seed(`users/${userId}/books/${id}`, { id, userId, status: 'ready', ...fields });
}

describe('extractTextMetadata', () => {
  test('uses the first line as the title and counts words', () => {
    const text = 'Pan Tadeusz\n\nLitwo! Ojczyzno moja!  ty jesteś jak zdrowie.\n';
    expect(extractTextMetadata(Buffer.from(text))).toEqual({ title: 'Pan Tadeusz', wordCount: 9 });
  });

  test('handles Windows line endings and leading blank lines', () => {
    const text = '\r\n\r\n  Rozdział 1  \r\nDruga linia';
    expect(extractTextMetadata(Buffer.from(text)).title).toBe('Rozdział 1');
  });

  test('ignores a UTF-8 byte order mark', () => {
    const text = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Tytuł\ntekst')]);
    expect(extractTextMetadata(text)).toEqual({ title: 'Tytuł', wordCount: 2 });
  });

  test('a first line of exactly 100 characters is still a title', () => {
    const line = 'x'.repeat(100);
    expect(extractTextMetadata(Buffer.from(`${line}\nbody`)).title).toBe(line);
  });

  test('a first line over 100 characters is not a title', () => {
    const line = 'x'.repeat(101);
    expect(extractTextMetadata(Buffer.from(`${line}\nbody`)).title).toBe('Untitled');
  });

  test('rejects text that is not valid UTF-8', () => {
    const latin2 = Buffer.from([0xa3, 0xf3, 0x64, 0xbc]); // "Łódź" in ISO-8859-2
    expect(() => extractTextMetadata(latin2)).toThrow('Invalid text encoding. Please use UTF-8.');
  });

  test.each([
    ['empty', ''],
    ['whitespace-only', ' \n\t\r\n '],
  ])('rejects an %s file', (_case, text) => {
    expect(() => extractTextMetadata(Buffer.from(text))).toThrow('Text file is empty.');
  });
});

describe('extractPdfMetadata', () => {
  test('reads the title, author and page count', async () => {
    const pdf = makePdf({ pages: 3, info: { Title: '  Pan Tadeusz ', Author: 'Adam Mickiewicz' } });
    expect(await extractPdfMetadata(pdf)).toEqual({
      title: 'Pan Tadeusz',
      author: 'Adam Mickiewicz',
      pageCount: 3,
    });
  });

  test('falls back to Untitled with no author when the PDF has no document info', async () => {
    expect(await extractPdfMetadata(makePdf({ pages: 1 }))).toEqual({
      title: 'Untitled',
      author: undefined,
      pageCount: 1,
    });
  });

  test('treats a blank title or author as missing', async () => {
    const pdf = makePdf({ info: { Title: '   ', Author: ' ' } });
    expect(await extractPdfMetadata(pdf)).toMatchObject({ title: 'Untitled', author: undefined });
  });

  test('rejects a file that is not a PDF', async () => {
    await expect(extractPdfMetadata(Buffer.from('plain text, not a pdf'))).rejects.toThrow();
  });
});

describe('getUserStorageUsage', () => {
  test('sums the sizes of the user’s ready books only', async () => {
    seedBook('a', { fileSize: 1000 });
    seedBook('b', { fileSize: 2500 });
    seedBook('c', { fileSize: 9999, status: 'error' });
    seedBook('d', { fileSize: 7777, status: 'processing' });
    seedBook('e', { fileSize: 4242 }, 'someone-else');

    expect(await getUserStorageUsage('reader-1')).toBe(3500);
  });

  test('counts a book without a size as zero', async () => {
    seedBook('a', { fileSize: 10 });
    seedBook('b', {});
    expect(await getUserStorageUsage('reader-1')).toBe(10);
  });

  test('is zero for a user with no books', async () => {
    expect(await getUserStorageUsage('reader-1')).toBe(0);
  });

  test('the storage quota is 1 GiB', () => {
    expect(MAX_USER_STORAGE).toBe(1024 ** 3);
  });
});

describe('getUnusedColor', () => {
  test('picks the only colour not used yet', async () => {
    ALL_COLORS.filter((c) => c !== 'teal').forEach((color, i) => seedBook(`b${i}`, { color }));
    expect(await getUnusedColor('reader-1')).toBe('teal');
  });

  test('picks among the least-used colours when every colour is taken', async () => {
    ALL_COLORS.forEach((color, i) => seedBook(`first${i}`, { color }));
    ['red', 'blue', 'pink', 'amber', 'green', 'indigo', 'purple'].forEach((color, i) =>
      seedBook(`second${i}`, { color })
    );

    const picks = new Set<string>();
    for (const random of [0, 0.5, 0.999]) {
      vi.spyOn(Math, 'random').mockReturnValue(random);
      picks.add(await getUnusedColor('reader-1'));
    }
    expect(picks).toEqual(new Set(['orange', 'teal']));
  });

  test('ignores books that failed to process and other users’ books', async () => {
    ALL_COLORS.filter((c) => c !== 'red').forEach((color, i) => seedBook(`b${i}`, { color }));
    seedBook('failed', { color: 'red', status: 'error' });
    seedBook('theirs', { color: 'red' }, 'someone-else');

    expect(await getUnusedColor('reader-1')).toBe('red');
  });

  test('ignores colours it does not know', async () => {
    ALL_COLORS.filter((c) => c !== 'pink').forEach((color, i) => seedBook(`b${i}`, { color }));
    seedBook('odd', { color: 'chartreuse' });

    expect(await getUnusedColor('reader-1')).toBe('pink');
  });

  test('can return any colour for a user without books', async () => {
    const picks = new Set<string>();
    for (let i = 0; i < ALL_COLORS.length; i++) {
      vi.spyOn(Math, 'random').mockReturnValue(i / ALL_COLORS.length);
      picks.add(await getUnusedColor('reader-1'));
    }
    expect(picks).toEqual(new Set(ALL_COLORS));
  });
});
