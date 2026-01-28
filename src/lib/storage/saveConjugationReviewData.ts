import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { ConjugationReviewDataStore, ConjugationDirection } from '../../types/conjugation';
import { getUserId, getConjugationDocPath } from './helpers';

export default async function saveConjugationReviewData(
  data: ConjugationReviewDataStore,
  direction: ConjugationDirection
): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  const docRef = doc(db, 'users', userId, 'data', getConjugationDocPath(direction));
  const serializable = {
    ...data,
    forms: Object.fromEntries(
      Object.entries(data.forms).map(([key, form]) => [
        key,
        {
          ...form,
          fsrsCard: {
            ...form.fsrsCard,
            due:
              form.fsrsCard.due instanceof Date
                ? form.fsrsCard.due.toISOString()
                : form.fsrsCard.due,
            last_review:
              form.fsrsCard.last_review instanceof Date
                ? form.fsrsCard.last_review.toISOString()
                : form.fsrsCard.last_review,
          },
        },
      ])
    ),
  };
  await setDoc(docRef, serializable);
}
