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

const EMPTY_CONTENT: ContentData = {
  sentences: [],
  verbs: [],
  vocabulary: [],
  declensionCards: [],
};

/**
 * Load content using online-first strategy:
 * 1. If online, fetch from Firestore and update IndexedDB cache
 * 2. If offline or Firestore fails, use IndexedDB cache
 */
export async function loadContentData(): Promise<ContentData> {
  if (navigator.onLine) {
    try {
      return await syncContentFromFirestore();
    } catch (e) {
      console.error('Failed to load content from Firestore, falling back to cache:', e);
    }
  }

  const cached = await loadCachedContent();
  const hasCached = cached.sentences.length > 0;
  if (hasCached) return cached;

  if (!navigator.onLine) {
    console.warn('Offline with no cached content');
  }
  return EMPTY_CONTENT;
}

async function loadCachedContent(): Promise<ContentData> {
  const [sentences, verbs, vocabulary, declensionCards] = await Promise.all([
    contentDb.sentences.toArray(),
    contentDb.verbs.toArray(),
    contentDb.vocabulary.toArray(),
    contentDb.declensionCards.toArray(),
  ]);
  return { sentences, verbs, vocabulary, declensionCards };
}

/**
 * Sync all content from Firestore to local IndexedDB.
 * Returns the synced data.
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
    [
      contentDb.sentences,
      contentDb.verbs,
      contentDb.vocabulary,
      contentDb.declensionCards,
      contentDb.meta,
    ],
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
    [
      contentDb.sentences,
      contentDb.verbs,
      contentDb.vocabulary,
      contentDb.declensionCards,
      contentDb.meta,
    ],
    async () => {
      await contentDb.sentences.clear();
      await contentDb.verbs.clear();
      await contentDb.vocabulary.clear();
      await contentDb.declensionCards.clear();
      await contentDb.meta.delete('lastSync');
    }
  );
}
