import type { ConjugationReviewDataStore } from '../../types/conjugation';
import type { TranslationDirection } from '../../types/common';
import { getConjugationDocPath } from './helpers';
import { saveUserDataOfflineFirst } from '../offlineDb/userDataWrapper';

function serializeConjugationReviewData(data: ConjugationReviewDataStore): unknown {
  return {
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
}

export default async function saveConjugationReviewData(
  data: ConjugationReviewDataStore,
  direction: TranslationDirection
): Promise<void> {
  await saveUserDataOfflineFirst(
    getConjugationDocPath(direction),
    data,
    serializeConjugationReviewData
  );
}
