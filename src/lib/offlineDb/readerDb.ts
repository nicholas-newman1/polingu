import Dexie, { type Table } from 'dexie';
import type { Book, ReadingProgress } from '../../types/reader';

class ReaderDatabase extends Dexie {
  books!: Table<Book>;
  progress!: Table<ReadingProgress>;

  constructor() {
    super('polingu-reader');
    this.version(2).stores({
      books: 'id, status, uploadedAt',
      progress: 'bookId, lastReadAt',
    });
  }
}

export const readerDb = new ReaderDatabase();
