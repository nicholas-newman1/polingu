import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { contentDb } from './contentDb';
import type { Sentence } from '../../types/sentences';
import type { Verb } from '../../types/conjugation';
import type { VocabularyWord } from '../../types/vocabulary';
import type { DeclensionCard } from '../../types';

export interface ContentData {
  sentences: Sentence[];
  verbs: Verb[];
  vocabulary: VocabularyWord[];
  declensionCards: DeclensionCard[];
}

/**
 * Check if we have any cached content in IndexedDB
 */
export async function hasCachedContent(): Promise<boolean> {
  const count = await contentDb.sentences.count();
  return count > 0;
}

/**
 * Get the timestamp of the last successful sync
 */
export async function getLastSyncTime(): Promise<number | null> {
  const meta = await contentDb.meta.get('lastSync');
  return meta?.value ?? null;
}

/**
 * Load all content from local IndexedDB cache
 * This is instant and works offline
 */
export async function loadCachedContent(): Promise<ContentData> {
  const [sentences, verbs, vocabulary, declensionCards] = await Promise.all([
    contentDb.sentences.toArray(),
    contentDb.verbs.toArray(),
    contentDb.vocabulary.toArray(),
    contentDb.declensionCards.toArray(),
  ]);
  return { sentences, verbs, vocabulary, declensionCards };
}

/**
 * Sync all content from Firestore to local IndexedDB
 * Returns the synced data
 */
export async function syncContentFromFirestore(): Promise<ContentData> {
  const [sentencesSnap, verbsSnap, vocabSnap, declensionSnap] = await Promise.all([
    getDocs(collection(db, 'sentences')),
    getDocs(collection(db, 'verbs')),
    getDocs(collection(db, 'vocabulary')),
    getDocs(collection(db, 'declensionCards')),
  ]);

  const sentences = sentencesSnap.docs.map((d) => d.data() as Sentence);
  const verbs = verbsSnap.docs.map((d) => d.data() as Verb);
  const vocabulary = vocabSnap.docs.map((d) => d.data() as VocabularyWord);
  const declensionCards = declensionSnap.docs.map((d) => d.data() as DeclensionCard);

  await contentDb.transaction(
    'rw',
    [contentDb.sentences, contentDb.verbs, contentDb.vocabulary, contentDb.declensionCards, contentDb.meta],
    async () => {
      // Clear and replace (full sync)
      await contentDb.sentences.clear();
      await contentDb.verbs.clear();
      await contentDb.vocabulary.clear();
      await contentDb.declensionCards.clear();

      await contentDb.sentences.bulkPut(sentences);
      await contentDb.verbs.bulkPut(verbs);
      await contentDb.vocabulary.bulkPut(vocabulary);
      await contentDb.declensionCards.bulkPut(declensionCards);

      await contentDb.meta.put({ key: 'lastSync', value: Date.now() });
    }
  );

  return { sentences, verbs, vocabulary, declensionCards };
}

/**
 * Clear all cached content (for debugging/reset)
 */
export async function clearCachedContent(): Promise<void> {
  await contentDb.transaction(
    'rw',
    [contentDb.sentences, contentDb.verbs, contentDb.vocabulary, contentDb.declensionCards, contentDb.meta],
    async () => {
      await contentDb.sentences.clear();
      await contentDb.verbs.clear();
      await contentDb.vocabulary.clear();
      await contentDb.declensionCards.clear();
      await contentDb.meta.delete('lastSync');
    }
  );
}
