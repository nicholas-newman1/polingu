import Dexie, { type Table } from 'dexie';
import type { Sentence } from '../../types/sentences';
import type { Verb } from '../../types/conjugation';
import type { VocabularyWord } from '../../types/vocabulary';
import type { DeclensionCard } from '../../types';

interface SyncMeta {
  key: string;
  value: number;
}

class ContentDatabase extends Dexie {
  sentences!: Table<Sentence>;
  verbs!: Table<Verb>;
  vocabulary!: Table<VocabularyWord>;
  declensionCards!: Table<DeclensionCard>;
  meta!: Table<SyncMeta>;

  constructor() {
    super('polingu-content');
    this.version(1).stores({
      sentences: 'id, level',
      verbs: 'id, infinitive',
      vocabulary: 'id',
      declensionCards: 'id',
      meta: 'key',
    });
  }
}

export const contentDb = new ContentDatabase();
