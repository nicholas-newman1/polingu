import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { undefinedToDeleteField } from './firestoreUtils';
import type { Verb } from '../../types/conjugation';

export async function updateVerb(
  verbId: string,
  updates: Partial<Omit<Verb, 'id'>>
): Promise<void> {
  const docRef = doc(db, 'verbs', verbId);
  await updateDoc(docRef, undefinedToDeleteField(updates));
}

export async function deleteVerb(verbId: string): Promise<void> {
  const docRef = doc(db, 'verbs', verbId);
  await deleteDoc(docRef);
}
