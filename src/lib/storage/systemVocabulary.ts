import { doc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import type { VocabularyWord } from '../../types/vocabulary';

export async function updateSystemVocabularyWord(
  wordId: number,
  updates: Partial<Omit<VocabularyWord, 'id'>>
): Promise<void> {
  const docRef = doc(db, 'vocabulary', String(wordId));

  const firestoreUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    firestoreUpdates[key] = value === undefined ? deleteField() : value;
  }

  await updateDoc(docRef, firestoreUpdates);
}

export async function deleteSystemVocabularyWord(
  wordId: number
): Promise<void> {
  const docRef = doc(db, 'vocabulary', String(wordId));
  await deleteDoc(docRef);
}
