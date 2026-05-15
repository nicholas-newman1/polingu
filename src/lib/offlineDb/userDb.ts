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

export type ReviewCardCollection =
  | 'vocabularyReviewCards-pl-en'
  | 'vocabularyReviewCards-en-pl'
  | 'sentenceReviewCards-pl-en'
  | 'sentenceReviewCards-en-pl'
  | 'conjugationReviewForms-pl-en'
  | 'conjugationReviewForms-en-pl'
  | 'aspectPairsReviewCards'
  | 'declensionReviewCards';

export interface ReviewCardRecord {
  compoundKey: string; // `${collection}:${cardId}`
  collection: ReviewCardCollection;
  cardId: string;
  data: unknown;
  lastModified: number;
  pendingSync: number; // 1 = needs sync, 0 = synced
  pendingDelete: number; // 1 = queued delete to Firestore, 0 = normal
}

class UserDatabase extends Dexie {
  userData!: Table<UserDataRecord>;
  customCards!: Table<CustomCardRecord>;
  reviewCards!: Table<ReviewCardRecord>;

  constructor() {
    super('polingu-user');
    this.version(1).stores({
      userData: 'key, pendingSync',
    });
    this.version(2).stores({
      userData: 'key, pendingSync',
      customCards: 'compoundKey, collection, pendingSync, pendingDelete',
    });
    this.version(3).stores({
      userData: 'key, pendingSync',
      customCards: 'compoundKey, collection, pendingSync, pendingDelete',
      reviewCards: 'compoundKey, collection, pendingSync, pendingDelete',
    });
  }
}

export const userDb = new UserDatabase();
