import type { ConjugationReviewDataStore } from '../../types/conjugation';
import type { TranslationDirection } from '../../types/common';
import { getTodayString, getDefaultConjugationReviewStore, getConjugationDocPath } from './helpers';
import { loadUserData } from '../offlineDb/userDataWrapper';

function deserializeConjugationReviewData(data: unknown): ConjugationReviewDataStore {
  const parsed = data as ConjugationReviewDataStore;
  const today = getTodayString();
  if (parsed.lastReviewDate !== today) {
    parsed.reviewedToday = [];
    parsed.newFormsToday = [];
    parsed.lastReviewDate = today;
  }
  Object.keys(parsed.forms).forEach((key) => {
    const form = parsed.forms[key];
    if (!form?.fsrsCard) return;
    if (form.fsrsCard.due) {
      form.fsrsCard.due = new Date(form.fsrsCard.due);
    }
    if (form.fsrsCard.last_review) {
      form.fsrsCard.last_review = new Date(form.fsrsCard.last_review);
    }
  });
  return parsed;
}

export default async function loadConjugationReviewData(
  direction: TranslationDirection
): Promise<ConjugationReviewDataStore> {
  return loadUserData(
    getConjugationDocPath(direction),
    getDefaultConjugationReviewStore(),
    deserializeConjugationReviewData
  );
}
