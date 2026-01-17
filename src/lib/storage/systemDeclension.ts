import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import type { DeclensionCard } from '../../types';

export async function updateDeclensionCard(
  cardId: number,
  updates: Partial<Omit<DeclensionCard, 'id'>>
): Promise<void> {
  const docRef = doc(db, 'declensionCards', String(cardId));

  const firestoreUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    firestoreUpdates[key] = value === undefined ? deleteField() : value;
  }

  await updateDoc(docRef, firestoreUpdates);
}
