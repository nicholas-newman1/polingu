import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { CEFRLevel, Sentence } from '../../types/sentences';
import { withNextSentenceIds } from '../sentences/sentenceIds';
import { withCreatedAt } from './firestoreUtils';
import { systemContent } from './systemContent';

const sentences = systemContent<Sentence, string>('sentences');

export const updateSentence = sentences.update;
export const deleteSentence = sentences.delete;
export const updateSentenceTranslation = sentences.updateTranslation;

/**
 * Assigns ids against the server's current list rather than the loaded one, so a
 * sentence another admin added since the last sync isn't overwritten.
 */
export async function assignNewSentenceIds<S extends { level: CEFRLevel }>(
  newSentences: S[]
): Promise<Array<S & { id: string }>> {
  const snapshot = await getDocs(collection(db, 'sentences'));
  return withNextSentenceIds(
    snapshot.docs.map((d) => ({ id: d.id })),
    newSentences
  );
}

export async function createSentence(sentence: Sentence): Promise<void> {
  const docRef = doc(db, 'sentences', sentence.id);
  await setDoc(docRef, withCreatedAt(sentence));
}

export async function createSentences(sentences: Sentence[]): Promise<void> {
  await Promise.all(sentences.map((s) => createSentence(s)));
}
