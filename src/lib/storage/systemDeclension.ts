import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { undefinedToDeleteField } from './firestoreUtils';
import type { DeclensionCard } from '../../types';

export async function updateDeclensionCard(
  cardId: number,
  updates: Partial<Omit<DeclensionCard, 'id'>>
): Promise<void> {
  const docRef = doc(db, 'declensionCards', String(cardId));
  await updateDoc(docRef, undefinedToDeleteField(updates));
}

export async function updateDeclensionCardTranslation(
  cardId: number,
  word: string,
  translation: string
): Promise<void> {
  const docRef = doc(db, 'declensionCards', String(cardId));
  await updateDoc(docRef, {
    [`translations.${word}`]: translation,
  });
}
