import { describe, expect, test } from 'vitest';
import type { StorageObjectData } from 'firebase-functions/storage';
import { parsePendingUpload } from '../../src/shared/pendingUpload.js';

const object = (fields: Partial<StorageObjectData>) =>
  ({ bucket: 'bucket', size: 1234, contentType: 'audio/mpeg', ...fields }) as StorageObjectData;

describe('parsePendingUpload', () => {
  test('extracts the user, item and file from a pending upload path', () => {
    const upload = parsePendingUpload(
      object({ name: 'audio/users/u1/pending/item-9/Lekcja 1.mp3' }),
      'audio'
    );
    expect(upload).toEqual({
      filePath: 'audio/users/u1/pending/item-9/Lekcja 1.mp3',
      userId: 'u1',
      itemId: 'item-9',
      fileName: 'Lekcja 1.mp3',
      contentType: 'audio/mpeg',
      fileSize: 1234,
    });
  });

  test('parses a size reported as a string', () => {
    const upload = parsePendingUpload(
      object({ name: 'books/users/u1/pending/b1/book.pdf', size: '52428800' as never }),
      'books'
    );
    expect(upload?.fileSize).toBe(52428800);
  });

  test('keeps slashes that are part of the file name', () => {
    const upload = parsePendingUpload(
      object({ name: 'books/users/u1/pending/b1/a/b.txt' }),
      'books'
    );
    expect(upload).toMatchObject({ userId: 'u1', itemId: 'b1', fileName: 'a/b.txt' });
  });

  test.each([
    ['a file that has already been moved out of pending', 'audio/users/u1/item-9/audio.mp3'],
    ['generated system audio', 'audio/system/abc/audio.mp3'],
    ['another feature’s upload folder', 'books/users/u1/pending/b1/book.pdf'],
    ['a path nested under another prefix', 'tmp/audio/users/u1/pending/i/x.mp3'],
    ['a pending folder without a file', 'audio/users/u1/pending/item-9/'],
    ['a path without a user', 'audio/users//pending/item-9/x.mp3'],
  ])('ignores %s', (_case, name) => {
    expect(parsePendingUpload(object({ name }), 'audio')).toBeNull();
  });
});
