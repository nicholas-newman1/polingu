import type { ConjugationFormReviewData } from '../../types/conjugation';
import type { TranslationDirection } from '../../types/common';
import { createReviewSubcollectionStorage } from './createReviewSubcollectionStorage';
import type { ReviewSubcollectionStorage } from './createReviewSubcollectionStorage';

function serializeConjugationForm(form: ConjugationFormReviewData): unknown {
  return {
    ...form,
    fsrsCard: {
      ...form.fsrsCard,
      due: form.fsrsCard.due instanceof Date ? form.fsrsCard.due.toISOString() : form.fsrsCard.due,
      last_review:
        form.fsrsCard.last_review instanceof Date
          ? form.fsrsCard.last_review.toISOString()
          : form.fsrsCard.last_review,
    },
  };
}

function deserializeConjugationForm(raw: unknown): ConjugationFormReviewData {
  const form = raw as ConjugationFormReviewData;
  if (form?.fsrsCard) {
    if (form.fsrsCard.due) form.fsrsCard.due = new Date(form.fsrsCard.due);
    if (form.fsrsCard.last_review) {
      form.fsrsCard.last_review = new Date(form.fsrsCard.last_review);
    }
  }
  return form;
}

const plToEnStorage = createReviewSubcollectionStorage<ConjugationFormReviewData>({
  collectionName: 'conjugationReviewForms-pl-en',
  serialize: serializeConjugationForm,
  deserialize: deserializeConjugationForm,
});

const enToPlStorage = createReviewSubcollectionStorage<ConjugationFormReviewData>({
  collectionName: 'conjugationReviewForms-en-pl',
  serialize: serializeConjugationForm,
  deserialize: deserializeConjugationForm,
});

export function conjugationReviewStorage(
  direction: TranslationDirection
): ReviewSubcollectionStorage<ConjugationFormReviewData> {
  return direction === 'pl-to-en' ? plToEnStorage : enToPlStorage;
}
