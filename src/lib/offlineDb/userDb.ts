import Dexie, { type Table } from 'dexie';

export interface UserDataRecord {
  key: string; // e.g., 'declensionReview', 'sentenceSettings-pl-en'
  data: unknown;
  lastModified: number;
  pendingSync: number; // 1 = needs sync, 0 = synced (using number for indexing)
}

export type CustomCardCollection = 'customSentences' | 'customVocabulary' | 'customDeclension';

export interface CustomCardRecord {
  compoundKey: string; // `${collection}:${cardId}`
  collection: CustomCardCollection;
  cardId: string;
  data: unknown;
  lastModified: number;
  pendingSync: number; // 1 = needs sync, 0 = synced
  pendingDelete: number; // 1 = queued delete to Firestore, 0 = normal
}

class UserDatabase extends Dexie {
  userData!: Table<UserDataRecord>;
  customCards!: Table<CustomCardRecord>;

  constructor() {
    super('polingu-user');
    this.version(1).stores({
      userData: 'key, pendingSync',
    });
    this.version(2).stores({
      userData: 'key, pendingSync',
      customCards: 'compoundKey, collection, pendingSync, pendingDelete',
    });
  }
}

export const userDb = new UserDatabase();
