import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { undefinedToDeleteField } from './firestoreUtils';

/**
 * Admin writes to a collection of built-in content that every learner shares.
 * A field set to `undefined` in an update is deleted from the document.
 */
export function systemContent<T extends { id: unknown }, Id extends string | number>(
  collectionName: string
) {
  const ref = (id: Id) => doc(db, collectionName, String(id));
  return {
    update: (id: Id, updates: Partial<Omit<T, 'id'>>): Promise<void> =>
      updateDoc(ref(id), undefinedToDeleteField(updates)),
    delete: (id: Id): Promise<void> => deleteDoc(ref(id)),
    /** Sets the translation of one word without touching the others. */
    updateTranslation: (id: Id, word: string, translation: string): Promise<void> =>
      updateDoc(ref(id), { [`translations.${word}`]: translation }),
  };
}
