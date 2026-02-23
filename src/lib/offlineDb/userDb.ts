import Dexie, { type Table } from 'dexie';

export interface UserDataRecord {
  key: string; // e.g., 'declensionReview', 'sentenceSettings-pl-en'
  data: unknown;
  lastModified: number;
  pendingSync: number; // 1 = needs sync, 0 = synced (using number for indexing)
}

class UserDatabase extends Dexie {
  userData!: Table<UserDataRecord>;

  constructor() {
    super('polingu-user');
    this.version(1).stores({
      userData: 'key, pendingSync',
    });
  }
}

export const userDb = new UserDatabase();
